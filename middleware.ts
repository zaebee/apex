// "/" for the curl branch, /api/v1 for the API the apex used to serve before
// Грани Памяти moved to grani.zae.life — a client holding the old origin still
// reaches it. /api/v1 specifically: /api/ping is this site's own live probe and
// must not be swept up.
//
// Deliberately NOT the WebApp itself. Telegram opens the bare origin, and that
// app is mounted at "/" precisely so no redirect can drop the "#tgWebAppData=…"
// fragment — see the comment in memory-facets src/app/api/app.py. Putting a
// redirect back in that path would reintroduce what they engineered around; the
// bot's menu button pointing at the new origin is what moves it, not this.
export const config = {
  matcher: ["/", "/api/v1/:path*"],
};

const MOVED_PREFIXES = ["/api/v1"];
const MOVED_TO = "https://grani.zae.life";

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
  const url = new URL(request.url);

  // 308 rather than 302: the method and body survive, so a WebApp still posting
  // to the old origin reaches the new one intact rather than being turned into
  // a GET.
  if (MOVED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return Response.redirect(`${MOVED_TO}${url.pathname}${url.search}`, 308);
  }

  const ua = request.headers.get("user-agent") ?? "";
  if (!TERMINAL_UA.test(ua)) return;
  const plain = new URL(url);
  plain.pathname = "/plain.txt";
  plain.search = "";

  try {
    const res = await fetch(plain, {
      headers: { "user-agent": "zae.life middleware" },
      // this runs on the critical path of every `/` request from a terminal, so
      // a cold start or a network blip must not hold the response open — the
      // same discipline the island's ping fetch already carries
      signal: AbortSignal.timeout(2000),
    });
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
