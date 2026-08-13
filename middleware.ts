export const config = { matcher: "/" };

const TERMINAL_UA = /\b(curl|wget|httpie|xh)\b/i;

/** Returns the plain text as the response to `/` rather than redirecting to it,
 *  so a bare `curl zae.life` prints without `-L`. Returning nothing lets the
 *  request continue to the normal static route.
 *
 *  A plain Vercel Edge Middleware function over the standard Request — no
 *  next/server import, which would add a Next dependency this project does not
 *  otherwise need. */
export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get("user-agent") ?? "";
  if (!TERMINAL_UA.test(ua)) return;

  const url = new URL(request.url);
  url.pathname = "/plain.txt";
  url.search = "";

  const res = await fetch(url, { headers: { "user-agent": "zae.life middleware" } });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
