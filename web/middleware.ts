import { NextResponse, type NextRequest } from "next/server";

/**
 * Same-origin proxy: the browser only ever talks to the website's domain; /api/** is
 * forwarded to the API (Firebase Cloud Function). This keeps the session cookie
 * first-party (SameSite=Strict), avoids CORS, and lets the API require a shared secret
 * so it cannot be called directly around the website.
 */
export function middleware(req: NextRequest) {
  const target = process.env.API_INTERNAL_URL;
  if (!target) {
    return NextResponse.json({ error: { code: "API_NOT_CONFIGURED", message: "API indisponível." } }, { status: 503 });
  }
  const url = new URL(`${target.replace(/\/$/, "")}${req.nextUrl.pathname}${req.nextUrl.search}`);
  const headers = new Headers(req.headers);
  // Never let a visitor claim to be the proxy or the SSR renderer.
  headers.delete("x-latox-proxy");
  headers.delete("x-latox-ssr");
  // On Vercel, x-real-ip is overwritten by the platform with the visitor's IP; elsewhere
  // (local dev) a client could forge it, so drop it.
  if (process.env.VERCEL !== "1") headers.delete("x-real-ip");
  const secret = process.env.API_PROXY_SECRET;
  if (secret) headers.set("x-latox-proxy", secret);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = { matcher: "/api/:path*" };
