import { NextResponse } from "next/server";

export default function proxy(request) {
  // If PROXY_SECRET is configured on the server, attach it to forwarded /api requests
  if (request.nextUrl.pathname.startsWith("/api") && process.env.PROXY_SECRET) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-campusflow-proxy-secret", process.env.PROXY_SECRET);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
