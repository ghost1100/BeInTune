export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const opts = Object.assign({ credentials: 'include' } as RequestInit, init || {});
  const res = await fetch(input, opts);
  const contentType = res.headers.get("content-type") || "";

  // If JSON, try res.json() first. If body already read, fallback to clone().text()
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch (err) {
      try {
        const text = await res.clone().text();
        return JSON.parse(text);
      } catch (err2) {
        throw new Error(`Invalid JSON response from ${typeof input === 'string' ? input : ''}: ${err2}`);
      }
    }
  }

  // Non-JSON: get text
  try {
    const text = await res.text();
    if (!text) {
      if (res.ok) return null;
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }
    if (res.ok) return text;
    const snippet = text.slice(0, 200);
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${snippet}`);
  } catch (err) {
    // If reading text failed because body already read, try clone
    try {
      const text = await (res.clone && res.clone().text ? res.clone().text() : Promise.resolve(''));
      if (!text) {
        if (res.ok) return null;
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      if (res.ok) return text;
      const snippet = text.slice(0, 200);
      throw new Error(`Request failed: ${res.status} ${res.statusText} - ${snippet}`);
    } catch (e) {
      throw err;
    }
  }
}
