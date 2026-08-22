import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

import AdmZip from "adm-zip";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to resolve IMDb ID from TMDB search
async function resolveImdbIdFromTmdb(title: string, type: 'movie' | 'series' = 'movie'): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY || "15d2ea6d0dc1d476efbca3de441b1ddc";
  const searchTypes: ('movie' | 'tv')[] = type === 'series' ? ['tv', 'movie'] : ['movie', 'tv'];

  for (const sType of searchTypes) {
    try {
      console.log(`[TMDB Resolver] Searching TMDB (${sType}) for title: "${title}"`);
      // 1. Search with Vietnamese or English locale
      const searchRes = await axios.get(`https://api.themoviedb.org/3/search/${sType}`, {
        params: {
          api_key: apiKey,
          query: title,
          language: 'vi-VN'
        }
      });

      let results = searchRes.data?.results || [];
      if (results.length === 0) {
        const enSearchRes = await axios.get(`https://api.themoviedb.org/3/search/${sType}`, {
          params: {
            api_key: apiKey,
            query: title
          }
        });
        results = enSearchRes.data?.results || [];
      }

      if (results.length > 0) {
        const tmdbId = results[0].id;
        console.log(`[TMDB Resolver] Found TMDB ID: ${tmdbId} for type: ${sType}`);
        const extRes = await axios.get(`https://api.themoviedb.org/3/${sType}/${tmdbId}/external_ids`, {
          params: {
            api_key: apiKey
          }
        });
        const imdbId = extRes.data?.imdb_id;
        if (imdbId && imdbId.startsWith('tt')) {
          console.log(`[TMDB Resolver] Successfully resolved IMDb ID: ${imdbId}`);
          return imdbId;
        }
      }
    } catch (error: any) {
      console.warn(`[TMDB Resolver] TMDB search error for type ${sType}:`, error.message);
    }
  }
  return null;
}

// Global IMDb ID Resolver
async function getImdbId(idOrTitle: string, type: 'movie' | 'series' = 'movie'): Promise<string | null> {
  if (!idOrTitle) return null;
  
  let cleanId = idOrTitle.trim();
  if (cleanId.includes(':')) {
    const parts = cleanId.split(':');
    cleanId = parts[parts.length - 1];
  }
  
  if (/^tt\d{7,10}$/.test(cleanId)) {
    return cleanId;
  }

  // If it is a slug/Vietnamese title, clean hyphens and search
  let titleQuery = idOrTitle;
  if (idOrTitle.includes(':')) {
    const parts = idOrTitle.split(':');
    // For source prefix like kkphim:yeu-yeu-cuoi, we want the last part
    titleQuery = parts[parts.length - 1] || parts[0];
  }
  titleQuery = titleQuery.replace(/-/g, ' ').trim();

  return await resolveImdbIdFromTmdb(titleQuery, type);
}

