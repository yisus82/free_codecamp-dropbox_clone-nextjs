import { auth } from '@clerk/nextjs/server';
import { getUploadAuthParams } from '@imagekit/next/server';
import { NextResponse } from 'next/server';

export const GET = async () => {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get upload auth params
    const { token, expire, signature } = getUploadAuthParams({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string, // Never expose this on client side
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
      // expire: 30 * 60, // Optional, controls the expiry time of the token in seconds, maximum 1 hour in the future
      // token: "random-token", // Optional, a unique token for request
    });

    return Response.json({ token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY });
  } catch (error) {
    console.error('Error generating ImageKit auth params:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication parameters' },
      { status: 500 },
    );
  }
};
