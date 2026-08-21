import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to convert SRT to WebVTT
function srtToVtt(srt: string): string {
  if (!srt) return 'WEBVTT\n\n';
  let text = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  if (!text.trim().startsWith('WEBVTT')) {
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
      queryId = parts[1] || parts[0];
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
    if (!subtitleUrl) {
      return res.status(400).send('Missing subtitle url');
    }

    const response = await axios.get(subtitleUrl, {
      responseType: 'text',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    let rawData = response.data;
    if (typeof rawData !== 'string') {
      rawData = String(rawData);
    }

    const vttContent = srtToVtt(rawData);

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vttContent);
  } catch (error: any) {
    console.error('Error proxying subtitle:', error.message);
    res.status(500).send('Failed to fetch subtitle file');
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