// SubDL API integration
app.get("/api/subdl/vtt", async (req, res) => {
  const { imdb_id, type = 'movie' } = req.query;
  const SUBDL_API_KEY = "subdl_B_aIO1H-jyorIqf4B-DtIA5OUE1EBuapUlJebKMc27g";

  if (!imdb_id || typeof imdb_id !== 'string') {
    return res.status(400).json({ error: "Missing or invalid imdb_id" });
  }

  let resolvedImdbId = imdb_id;
  if (!resolvedImdbId.startsWith('tt')) {
    const resolved = await getImdbId(resolvedImdbId, type === 'series' ? 'series' : 'movie');
    if (resolved) {
      resolvedImdbId = resolved;
    } else {
      return res.status(404).json({ error: "Could not resolve IMDb ID for SubDL search" });
    }
  }

  try {
    // 1. Search for Vietnamese subtitles
    const searchRes = await axios.get(`https://api.subdl.com/api/v1/subtitles`, {
      params: {
        api_key: SUBDL_API_KEY,
        imdb_id: resolvedImdbId,
        languages: "vi",
        type: type === 'series' ? 'tv' : 'movie'
      }
    });

    if (!searchRes.data || searchRes.data.status === false) {
      const subdlError = searchRes.data?.error || "Unknown SubDL error";
      console.warn(`SubDL API could not find media: ${resolvedImdbId} - ${subdlError}`);
      return res.status(404).json({ error: `SubDL: ${subdlError}`, status: false });
    }

    if (!searchRes.data.subtitles || searchRes.data.subtitles.length === 0) {
      return res.status(404).json({ error: "No Vietnamese subtitles found for this IMDB ID" });
    }

    // Pick the first subtitle (best match usually)
    const sub = searchRes.data.subtitles[0];
    if (!sub || !sub.url) {
      return res.status(404).json({ error: "Subtitle URL not found in response" });
    }

    // SubDL API returns url path, e.g., /subtitle/12345-vi.zip
    const downloadUrl = `https://dl.subdl.com${sub.url}`;

    // 2. Download ZIP
    const zipResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    // 3. Extract SRT and convert to VTT
    const zip = new AdmZip(Buffer.from(zipResponse.data));
    const zipEntries = zip.getEntries();
    
    // Find first .srt file (prefer srt)
    let srtEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith('.srt'));
    let vttEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith('.vtt'));
    
    if (!srtEntry && !vttEntry) {
       return res.status(404).json({ error: "No SRT or VTT file found in ZIP archive" });
    }

    let vttContent = "";
    if (vttEntry) {
      vttContent = vttEntry.getData().toString('utf8');
      // Ensure it has correct header
      if (!vttContent.trim().startsWith('WEBVTT')) {
        vttContent = 'WEBVTT\n\n' + vttContent;
      }
    } else if (srtEntry) {
      const srtContent = srtEntry.getData().toString('utf8');
      vttContent = srtToVtt(srtContent);
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vttContent);

  } catch (error: any) {
    console.error('SubDL error:', error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: "Failed to process subtitles from SubDL", details: error.message });
  }
});

