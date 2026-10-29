import { db } from '@/lib/db/client';
import { files } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const PATCH = async (
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

    // Toggle the isStarred status
    const updatedFiles = await db
      .update(files)
      .set({ isStarred: !file.isStarred })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    return NextResponse.json(updatedFiles[0]);
  } catch (error) {
    console.error('Error starring file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
};
