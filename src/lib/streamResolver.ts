import axios from 'axios';

export async function resolveStreamUrl(stream: any, movieData: any): Promise<string> {
  // Assuming stream.url contains some indicator, or we just always try to resolve for TR
  try {
    // 1. Get IMDb ID
    const res = await axios.get(`/api/omdb/search?title=${encodeURIComponent(movieData.name)}`);
    const imdbId = res.data.imdbID;
    
    if (!imdbId) return stream.url;

    // 2. Determine URL based on type
    if (movieData.type === 'series') {
      // Need season and episode info
      return `https://torrentio.strem.fun/stream/series/${imdbId}:${movieData.season}:${movieData.episode}.json`;
    } else {
      return `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
    }
  } catch (e) {
    console.error('Failed to resolve Torrentio stream URL', e);
  }
  
  return stream.url;
}
