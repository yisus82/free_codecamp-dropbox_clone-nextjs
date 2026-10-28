import { db } from '@/lib/db/client';
import { files } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
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

    // Parse request body
    const body = await request.json();
    const { name, userId: bodyUserId, parentId = null } = body;

    // Verify the user is creating a folder in their own account
    if (bodyUserId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check folder name
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
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

    // Create folder data
    const folderData = {
      id: uuidv7(),
      name: name.trim(),
      path: `/folders/${userId}/${uuidv7()}`,
      size: 0,
      type: 'folder',
      fileUrl: '',
      thumbnailUrl: null,
      userId,
      parentId,
      isFolder: true,
      isStarred: false,
      isTrash: false,
    };

    // Insert folder record in database
    const [newFolder] = await db.insert(files).values(folderData).returning();

    return NextResponse.json({
      success: true,
      message: 'Folder created successfully',
      folder: newFolder,
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
};
