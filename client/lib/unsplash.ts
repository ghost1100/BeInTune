const _importMetaKey = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_UNSPLASH_ACCESS_KEY ? (import.meta as any).env.VITE_UNSPLASH_ACCESS_KEY : undefined;
export const UNSPLASH_ACCESS_KEY = _importMetaKey || "IsGYdlrxOWoNplyTXSJHMA1Nllg8qT16kGBVns6Vvic";

export async function getRandomImage(query = "music teacher") {
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=portrait&content_filter=high&client_id=${UNSPLASH_ACCESS_KEY}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.urls && (json.urls.small || json.urls.regular || json.urls.full) ? json.urls.small || json.urls.regular || json.urls.full : null;
  } catch (e) {
    console.error("Unsplash fetch error", e);
    return null;
  }
}

export async function searchImages(query = "music", per_page = 9) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${per_page}&client_id=${UNSPLASH_ACCESS_KEY}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: any) => ({ id: r.id, thumb: r.urls.small, full: r.urls.full, alt: r.alt_description }));
  } catch (e) {
    console.error('Unsplash search error', e);
    return [];
  }
}
