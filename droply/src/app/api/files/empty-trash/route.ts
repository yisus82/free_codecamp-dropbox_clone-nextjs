import { db } from '@/lib/db/client';
import { files } from '@/lib/db/schema';
import { authenticate } from '@/lib/imagekit/auth';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const DELETE = async () => {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all files in trash for this user
    const trashedFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.isTrash, true)));
    if (trashedFiles.length === 0) {
      return NextResponse.json({ message: 'No files in trash' }, { status: 200 });
    }

    // Retrieve authentication parameters for the delete operation from ImageKit
    let authParams;
    try {
      authParams = await authenticate();
    } catch (authError) {
      console.error('Failed to authenticate for upload:', authError);
      return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
    }
    const { signature, expire, token, publicKey } = authParams;

    // Delete files from ImageKit
    const deletePromises = trashedFiles
      .filter(file => !file.isFolder)
      .map(file => {
        return fetch(`${process.env.IMAGEKIT_API_URL}/files/${file.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${btoa(`${publicKey}:${token}`)}`,
            'X-ImageKit-Signature': signature,
            'X-ImageKit-Expire': expire.toString(),
          },
        });
      });
    const deleteResponses = await Promise.all(deletePromises);

    // Delete trashed files from the database (only those that were successfully deleted from ImageKit)
    const successfullyDeletedFiles = trashedFiles.filter((file, index) => {
      return !file.isFolder && deleteResponses[index].ok;
    });
    const successfullyDeletedFileIds = successfullyDeletedFiles.map(file => file.id);
    let deletedFiles: typeof trashedFiles = [];
    await Promise.all(
      successfullyDeletedFileIds.map(async fileId => {
        const deletedFile = await db
          .delete(files)
          .where(and(eq(files.userId, userId), eq(files.isTrash, true), eq(files.id, fileId)))
          .returning();
        deletedFiles = deletedFiles.concat(deletedFile);
      }),
    );

    // Log the failed deletions for debugging
    const failedDeletions = trashedFiles.filter(
      file => !successfullyDeletedFileIds.includes(file.id),
    );
    if (failedDeletions.length > 0) {
      console.error('Failed to delete the following files from ImageKit:', failedDeletions);
      return NextResponse.json(
        { error: 'Failed to delete some files from ImageKit', failedFiles: failedDeletions },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully deleted ${deletedFiles.length} files from trash`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error emptying trash:', error);
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 });
  }
};
