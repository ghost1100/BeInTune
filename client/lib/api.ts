export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const opts = Object.assign({ credentials: "include" } as RequestInit, init || {});
  const res = await fetch(input, opts);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  // Try to read body from a clone first to avoid issues with consumed streams
  let reader: Response = res;
  if (!res.bodyUsed && typeof res.clone === "function") {
    try {
      reader = res.clone();
    } catch (err) {
      reader = res;
    }
  }

  let raw: string | null = null;
  try {
    raw = await reader.text();
  } catch (err) {
    if (reader !== res) {
      try {
        raw = await res.text();
      } catch (innerErr) {
        throw new Error(
          `Failed to read response from ${typeof input === "string" ? input : "request"}: ${innerErr}`,
        );
      }
    } else {
      throw new Error(
        `Failed to read response from ${typeof input === "string" ? input : "request"}: ${err}`,
      );
    }
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
      const message = (data.error || data.message || data.detail) as string | undefined;
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
