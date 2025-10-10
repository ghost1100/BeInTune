export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const opts = Object.assign(
    { credentials: "include" } as RequestInit,
    init || {},
  );

  // Attach stored token as Authorization header when available and not already provided
  try {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("inTuneToken");
      if (token) {
        opts.headers = Object.assign({}, opts.headers || {}, {
          Authorization: `Bearer ${token}`,
        });
      }
    }
  } catch (e) {
    // ignore storage errors
  }
  let res: Response | null = null;
  const attempted: string[] = [];

  // If this looks like an API path, try several candidate URLs in order to avoid issues
  // with proxies/service workers/netlify functions rewrites in various environments.
  if (
    typeof input === "string" &&
    input.startsWith("/api/") &&
    typeof window !== "undefined"
  ) {
    const apiBase = (import.meta && (import.meta.env && import.meta.env.VITE_API_BASE)) || (window as any).__API_BASE__ || null;
    const candidates = [
      // if explicit API base is set (Vite env), try it first
      ...(apiBase ? [`${apiBase.replace(/\/$/, '')}${input}`] : []),
      // try original relative path (works with reverse proxies / dev proxies)
      input,
      // then absolute origin
      `${window.location.origin}${input}`,
      // netlify functions mapping
      `/.netlify/functions/api${input.slice(4)}`,
    ];

    for (const url of candidates) {
      try {
        attempted.push(url);
        console.debug("apiFetch trying:", url, opts);
        res = await fetch(url, opts);
        console.debug(
          "apiFetch response for",
          url,
          res && { ok: res.ok, status: res.status },
        );
        // if fetch returns, break (even if non-ok)
        break;
      } catch (err: any) {
        console.warn("apiFetch attempt failed for", url, err?.message || err);
        // continue to next candidate
        res = null;
      }
    }

    if (!res) {
      console.error("apiFetch all attempts failed for", input, attempted);
      throw new Error(
        `Network request failed for ${input}. Tried: ${attempted.join(", ")}`,
      );
    }
  } else {
    try {
      console.debug("apiFetch trying:", input, opts);
      res = await fetch(input, opts);
      console.debug(
        "apiFetch response for",
        input,
        res && { ok: res.ok, status: res.status },
      );
    } catch (err: any) {
      console.error("apiFetch network error for", input, err);
      throw new Error(
        `Network request failed for ${typeof input === "string" ? input : "request"}: ${err?.message || err}`,
      );
    }
  }
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  // If the response body has already been used, avoid attempting to read it again
  if (res.bodyUsed) {
    // body already consumed elsewhere (e.g. by service worker or other consumer)
    // fall back to empty body to avoid 'body stream already read' errors
    var raw: string | null = "";
  } else {
    // Try to read body from a clone first to avoid issues with consumed streams
    let reader: Response = res;
    if (typeof res.clone === "function") {
      try {
        reader = res.clone();
      } catch (err) {
        reader = res;
      }
    }

    let rawLocal: string | null = null;
    try {
      rawLocal = await reader.text();
    } catch (err) {
      // If clone read failed, try original response as a last resort
      if (reader !== res) {
        try {
          rawLocal = await res.text();
        } catch (innerErr) {
          // Give up and set empty body
          rawLocal = "";
          console.error("Failed to read response body:", innerErr);
        }
      } else {
        rawLocal = "";
        console.error("Failed to read response body:", err);
      }
    }
    var raw: string | null = rawLocal;
  }

  let data: any = null;
  if (isJson) {
    if (!raw || raw.trim() === "") {
      data = null;
    } else {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `Invalid JSON response from ${typeof input === "string" ? input : "request"}: ${err}`,
        );
      }
    }
  }

  if (!res.ok) {
    if (isJson && data && typeof data === "object") {
      const message = (data.error || data.message || data.detail) as
        | string
        | undefined;
      if (message) throw new Error(message);
    }
    const snippet = raw ? raw.slice(0, 200) : "";
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}${snippet ? ` - ${snippet}` : ""}`,
    );
  }

  if (isJson) return data;
  if (!raw) return null;
  return raw;
}
