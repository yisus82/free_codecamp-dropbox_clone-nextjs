import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up'];

const isPublicRoute = (request: Request) => {
  const url = new URL(request.url);
  return PUBLIC_ROUTES.some(route => url.pathname.match(`^${route}$`));
};

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

const clerkMiddlewareHandler = clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const url = new URL(request.url);

  // Redirect authenticated users away from public routes
  if (userId && isPublicRoute(request) && url.pathname !== '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export default clerkMiddlewareHandler;
