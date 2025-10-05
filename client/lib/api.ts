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
  let res: Response;
  try {
    res = await fetch(input, opts);
  } catch (err: any) {
    // Network or CORS failure — attempt common fallbacks for serverless deployments
    const attempted: string[] = [];
    try {
      if (
        typeof input === "string" &&
        input.startsWith("/api/") &&
        typeof window !== "undefined"
      ) {
        // try Netlify functions path
        const alt1 = `/.netlify/functions/api${input.slice(4)}`;
        attempted.push(alt1);
        try {
          res = await fetch(alt1, opts);
        } catch (e) {
          // try absolute origin + api
          const alt2 = `${window.location.origin}${input}`;
          attempted.push(alt2);
          res = await fetch(alt2, opts);
        }
      } else {
        throw err;
      }
    } catch (innerErr: any) {
      throw new Error(
        `Network request failed for ${typeof input === "string" ? input : "request"}: ${err?.message || err}. Fallback attempts: ${attempted.join(", ")}. Last error: ${innerErr?.message || innerErr}`,
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
