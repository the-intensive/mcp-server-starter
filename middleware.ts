import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * The `.well-known` discovery endpoints MUST stay public and unauthenticated.
 * That is how an MCP client finds out where to send the user to log in. If you
 * gate them, clients get a 404/401 during discovery and the connect flow dies
 * with an unhelpful error.
 *
 * `/[transport]` is deliberately NOT protected here either -- `withMcpAuth` in
 * the route handler does that job, and it returns the `WWW-Authenticate` header
 * the MCP spec requires. Blocking it at the middleware layer would return a
 * bare 401 with no hint about where to authenticate.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
