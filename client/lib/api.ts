export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const opts = Object.assign({ credentials: "include" } as RequestInit, init || {});
  const res = await fetch(input, opts);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let raw: string | null = null;
  try {
    raw = await res.text();
  } catch (err) {
    throw new Error(
      `Failed to read response from ${typeof input === "string" ? input : "request"}: ${err}`,
    );
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
