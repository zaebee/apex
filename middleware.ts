export const config = { matcher: "/" };

/** Exported so the test exercises this regex rather than a copy of it. A copy
 *  would keep passing after this one changed. */
export const TERMINAL_UA = /\b(curl|wget|httpie|xh)\b/i;

/** Returns the plain text as the response to `/` rather than redirecting to it,
 *  so `curl https://zae.life` prints without `-L`. Returning nothing lets the
 *  request continue to the normal static route.
 *
 *  Note the scheme: curl defaults a bare `zae.life` to http, and Vercel answers
 *  that with a 308 to https at the platform edge, before middleware runs. So a
 *  literal `curl zae.life` prints nothing without `-L`. The copy on the site
 *  says https for that reason.
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

  try {
    const res = await fetch(url, { headers: { "user-agent": "zae.life middleware" } });
    // Only a good response is forwarded. Relabelling a 404 page as text/plain
    // would hand the terminal audience an error dressed as the map.
    if (res.ok) {
      return new Response(await res.text(), {
        status: res.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  } catch {
    // fall through to the HTML: degraded for a terminal, but correct, and far
    // better than a 500 for a request the static route could have served
  }

  return undefined;
}
