export const UNSPLASH_ACCESS_KEY = "wkFGKy8LrJ88e3o_19coGCWKQTYHMdGAeLJagrb6Ooc";
export const UNSPLASH_API_KEY = "IsGYdlrxOWoNplyTXSJHMA1Nllg8qT16kGBVns6Vvic";

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