// OpenSubtitles API integration
app.get("/api/opensubtitles", async (req, res) => {
  const { imdb_id, title, languages = 'en,vi,th,zh,ko,ja' } = req.query;
  const API_KEY = process.env.OPENSUBTITLES_API_KEY || "xhGcgu63tcMZ8VuurzJqXTYAIskDyBAr";
  const USER_AGENT = process.env.OPENSUBTITLES_USER_AGENT || "Cineflix";

  if (!imdb_id && !title) {
    return res.status(400).json({ success: false, error: "Missing imdb_id or title" });
  }

  let finalImdbId = imdb_id;
  if (finalImdbId && typeof finalImdbId === 'string' && !finalImdbId.startsWith('tt')) {
    const resolved = await getImdbId(finalImdbId);
    if (resolved) {
      finalImdbId = resolved;
    }
  }

  if (!finalImdbId && title && typeof title === 'string') {
    const resolved = await getImdbId(title);
    if (resolved) {
      finalImdbId = resolved;
    }
  }

  const params: any = {
    languages: languages
  };

  if (finalImdbId && typeof finalImdbId === 'string' && finalImdbId.startsWith('tt')) {
    params.imdb_id = finalImdbId.substring(2);
  } else if (title && typeof title === 'string') {
    params.query = title;
  }

  try {
    // 1. Search for subtitles
    const searchRes = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles`, {
      params,
      headers: {
        'Api-Key': API_KEY,
        'User-Agent': USER_AGENT
      }
    });

    if (!searchRes.data || !searchRes.data.data) {
      return res.json({ success: true, subtitles: [] });
    }

    // Map search results to a format the frontend can use
    const subtitles = searchRes.data.data.map((item: any) => {
      const file = item.attributes.files[0];
      return {
        id: `os-${file.file_id}`,
        file_id: file.file_id,
        lang: item.attributes.language,
        langName: `${item.attributes.language_name || item.attributes.language} (OpenSubtitles)`,
        addon: 'OpenSubtitles',
        // Use a proxy URL for downloading
        url: `/api/opensubtitles/download?file_id=${file.file_id}`
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      success: true,
      subtitles: subtitles
    });

  } catch (error: any) {
    console.error('OpenSubtitles search error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: "OpenSubtitles API error", 
      details: error.response?.data || error.message 
    });
  }
});

// Endpoint to get download link for OpenSubtitles
app.get("/api/opensubtitles/download", async (req, res) => {
  const { file_id } = req.query;
  const API_KEY = process.env.OPENSUBTITLES_API_KEY || "xhGcgu63tcMZ8VuurzJqXTYAIskDyBAr";
  const USER_AGENT = process.env.OPENSUBTITLES_USER_AGENT || "Cineflix";

  if (!file_id) {
    return res.status(400).send("Missing file_id");
  }

  try {
    const downloadRes = await axios.post(`https://api.opensubtitles.com/api/v1/download`, 
      { file_id: Number(file_id) },
      {
        headers: {
          'Api-Key': API_KEY,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!downloadRes.data || !downloadRes.data.link) {
      return res.status(500).send("Failed to get download link");
    }

    // Redirect to the actual download link or fetch and serve
    // For subtitles, we can redirect or proxy. Proxying allows us to convert SRT to VTT if needed.
    const subtitleUrl = downloadRes.data.link;
    
    // Use existing proxy logic to ensure CORS and VTT format
    res.redirect(`/api/subtitles/proxy?url=${encodeURIComponent(subtitleUrl)}`);

  } catch (error: any) {
    console.error('OpenSubtitles download error:', error.response?.data || error.message);
    res.status(500).send("OpenSubtitles download error");
  }
});

// Helper to convert SRT to WebVTT
function srtToVtt(srt: string): string {
  if (!srt) return 'WEBVTT\n\n';
  let text = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  // If it starts with WEBVTT but might be missing newlines
  if (text.startsWith('WEBVTT')) {
    // Check if there's a newline after WEBVTT
    if (!text.startsWith('WEBVTT\n')) {
      text = text.replace('WEBVTT', 'WEBVTT\n\n');
    } else if (!text.startsWith('WEBVTT\n\n')) {
      text = text.replace('WEBVTT\n', 'WEBVTT\n\n');
    }
  } else {
    // Convert timestamps: 00:00:00,000 -> 00:00:00.000
    text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    text = 'WEBVTT\n\n' + text;
  }
  
  return text;
}

// Subtitles endpoint querying AIO Subtitle and SubDL addons
app.get("/api/subtitles", async (req, res) => {
  try {
    const { id, type = 'movie', season, episode } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing movie id' });
    }

    let stremioId = String(id);
    let queryId = stremioId;
    if (stremioId.includes(':')) {
      const parts = stremioId.split(':');
      // For cases like "kkphim-series:yeu-yeu-cuoi:1:1" or "ophim-series:yeu-yeu-cuoi", we want "yeu-yeu-cuoi"
      if (parts[1] && !parts[1].match(/^\d+$/)) {
        queryId = parts[1];
      } else {
        // Fallback to last part if parts[1] is a number (season)
        queryId = parts.find(p => !p.match(/^\d+$/) && p !== 'series' && p !== 'movie' && p !== 'anime') || parts[0];
      }
    }

    // Resolve IMDb ID for querying AIO & SubDL Stremio addons
    const resolvedImdb = await getImdbId(queryId, type === 'series' ? 'series' : 'movie');
    if (resolvedImdb) {
      console.log(`[API Subtitles] Resolved queryId "${queryId}" -> "${resolvedImdb}"`);
      queryId = resolvedImdb;
      stremioId = resolvedImdb;
    }

    if (type === 'series' && season && episode) {
      queryId = `${queryId}:${season}:${episode}`;
    }

    const allSubtitles: any[] = [];

    // 1. AIO Subtitle Addon API
    const aioUrls = [
      `https://api.aiosubtitle.org/subtitles/${type}/${queryId}.json`,
      `https://api.aiosubtitle.org/subtitles/${type}/${stremioId}.json`
    ];

    for (const url of aioUrls) {
      try {
        const response = await axios.get(url, { timeout: 4000 });
        if (response.data && Array.isArray(response.data.subtitles)) {
          response.data.subtitles.forEach((sub: any) => {
            allSubtitles.push({
              ...sub,
              addon: 'AIO Subtitle',
              id: sub.id || sub.url,
              lang: sub.lang || sub.language || 'vie'
            });
          });
          break;
        }
      } catch (err) {
        // Ignore
      }
    }

    // 2. SubDL Addon API
    const subdlUrls = [
      `https://stremio.subdl.com/subtitles/${type}/${queryId}.json`,
      `https://subdl.stremio.fun/subtitles/${type}/${queryId}.json`,
      `https://stremio.subdl.com/subtitles/${type}/${stremioId}.json`
    ];

    for (const url of subdlUrls) {
      try {
        const response = await axios.get(url, { timeout: 4000 });
        if (response.data && Array.isArray(response.data.subtitles)) {
          response.data.subtitles.forEach((sub: any) => {
            allSubtitles.push({
              ...sub,
              addon: 'SubDL',
              id: sub.id || sub.url,
              lang: sub.lang || sub.language || 'vie'
            });
          });
          break;
        }
      } catch (err) {
        // Ignore
      }
    }

    const uniqueSubs = Array.from(new Map(allSubtitles.map(s => [s.url, s])).values());
    res.json({ subtitles: uniqueSubs });
  } catch (error: any) {
    console.error('Error fetching subtitles:', error.message);
    res.json({ subtitles: [] });
  }
});

