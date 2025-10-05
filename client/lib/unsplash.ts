const _importMetaKey =
  typeof import.meta !== "undefined" &&
  (import.meta as any).env &&
  (import.meta as any).env.VITE_UNSPLASH_ACCESS_KEY
    ? (import.meta as any).env.VITE_UNSPLASH_ACCESS_KEY
    : undefined;
export const UNSPLASH_ACCESS_KEY =
  _importMetaKey || "IsGYdlrxOWoNplyTXSJHMA1Nllg8qT16kGBVns6Vvic";

const BACKUP_IMAGES = [
  'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=1200&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80',
  'https://images.unsplash.com/photo-1511853628462-7a9d6f5b3b6f?w=1200&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80',
];

function getCacheKey() {
  return 'unsplash_cache_v1';
}

function getIndexKey() {
  return 'unsplash_index_v1';
}

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(getCacheKey());
    return raw ? JSON.parse(raw) : BACKUP_IMAGES.slice();
  } catch (e) {
    return BACKUP_IMAGES.slice();
  }
}

function writeCache(list: string[]) {
  try {
    localStorage.setItem(getCacheKey(), JSON.stringify(list));
  } catch (e) {}
}

function readIndex(): number {
  try {
    const raw = localStorage.getItem(getIndexKey());
    return raw ? Number(raw) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

function writeIndex(i: number) {
  try {
    localStorage.setItem(getIndexKey(), String(i));
  } catch (e) {}
}

export async function getRandomImage(query = "music teacher") {
  // Try Unsplash API first
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=portrait&content_filter=high&client_id=${UNSPLASH_ACCESS_KEY}`,
    );
    if (res.ok) {
      const json = await res.json();
      const url = json.urls && (json.urls.small || json.urls.regular || json.urls.full) ? json.urls.small || json.urls.regular || json.urls.full : null;
      if (url) {
        // cache it
        try {
          const cache = readCache();
          cache.push(url);
          writeCache(cache);
        } catch (e) {}
        return url;
      }
    }
  } catch (e) {
    console.error("Unsplash fetch error", e);
  }

  // fallback to cached list or backup images
  const cache = readCache();
  const idx = readIndex();
  if (cache.length === 0) return null;
  const out = cache[idx % cache.length];
  writeIndex((idx + 1) % cache.length);
  return out;
}

export async function searchImages(query = "music", per_page = 9) {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${per_page}&client_id=${UNSPLASH_ACCESS_KEY}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      id: r.id,
      thumb: r.urls.small,
      full: r.urls.full,
      alt: r.alt_description,
    }));
  } catch (e) {
    console.error("Unsplash search error", e);
    return [];
  }
}
