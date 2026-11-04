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
  // Never let a visitor claim to be the proxy, the SSR renderer or set their own IP.
  headers.delete("x-latox-proxy");
  headers.delete("x-latox-ssr");
  headers.delete("x-latox-client-ip");
  // On Vercel, x-real-ip is overwritten by the platform with the visitor's IP. The API is
  // also behind Vercel (which would replace x-real-ip with this proxy's IP), so the
  // visitor IP travels in our own header, trusted only together with the proxy secret.
  if (process.env.VERCEL === "1") {
    const ip = req.headers.get("x-real-ip");
    if (ip) headers.set("x-latox-client-ip", ip);
  } else {
    headers.delete("x-real-ip");
  }
  const secret = process.env.API_PROXY_SECRET;
  if (secret) headers.set("x-latox-proxy", secret);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = { matcher: "/api/:path*" };