// Proxy subtitle file to parse SRT to VTT and bypass CORS
app.get("/api/subtitles/proxy", async (req, res) => {
  try {
    const subtitleUrl = req.query.url as string;
    if (!subtitleUrl || !subtitleUrl.startsWith('http')) {
      return res.status(400).send('Invalid or missing subtitle url');
    }

    let referer = '';
    try {
      referer = new URL(subtitleUrl).origin;
    } catch (e) {
      // Ignore
    }

    const response = await axios.get(subtitleUrl, {
      responseType: 'text',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ...(referer ? { 'Referer': referer } : {})
      }
    });

    let rawData = response.data;
    if (typeof rawData !== 'string') {
      rawData = String(rawData);
    }

    // Check if it's already VTT or if it's SRT
    let vttContent = rawData;
    if (!rawData.trim().startsWith('WEBVTT')) {
      vttContent = srtToVtt(rawData);
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vttContent);
  } catch (error: any) {
    console.error('Error proxying subtitle:', error.message);
    res.status(500).send(`Failed to fetch subtitle file: ${error.message}`);
  }
});

// Ophim Proxy endpoints
app.get("/api/ophim/catalog", async (req, res) => {
  try {
    const { slug, type, page = 1, search, genre } = req.query;
    const baseUrl = "https://ophim1.com";
    let url = "";

    if (search) {
      url = `${baseUrl}/v1/api/tim-kiem?keyword=${encodeURIComponent(String(search))}&page=${page}&limit=24`;
    } else if (genre) {
      // Simplification: just use the slug as genre if provided, otherwise assume it's a list
      url = `${baseUrl}/v1/api/the-loai/${genre}?page=${page}`;
    } else {
      url = `${baseUrl}/v1/api/danh-sach/${slug}?page=${page}`;
    }

    const response = await axios.get(url, { 
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Ophim catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

app.get("/api/ophim/meta/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const response = await axios.get(`https://ophim1.com/phim/${encodeURIComponent(slug)}`, { 
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Ophim meta:', error);
    res.status(500).json({ error: 'Failed to fetch meta' });
  }
});

// TMDB and OMDb Proxy endpoints
app.get("/api/tmdb/search", async (req, res) => {
  try {
    const { query } = req.query;
    const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(String(query))}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search TMDB' });
  }
});

app.get("/api/tmdb/external/:tmdbId", async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const response = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${process.env.TMDB_API_KEY}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TMDB external IDs' });
  }
});

app.get("/api/omdb/search", async (req, res) => {
  try {
    const { title } = req.query;
    const response = await axios.get(`http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&t=${encodeURIComponent(String(title))}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search OMDb' });
  }
});

async function startServer() {

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
