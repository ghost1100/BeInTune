export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  // Try to parse JSON if content-type indicates json
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON response from ${typeof input === 'string' ? input : ''}: ${err}`);
    }
  }
  // If it's empty body and ok, return null
  if (!text) {
    if (res.ok) return null;
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  // Non-JSON response (likely HTML error page)
  if (res.ok) {
    // return text for consumers that can handle it
    return text;
  }
  // For error statuses include the body in the message
  const snippet = text.slice(0, 200);
  throw new Error(`Request failed: ${res.status} ${res.statusText} - ${snippet}`);
}
