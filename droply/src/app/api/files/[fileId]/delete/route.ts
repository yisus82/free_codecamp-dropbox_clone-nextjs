import { db } from '@/lib/db/client';
import { files } from '@/lib/db/schema';
import { authenticate } from '@/lib/imagekit/auth';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const DELETE = async (
  _request: NextRequest,
  props: { params: Promise<{ fileId: string }> },
) => {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the fileId from the request parameters
    const { fileId } = await props.params;
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get the current file
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete file from ImageKit if it's not a folder
    if (!file.isFolder) {
      // Retrieve authentication parameters for the delete operation from ImageKit
      let authParams;
      try {
        authParams = await authenticate();
      } catch (authError) {
        console.error('Failed to authenticate for upload:', authError);
        return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
      }
      const { signature, expire, token, publicKey } = authParams;

      // Delete file from ImageKit
      const deleteResponse = await fetch(`${process.env.IMAGEKIT_API_URL}/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${publicKey}:${token}`)}`,
          'X-ImageKit-Signature': signature,
          'X-ImageKit-Expire': expire.toString(),
        },
      });
      if (!deleteResponse.ok) {
        console.error(
          `Failed to delete file ${fileId} from ImageKit:`,
          await deleteResponse.text(),
        );
        return NextResponse.json({ error: 'Failed to delete file from ImageKit' }, { status: 500 });
      }
    }

    // Delete file from database
    const [deletedFile] = await db
      .delete(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      deletedFile,
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
};
