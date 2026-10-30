import { db } from '@/lib/db/client';
import { files } from '@/lib/db/schema';
import { authenticate } from '@/lib/imagekit/auth';
import { auth } from '@clerk/nextjs/server';
import {
  ImageKitInvalidRequestError,
  ImageKitServerError,
  ImageKitUploadNetworkError,
  upload,
} from '@imagekit/next';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { uuidv7 } from 'uuidv7';

export const POST = async (request: NextRequest) => {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const formUserId = formData.get('userId') as string;
    const parentId = (formData.get('parentId') as string) || null;

    // Verify the user is uploading to their own account
    if (formUserId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if a file is provided
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if parent folder exists when parentId is provided
    if (parentId) {
      const [parentFolder] = await db
        .select()
        .from(files)
        .where(and(eq(files.id, parentId), eq(files.userId, userId), eq(files.isFolder, true)));

      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }
    }

    // Only allow image uploads
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 });
    }

    // Generate a unique filename for the uploaded file to avoid conflicts
    const originalFilename = file.name;
    const fileExtension = originalFilename.split('.').pop() || '';
    const uniqueFilename = `${uuidv7()}.${fileExtension}`;

    // Create folder path based on parent folder if exists
    const folderPath = parentId ? `/droply/${userId}/folders/${parentId}` : `/droply/${userId}`;

    // Retrieve authentication parameters for the upload operation from ImageKit
    let authParams;
    try {
      authParams = await authenticate();
    } catch (authError) {
      console.error('Failed to authenticate for upload:', authError);
      return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
    }
    const { signature, expire, token, publicKey } = authParams;

    try {
      // Call the ImageKit SDK upload function with the required parameters and callbacks
      const uploadResponse = await upload({
        expire,
        token,
        signature,
        publicKey,
        file,
        fileName: uniqueFilename,
        folder: folderPath,
        useUniqueFileName: false,
      });

      // Prepare file data for database insertion
      const fileData = {
        name: originalFilename,
        path: uploadResponse.filePath || '',
        size: file.size,
        type: file.type,
        fileUrl: uploadResponse.url || '',
        thumbnailUrl: uploadResponse.thumbnailUrl || null,
        userId: userId,
        parentId: parentId,
        isFolder: false,
        isStarred: false,
        isTrash: false,
      };

      // Check fileData for required fields before inserting into the database
      if (
        !fileData.name ||
        !fileData.path ||
        !fileData.size ||
        !fileData.type ||
        !fileData.fileUrl
      ) {
        console.error('Missing required file data fields:', fileData);
        return NextResponse.json({ error: 'Missing required file data fields' }, { status: 500 });
      }

      try {
        // Insert file record in database
        const [newFile] = await db.insert(files).values(fileData).returning();

        return NextResponse.json(newFile);
      } catch (error) {
        console.error('Error inserting file into database:', error);
        return NextResponse.json({ error: 'Failed to insert file into database' }, { status: 500 });
      }
    } catch (error) {
      // Handle specific error types provided by the ImageKit SDK
      if (error instanceof ImageKitInvalidRequestError) {
        console.error('Invalid request:', error.message);
      } else if (error instanceof ImageKitUploadNetworkError) {
        console.error('Network error:', error.message);
      } else if (error instanceof ImageKitServerError) {
        console.error('Server error:', error.message);
      } else {
        // Handle any other errors that may occur
        console.error('Upload error:', error);
      }
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
};
