import express from "express";
import path from "path";
import axios from "axios";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

import AdmZip from "adm-zip";
import jschardet from "jschardet";
import iconv from "iconv-lite";

// Simple in-memory cache with TTL (Time To Live) to completely prevent 429 rate limits
class SimpleMemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper to make axios requests with retry on 429 (rate limiting)
async function axiosGetWithRetry(url: string, config: any = {}, retries = 7, delay = 3000): Promise<any> {
  const currentConfig = { ...config };
  if (!currentConfig.headers) currentConfig.headers = {};
  
  // Pick a new random User-Agent for every attempt
  currentConfig.headers['User-Agent'] = getRandomUserAgent();

  try {
    const method = (currentConfig.method || 'GET').toUpperCase();
    if (method === 'POST') {
      const { body, ...rest } = currentConfig;
      return await axios.post(url, body || {}, rest);
    }
    return await axios.get(url, currentConfig);
  } catch (error: any) {
    const status = error.response ? error.response.status : null;
    // Retry on 429 (Rate Limit) or 503 (Service Unavailable)
    if ((status === 429 || status === 503) && retries > 0) {
      // Exponential backoff with jitter
      const jitter = delay * 0.3 * (Math.random() * 2 - 1);
      const finalDelay = delay + jitter;
      
      console.warn(`[Axios Retry] Hit ${status} on ${url}. Retrying in ${Math.round(finalDelay)}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
      // Increase delay for next retry: 3s -> 6s -> 12s...
      return axiosGetWithRetry(url, currentConfig, retries - 1, delay * 2);
    }
    throw error;
  }
}

const subdlExtractCache = new SimpleMemoryCache<string>(15 * 24 * 60 * 60 * 1000); // 15 days ZIP extraction cache
const subtitleProxyCache = new SimpleMemoryCache<string>(15 * 24 * 60 * 60 * 1000); // 15 days proxy download cache
const searchResultsCache = new SimpleMemoryCache<any[]>(12 * 60 * 60 * 1000);   // 12 hours subtitle search results cache
const imdbIdCache = new SimpleMemoryCache<string>(30 * 24 * 60 * 60 * 1000); // 30 days IMDb ID mapping cache

const app = express();
const appApp = initializeApp(firebaseConfig);
const db = getFirestore(appApp, firebaseConfig.firestoreDatabaseId);
const PORT = 3000;

app.use(express.json());

function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Helper to normalize and proxy subtitle URLs
function resolveSubtitleUrl(url: string, baseHost: string = ''): string {
  if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null') return '';
  
  let finalUrl = url.trim();
  
  // Handle protocol-relative URLs
  if (finalUrl.startsWith('//')) {
    finalUrl = 'https:' + finalUrl;
  }
  
  // If it's a relative path, resolve it using the provided baseHost
  if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/api/') && baseHost) {
    const cleanBase = baseHost.endsWith('/') ? baseHost.slice(0, -1) : baseHost;
    const cleanPath = finalUrl.startsWith('/') ? finalUrl : '/' + finalUrl;
    finalUrl = cleanBase + cleanPath;
  }
  
  // Special handling for SubDL.com paths if still relative
  if (!finalUrl.startsWith('http') && (finalUrl.includes('subdl') || finalUrl.startsWith('subtitle/'))) {
    finalUrl = 'https://dl.subdl.com/' + (finalUrl.startsWith('/') ? finalUrl.slice(1) : finalUrl);
  }
  
  // Always proxy external URLs to handle CORS, SRT->VTT, and Encoding detection
  if (finalUrl.startsWith('http')) {
    return `/api/subtitles/proxy?url=${encodeURIComponent(finalUrl)}`;
  }
  
  return finalUrl;
}

// Helper to resolve IMDb ID from TMDB search
async function resolveImdbIdFromTmdb(title: string, type: 'movie' | 'series' = 'movie'): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY || "5201b54eb0968700e693a30576d7d4dc";
  const searchTypes: ('movie' | 'tv')[] = type === 'series' ? ['tv', 'movie'] : ['movie', 'tv'];

  for (const sType of searchTypes) {
    try {
      console.log(`[TMDB Resolver] Searching TMDB (${sType}) for title: "${title}"`);
      // 1. Search with Vietnamese or English locale
      let searchRes = await axios.get(`https://api.themoviedb.org/3/search/${sType}`, {
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

      // Fallback search: remove accents for better mapping
      if (results.length === 0) {
        const cleanTitle = removeVietnameseAccents(title);
        if (cleanTitle !== title) {
          console.log(`[TMDB Resolver] Fallback search without accents: "${cleanTitle}"`);
          const accentFreeRes = await axios.get(`https://api.themoviedb.org/3/search/${sType}`, {
            params: {
              api_key: apiKey,
              query: cleanTitle
            }
          });
          results = accentFreeRes.data?.results || [];
        }
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

async function fetchAndExtractSubtitle(url: string): Promise<string> {
  let subtitleUrl = url;
  
  // Handle protocol-relative URLs
  if (subtitleUrl.startsWith('//')) {
    subtitleUrl = 'https:' + subtitleUrl;
  }

  if (!subtitleUrl.startsWith('http')) {
    throw new Error('Invalid subtitle url protocol');
  }

  let referer = '';
  try {
    referer = new URL(subtitleUrl).origin;
    // Force SubDL referer if it's a subdl URL
    if (subtitleUrl.includes('subdl.com')) {
      referer = 'https://subdl.com/';
    }
  } catch (e) {
    // Ignore
  }

  const response = await axiosGetWithRetry(subtitleUrl, {
    responseType: 'arraybuffer', // Use arraybuffer to handle potential encoding issues
    timeout: 15000, // Increased timeout for slow subtitle servers
    headers: {
      ...(referer ? { 'Referer': referer } : {})
    }
  });

  let vttContent = "";
  const contentType = response.headers['content-type'] || '';
  const isZip = contentType.includes('zip') || subtitleUrl.toLowerCase().split('?')[0].endsWith('.zip');

  const decodeBuffer = (buffer: Buffer): string => {
    try {
      const detection = jschardet.detect(buffer);
      let encoding = detection.encoding || 'utf-8';
      
      // Jschardet sometimes misidentifies Windows-1252/1258 as something else
      if (encoding.toLowerCase() === 'ascii' || detection.confidence < 0.8) {
        encoding = 'utf-8';
      }
      
      let decoded = iconv.decode(buffer, encoding);
      
      // Handle Byte Order Mark (BOM)
      if (decoded.charCodeAt(0) === 0xFEFF) {
        decoded = decoded.slice(1);
      }
      
      // Double check for garbled text (Vietnamese specific check)
      if (decoded.includes('')) {
        decoded = iconv.decode(buffer, 'windows-1258');
      }
      
      return decoded;
    } catch (err) {
      console.warn('[Proxy] Encoding detection failed, falling back to utf-8');
      return buffer.toString('utf-8');
    }
  };

  if (isZip) {
    // Handle ZIP extraction transparently in the proxy
    const zip = new AdmZip(Buffer.from(response.data));
    const zipEntries = zip.getEntries();
    
    // Sophisticated searching for Vietnamese subtitles
    const viKeywords = ['viet', 'vi.', 'vi-', 'vie.', 'vie-', 'vn.', 'vn-'];
    
    // 1. Look for VTT first (preferred)
    let vttEntry = zipEntries.find(entry => {
      if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.vtt')) return false;
      const name = entry.entryName.toLowerCase();
      return viKeywords.some(kw => name.includes(kw)) || name.includes('vietnamese');
    });
    
    // 2. Look for SRT if no VTT found
    let srtEntry = zipEntries.find(entry => {
      if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.srt')) return false;
      const name = entry.entryName.toLowerCase();
      return viKeywords.some(kw => name.includes(kw)) || name.includes('vietnamese');
    });

    // 3. Fallback to any VTT
    if (!vttEntry && !srtEntry) {
      vttEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.vtt'));
    }
    
    // 4. Fallback to any SRT
    if (!vttEntry && !srtEntry) {
      srtEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.srt'));
    }
    
    // 5. Final fallback: largest non-directory file that might be a subtitle
    if (!srtEntry && !vttEntry) {
      const candidates = zipEntries.filter(e => !e.isDirectory && e.header.size > 100);
      if (candidates.length > 0) {
        const largest = candidates.sort((a, b) => b.header.size - a.header.size)[0];
        const name = largest.entryName.toLowerCase();
        if (name.endsWith('.srt')) srtEntry = largest;
        else if (name.endsWith('.vtt')) vttEntry = largest;
        else srtEntry = largest;
      }
    }

    if (vttEntry) {
      const buffer = vttEntry.getData();
      vttContent = decodeBuffer(buffer);
    } else if (srtEntry) {
      const buffer = srtEntry.getData();
      vttContent = srtToVtt(decodeBuffer(buffer));
    } else {
      throw new Error('No valid subtitle file found in ZIP');
    }
  } else {
    vttContent = decodeBuffer(Buffer.from(response.data));
    if (!contentType.includes('vtt')) {
      vttContent = srtToVtt(vttContent);
    }
  }
  return vttContent;
}

// Global IMDb ID Resolver
async function getImdbId(idOrTitle: string, type: 'movie' | 'series' = 'movie'): Promise<string | null> {
  if (!idOrTitle) return null;
  
  const cacheKey = `imdb_${idOrTitle}_${type}`;
  const cached = imdbIdCache.get(cacheKey);
  if (cached) return cached;
  
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

  const resolved = await resolveImdbIdFromTmdb(titleQuery, type);
  if (resolved) {
    imdbIdCache.set(cacheKey, resolved);
  }
  return resolved;
}

// Subsource API integration - Search
app.get("/api/subsource/search", async (req, res) => {
  const { imdb_id, type = 'movie' } = req.query;
  const SUBSOURCE_API_KEY = process.env.SUBSOURCE_API_KEY;

  if (!imdb_id || typeof imdb_id !== 'string') {
    return res.status(400).json({ error: "Missing or invalid imdb_id" });
  }

  if (!SUBSOURCE_API_KEY) {
    return res.status(500).json({ error: "SUBSOURCE_API_KEY not configured" });
  }

  try {
    const searchRes = await axios.get(`https://api.subsource.net/api/v1/subtitles`, {
      headers: {
        'X-API-Key': SUBSOURCE_API_KEY
      },
      params: {
        imdb_id: imdb_id,
        languages: "vi,en"
      }
    });

    if (!searchRes.data || !searchRes.data.subtitles) {
      return res.status(404).json({ error: "No subtitles found" });
    }

    const subtitles = searchRes.data.subtitles.map((sub: any) => ({
        url: sub.download_url,
        lang: sub.language || 'vie',
        langName: `${sub.language || 'vie'} (SubSource)`,
        addon: 'SubSource API',
        id: sub.id
    }));

    res.json({ subtitles });
  } catch (error: any) {
    console.error('SubSource search error:', error.message);
    res.status(500).json({ error: "Failed to search subtitles from SubSource" });
  }
});

// SubDL API integration - Extract (Old Method Restored)
app.get("/api/subtitles/proxy-cached", async (req, res) => {
  const { url, movieId } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).send('Invalid URL');
  
  const subtitleDocRef = doc(db, 'subtitles', encodeURIComponent(url));
  const docSnap = await getDoc(subtitleDocRef);
  
  if (docSnap.exists()) {
    const content = docSnap.data().fileContent;
    // Always decode as it is stored as base64
    const decoded = Buffer.from(content, 'base64').toString('utf-8');
    return res.send(decoded);
  }
  
  // Fetch from source, cache, return
  try {
    const vttContent = await fetchAndExtractSubtitle(url);
    const fileContent = Buffer.from(vttContent).toString('base64');
    
    await setDoc(subtitleDocRef, {
      movieId: movieId || 'unknown',
      fileUrl: url,
      fileContent: fileContent,
      addedBy: 'system'
    });
    
    return res.send(vttContent); // Send raw text!
  } catch (error) {
    console.error('Error fetching/caching subtitle:', error);
    return res.status(500).send('Error fetching subtitle');
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
    console.warn('OpenSubtitles search warning (handled gracefully):', error.response?.data || error.message);
    res.json({ 
      success: true, 
      subtitles: [],
      warning: "OpenSubtitles API is temporarily rate-limited or unavailable"
    });
  }
});

// Endpoint to get download link for OpenSubtitles
app.get("/api/opensubtitles/download", async (req, res) => {
  const { file_id } = req.query;
  const API_KEY = process.env.OPENSUBTITLES_API_KEY || "xhGcgu63tcMZ8VuurzJqXTYAIskDyBAr";
  const USER_AGENT = process.env.OPENSUBTITLES_USER_AGENT || "Cineflix";

  if (!file_id || isNaN(Number(file_id))) {
    return res.status(400).send("Missing or invalid file_id");
  }

  try {
    const downloadRes = await axiosGetWithRetry(`https://api.opensubtitles.com/api/v1/download`, 
      { 
        method: 'POST',
        body: { file_id: Number(file_id) },
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
    
    if (subtitleUrl && (subtitleUrl.startsWith('http') || subtitleUrl.startsWith('//'))) {
      res.redirect(`/api/subtitles/proxy?url=${encodeURIComponent(subtitleUrl)}`);
    } else {
      console.error('[OpenSubtitles] Invalid download link received:', subtitleUrl);
      res.status(500).send("Invalid download link received from OpenSubtitles");
    }

  } catch (error: any) {
    console.error('OpenSubtitles download error:', error.response?.data || error.message);
    res.status(500).send("OpenSubtitles download error");
  }
});

// Helper to convert SRT to WebVTT
function srtToVtt(srt: string): string {
  if (!srt) return 'WEBVTT\n\n';
  
  // Normalize newlines
  let text = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  // If it's already VTT, just ensure it has a proper header
  if (text.trim().startsWith('WEBVTT')) {
    if (!text.startsWith('WEBVTT\n\n')) {
      text = text.replace(/^WEBVTT\s*/, 'WEBVTT\n\n');
    }
    return text;
  }

  // Robust SRT to VTT conversion
  // 1. Convert timestamp format: 00:00:00,000 -> 00:00:00.000
  // Supporting various spacing and timestamp formats
  text = text.replace(/(\d{1,2}:\d{2}:\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2})[,.](\d{1,3})/g, (match, hms1, ms1, hms2, ms2) => {
    const formatTime = (hms: string, ms: string) => {
      let [h, m, s] = hms.split(':');
      return `${h.padStart(2, '0')}:${m}:${s}.${ms.padEnd(3, '0')}`;
    };
    return `${formatTime(hms1, ms1)} --> ${formatTime(hms2, ms2)}`;
  });

  // 2. Remove SRT sequence numbers (lines containing only digits)
  // 3. Ensure WEBVTT header
  const lines = text.split('\n');
  const vttLines = [];
  vttLines.push('WEBVTT');
  vttLines.push('');

  for (let line of lines) {
    // Skip lines that are just numbers (sequence identifiers)
    if (/^\d+$/.test(line.trim())) continue;
    vttLines.push(line);
  }
  
  return vttLines.join('\n');
}

// Helper to clean search titles for movie/series database queries
function cleanSearchTitle(titleStr: string): string {
  if (!titleStr) return "";
  let s = titleStr.trim();
  // Strip parenthesized years e.g., (2022) or (Hoạt hình)
  s = s.replace(/\s*\([^)]*\)/g, "");
  // Strip common season references
  s = s.replace(/\s*(phần|Phần|season|Season|ss|SS|ss|Tập|tập)\s*\d+/gi, "");
  // Strip common trailer or metadata prefixes
  s = s.replace(/\s*-\s*(Thuyết Minh|Vietsub|Lồng Tiếng|Full|Trọn Bộ)/gi, "");
  return s.trim();
}

// Normalize language names to standard readable format for the player
function normalizeLanguageLabel(lang: string, addonName: string): { langCode: string, langName: string } {
  const l = (lang || '').toLowerCase();
  if (l.includes('vi') || l.includes('vie') || l.includes('viet')) {
    return {
      langCode: 'vie',
      langName: `Tiếng Việt (Vietsub - ${addonName}) 🇻🇳`
    };
  }
  if (l.includes('en') || l.includes('eng') || l.includes('english')) {
    return {
      langCode: 'eng',
      langName: `Tiếng Anh (English - ${addonName}) 🇬🇧`
    };
  }
  // Fallback
  return {
    langCode: l || 'unknown',
    langName: `${lang} (${addonName})`
  };
}

// Subtitles endpoint querying AIO Subtitle, SubDL addons, SubDL direct API, and OpenSubtitles API in parallel
app.get("/api/subtitles", async (req, res) => {
  try {
    const { id, type = 'movie', season, episode, title, originName, imdb_id } = req.query;
    if (!id && !imdb_id && !title && !originName) {
      return res.status(400).json({ error: 'Missing identifiers (id, imdb_id, title or originName)' });
    }

    // Check in-memory search results cache first to prevent spam/duplicate triggers
    const cacheKey = `${id || ''}_${imdb_id || ''}_${type}_${season || ''}_${episode || ''}_${title || ''}_${originName || ''}`;
    const cachedSearch = searchResultsCache.get(cacheKey);
    if (cachedSearch) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache search results for 1 hour in browser
      return res.json({ subtitles: cachedSearch });
    }

    let stremioId = String(id || imdb_id || '');
    let queryId = stremioId;
    if (stremioId.includes(':')) {
      const parts = stremioId.split(':');
      if (parts[1] && !parts[1].match(/^\d+$/)) {
        queryId = parts[1];
      } else {
        queryId = parts.find(p => !p.match(/^\d+$/) && p !== 'series' && p !== 'movie' && p !== 'anime') || parts[0];
      }
    }

    const seasonNum = season ? parseInt(String(season), 10) : 1;
    const epNum = episode ? parseInt(String(episode), 10) : 1;

    // Resolve IMDb ID for querying AIO, SubDL Stremio addons, OpenSubtitles addon & REST API
    let resolvedImdbId = (imdb_id && typeof imdb_id === 'string' && imdb_id.startsWith('tt')) ? imdb_id : null;
    
    if (!resolvedImdbId) {
      // Parallel resolution attempt for extreme speed
      const searchTasks = [];
      
      if (originName) {
        const cleaned = cleanSearchTitle(String(originName));
        if (cleaned) searchTasks.push(getImdbId(cleaned, type === 'series' ? 'series' : 'movie'));
      }
      if (title) {
        const cleaned = cleanSearchTitle(String(title));
        if (cleaned) searchTasks.push(getImdbId(cleaned, type === 'series' ? 'series' : 'movie'));
      }
      if (queryId) {
        const cleaned = cleanSearchTitle(queryId);
        if (cleaned) searchTasks.push(getImdbId(cleaned, type === 'series' ? 'series' : 'movie'));
      }

      const results = await Promise.all(searchTasks);
      resolvedImdbId = results.find(r => r && r.startsWith('tt')) || null;
    }

    if (resolvedImdbId) {
      console.log(`[API Subtitles] Resolved IMDb ID: "${resolvedImdbId}" for queryId="${queryId}" (title="${title}", originName="${originName}")`);
    } else {
      console.warn(`[API Subtitles] Failed to resolve IMDb ID for title="${title}" (originName="${originName}"). Using raw queryId="${queryId}"`);
    }

    // Prepare query ids for various subtitle addons
    const imdbQueryId = resolvedImdbId ? (type === 'series' ? `${resolvedImdbId}:${seasonNum}:${epNum}` : resolvedImdbId) : null;
    const rawQueryId = type === 'series' ? `${queryId}:${seasonNum}:${epNum}` : queryId;

    // 1. AIO Subtitle Addon fetcher
    const fetchAio = async () => {
      const list: any[] = [];
      const aioUrls = [
        imdbQueryId ? `https://api.aiosubtitle.org/subtitles/${type}/${imdbQueryId}.json` : null,
        `https://api.aiosubtitle.org/subtitles/${type}/${rawQueryId}.json`
      ].filter(Boolean) as string[];

      for (const url of aioUrls) {
        try {
          const response = await axiosGetWithRetry(url, { timeout: 3500 });
          if (response.data && Array.isArray(response.data.subtitles)) {
            response.data.subtitles.forEach((sub: any) => {
              if (!sub || !sub.url) return;
              
              const norm = normalizeLanguageLabel(sub.lang || sub.language, 'AIO Subtitle');
              const finalUrl = resolveSubtitleUrl(sub.url, 'https://api.aiosubtitle.org');

              list.push({
                ...sub,
                url: finalUrl,
                addon: 'AIO Subtitle',
                id: sub.id || sub.url,
                lang: norm.langCode,
                langName: norm.langName
              });
            });
            break;
          }
        } catch (err) {
          // Ignore
        }
      }
      return list;
    };

    // 2. SubDL Addon fetcher
    const fetchSubDlStremio = async () => {
      const list: any[] = [];
      const subdlUrls = [
        imdbQueryId ? `https://stremio.subdl.com/subtitles/${type}/${imdbQueryId}.json` : null,
        imdbQueryId ? `https://subdl.stremio.fun/subtitles/${type}/${imdbQueryId}.json` : null,
        `https://stremio.subdl.com/subtitles/${type}/${rawQueryId}.json`
      ].filter(Boolean) as string[];

      for (const url of subdlUrls) {
        try {
          const response = await axiosGetWithRetry(url, { timeout: 3500 });
          if (response.data && Array.isArray(response.data.subtitles)) {
            response.data.subtitles.forEach((sub: any) => {
              if (!sub || !sub.url) return;
              
              const norm = normalizeLanguageLabel(sub.lang || sub.language, 'SubDL Addon');
              const finalUrl = resolveSubtitleUrl(sub.url, url.replace('/subtitles', '').split('/.json')[0]);

              list.push({
                ...sub,
                url: finalUrl,
                addon: 'SubDL Addon',
                id: sub.id || sub.url,
                lang: norm.langCode,
                langName: norm.langName
              });
            });
            break;
          }
        } catch (err) {
          // Ignore
        }
      }
      return list;
    };

    // 3. OpenSubtitles Stremio Addon (V3) - Ultra fast, high quality, free-to-access
    const fetchOpenSubtitlesStremio = async () => {
      const list: any[] = [];
      if (!imdbQueryId) return list;

      const osUrls = [
        `https://opensubtitles-v3.strem.io/subtitles/${type}/${imdbQueryId}.json`
      ];

      for (const url of osUrls) {
        try {
          const response = await axiosGetWithRetry(url, { timeout: 4000 });
          if (response.data && Array.isArray(response.data.subtitles)) {
            response.data.subtitles.forEach((sub: any) => {
              if (!sub || !sub.url) return;
              
              const norm = normalizeLanguageLabel(sub.lang || sub.language, 'OpenSubtitles');
              const finalUrl = resolveSubtitleUrl(sub.url, 'https://opensubtitles-v3.strem.io');

              list.push({
                ...sub,
                url: finalUrl,
                addon: 'OpenSubtitles',
                id: sub.id || sub.url,
                lang: norm.langCode,
                langName: norm.langName
              });
            });
            break;
          }
        } catch (err) {
          // Ignore
        }
      }
      return list;
    };

    // 4. Direct SubDL API fetcher (custom ZIP extraction proxy)
    const fetchSubDlDirect = async () => {
      const list: any[] = [];
      if (!resolvedImdbId) return list;

      const SUBDL_API_KEY = "subdl_B_aIO1H-jyorIqf4B-DtIA5OUE1EBuapUlJebKMc27g";
      try {
        const searchRes = await axiosGetWithRetry(`https://api.subdl.com/api/v1/subtitles`, {
          params: {
            api_key: SUBDL_API_KEY,
            imdb_id: resolvedImdbId,
            languages: "vi,en",
            type: type === 'series' ? 'tv' : 'movie'
          },
          timeout: 6000
        });

        if (searchRes.data && searchRes.data.status !== false && Array.isArray(searchRes.data.subtitles)) {
          searchRes.data.subtitles
            .filter((sub: any) => sub && sub.url)
            .forEach((sub: any) => {
              const norm = normalizeLanguageLabel(sub.language, 'SubDL API');
              const finalUrl = resolveSubtitleUrl(sub.url, 'https://dl.subdl.com');

              list.push({
                url: finalUrl,
                lang: norm.langCode,
                langName: norm.langName,
                addon: 'SubDL API',
                id: sub.url
              });
            });
        }
      } catch (err) {
        // Ignore
      }
      return list;
    };

    // 5. OpenSubtitles Direct API fetcher (official REST API)
    const fetchOpenSubtitlesDirect = async () => {
      const list: any[] = [];
      const API_KEY = process.env.OPENSUBTITLES_API_KEY || "xhGcgu63tcMZ8VuurzJqXTYAIskDyBAr";
      const USER_AGENT = process.env.OPENSUBTITLES_USER_AGENT || "Cineflix";

      const params: any = {
        languages: 'vi,en'
      };

      if (resolvedImdbId) {
        params.imdb_id = resolvedImdbId.substring(2);
      } else if (originName) {
        params.query = cleanSearchTitle(String(originName));
      } else if (title) {
        params.query = cleanSearchTitle(String(title));
      } else {
        return list;
      }

      try {
        const searchRes = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles`, {
          params,
          headers: {
            'Api-Key': API_KEY,
            'User-Agent': USER_AGENT
          },
          timeout: 4000
        });

        if (searchRes.data && Array.isArray(searchRes.data.data)) {
          searchRes.data.data.forEach((item: any) => {
            const file = item.attributes.files[0];
            if (file && file.file_id) {
              const norm = normalizeLanguageLabel(item.attributes.language, 'OpenSubtitles API');
              list.push({
                id: `os-${file.file_id}`,
                file_id: file.file_id,
                lang: norm.langCode,
                langName: norm.langName,
                addon: 'OpenSubtitles API',
                url: `/api/opensubtitles/download?file_id=${file.file_id}`
              });
            }
          });
        }
      } catch (err) {
        // Ignore
      }
      return list;
    };

    // 6. SubSource API fetcher
    const fetchSubSource = async () => {
      const list: any[] = [];
      if (!resolvedImdbId) return list;
      
      try {
        console.log('[API Subtitles] Checking SubSource API Key:', process.env.SUBSOURCE_API_KEY ? 'Present' : 'Missing');
        const response = await axios.get(`https://api.subsource.net/api/v1/subtitles`, {
            headers: { 'X-API-Key': process.env.SUBSOURCE_API_KEY || '' },
            params: { imdb_id: resolvedImdbId, languages: "vi,en" },
            timeout: 3500
        });
        if (response.data && Array.isArray(response.data.subtitles)) {
            response.data.subtitles.forEach((sub: any) => {
                list.push({
                    url: sub.download_url,
                    lang: sub.language || 'vie',
                    langName: `${sub.language || 'vie'} (SubSource)`,
                    addon: 'SubSource API',
                    id: sub.id
                });
            });
        }
      } catch (err) {
        console.warn('[API Subtitles] SubSource fetch error:', err);
      }
      return list;
    };

    // Simplify to only reliable direct fetchers
    const results = await Promise.allSettled([
      fetchOpenSubtitlesDirect()
    ]);

    const combined: any[] = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        combined.push(...r.value);
      }
    });

    // Deduplicate subtitles strictly by download URL
    const seenUrls = new Set<string>();
    const uniqueSubs: any[] = [];
    for (const sub of combined) {
      if (!sub.url) continue;
      if (!seenUrls.has(sub.url)) {
        seenUrls.add(sub.url);
        uniqueSubs.push(sub);
      }
    }

    // Sort: Always prioritize Vietnamese/Vietsub (wie/vi/viet) to the absolute top of the list
    uniqueSubs.sort((a, b) => {
      const aLang = (a.lang || '').toLowerCase();
      const aName = (a.langName || '').toLowerCase();
      const bLang = (b.lang || '').toLowerCase();
      const bName = (b.langName || '').toLowerCase();
      
      const aIsVi = aLang.includes('vi') || aLang.includes('vie') || aName.includes('viet');
      const bIsVi = bLang.includes('vi') || bLang.includes('vie') || bName.includes('viet');
      
      if (aIsVi && !bIsVi) return -1;
      if (!aIsVi && bIsVi) return 1;
      return 0;
    });

    // Save in search cache
    searchResultsCache.set(cacheKey, uniqueSubs);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ subtitles: uniqueSubs });

  } catch (error: any) {
    console.error('Error fetching subtitles:', error.message);
    res.json({ subtitles: [] });
  }
});

// Proxy subtitle file to parse SRT to VTT and bypass CORS
app.get("/api/subtitles/proxy", async (req, res) => {
  let subtitleUrl = req.query.url as string;
  try {
    if (!subtitleUrl || subtitleUrl === 'undefined' || subtitleUrl === 'null') {
      console.error('[Proxy] Missing or invalid subtitle URL:', subtitleUrl);
      return res.status(400).send('Missing or invalid subtitle url');
    }

    // Handle protocol-relative URLs
    if (subtitleUrl.startsWith('//')) {
      subtitleUrl = 'https:' + subtitleUrl;
    }

    if (!subtitleUrl.startsWith('http')) {
      console.error('[Proxy] Invalid subtitle URL protocol:', subtitleUrl);
      return res.status(400).send('Invalid subtitle url protocol');
    }

    // Check cache first
    const cachedContent = subtitleProxyCache.get(subtitleUrl);
    if (cachedContent) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      return res.send(cachedContent);
    }

    let referer = '';
    try {
      referer = new URL(subtitleUrl).origin;
      // Force SubDL referer if it's a subdl URL
      if (subtitleUrl.includes('subdl.com')) {
        referer = 'https://subdl.com/';
      }
    } catch (e) {
      // Ignore
    }

    const response = await axiosGetWithRetry(subtitleUrl, {
      responseType: 'arraybuffer', // Use arraybuffer to handle potential encoding issues
      timeout: 15000, // Increased timeout for slow subtitle servers
      headers: {
        ...(referer ? { 'Referer': referer } : {})
      }
    });

    let vttContent = "";
    const contentType = response.headers['content-type'] || '';
    const isZip = contentType.includes('zip') || subtitleUrl.toLowerCase().split('?')[0].endsWith('.zip');

    const decodeBuffer = (buffer: Buffer): string => {
      try {
        const detection = jschardet.detect(buffer);
        let encoding = detection.encoding || 'utf-8';
        
        // Jschardet sometimes misidentifies Windows-1252/1258 as something else
        if (encoding.toLowerCase() === 'ascii' || detection.confidence < 0.8) {
          encoding = 'utf-8';
        }
        
        let decoded = iconv.decode(buffer, encoding);
        
        // Handle Byte Order Mark (BOM)
        if (decoded.charCodeAt(0) === 0xFEFF) {
          decoded = decoded.slice(1);
        }
        
        // Double check for garbled text (Vietnamese specific check)
        if (decoded.includes('')) {
          decoded = iconv.decode(buffer, 'windows-1258');
        }
        
        return decoded;
      } catch (err) {
        console.warn('[Proxy] Encoding detection failed, falling back to utf-8');
        return buffer.toString('utf-8');
      }
    };

    if (isZip) {
      // Handle ZIP extraction transparently in the proxy
      const zip = new AdmZip(Buffer.from(response.data));
      const zipEntries = zip.getEntries();
      
      // Sophisticated searching for Vietnamese subtitles
      const viKeywords = ['viet', 'vi.', 'vi-', 'vie.', 'vie-', 'vn.', 'vn-'];
      
      // 1. Look for VTT first (preferred)
      let vttEntry = zipEntries.find(entry => {
        if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.vtt')) return false;
        const name = entry.entryName.toLowerCase();
        return viKeywords.some(kw => name.includes(kw)) || name.includes('vietnamese');
      });
      
      // 2. Look for SRT if no VTT found
      let srtEntry = zipEntries.find(entry => {
        if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.srt')) return false;
        const name = entry.entryName.toLowerCase();
        return viKeywords.some(kw => name.includes(kw)) || name.includes('vietnamese');
      });

      // 3. Fallback to any VTT
      if (!vttEntry && !srtEntry) {
        vttEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.vtt'));
      }
      
      // 4. Fallback to any SRT
      if (!vttEntry && !srtEntry) {
        srtEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.srt'));
      }
      
      // 5. Final fallback: largest non-directory file that might be a subtitle
      if (!srtEntry && !vttEntry) {
        const candidates = zipEntries.filter(e => !e.isDirectory && e.header.size > 100);
        if (candidates.length > 0) {
          const largest = candidates.sort((a, b) => b.header.size - a.header.size)[0];
          const name = largest.entryName.toLowerCase();
          if (name.endsWith('.srt')) srtEntry = largest;
          else if (name.endsWith('.vtt')) vttEntry = largest;
          else srtEntry = largest;
        }
      }

      if (vttEntry) {
        const buffer = vttEntry.getData();
        vttContent = decodeBuffer(buffer);
      } else if (srtEntry) {
        const buffer = srtEntry.getData();
        vttContent = srtToVtt(decodeBuffer(buffer));
      } else {
        throw new Error("No subtitle found in ZIP archive after exhaustive search");
      }
    } else {
      // Handle direct file
      const buffer = Buffer.from(response.data);
      let content = decodeBuffer(buffer);

      if (content.trim().startsWith('WEBVTT') || subtitleUrl.toLowerCase().includes('.vtt')) {
        vttContent = content;
      } else {
        vttContent = srtToVtt(content);
      }
    }

    if (!vttContent.trim().startsWith('WEBVTT')) {
      vttContent = 'WEBVTT\n\n' + vttContent;
    }

    // Save in cache
    subtitleProxyCache.set(subtitleUrl, vttContent);

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    res.send(vttContent);
  } catch (error: any) {
    const status = error.response ? error.response.status : 500;
    if (status === 429) {
      console.warn(`[Subtitle Proxy] 429 Rate Limit for: ${subtitleUrl}`);
      const fallbackVtt = "WEBVTT\n\n00:00:00.000 --> 00:00:10.000\n[Hệ thống tải phụ đề đang quá tải, vui lòng tải lại trang hoặc thử lại sau vài giây]\n";
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(fallbackVtt);
    }
    console.error('Error proxying subtitle:', error.message);
    res.status(status).send(`Failed to fetch subtitle file: ${error.message}`);
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

// NguonC Proxy endpoints
app.get("/api/nguonc/film/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const response = await axios.get(`https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    res.json(response.data);
  } catch (error: any) {
    const status = error.response ? error.response.status : 500;
    if (status === 404) {
      console.log(`[NguonC Proxy] Film "${slug}" not found on NguonC (404)`);
      return res.status(404).json({ error: 'Film not found on NguonC', status: false });
    }
    console.error(`Error fetching NguonC film "${slug}":`, error.message);
    res.status(status).json({ error: 'Failed to fetch film details', details: error.message });
  }
});

app.get("/api/nguonc/films/*", async (req, res) => {
  try {
    const subPath = req.params[0];
    const queryStr = new URLSearchParams(req.query as any).toString();
    const url = `https://phim.nguonc.com/api/films/${subPath}${queryStr ? '?' + queryStr : ''}`;
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching NguonC films subpath:', error.message);
    res.status(500).json({ error: 'Failed to fetch catalog' });
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

// HLS m3u8 and segment CORS bypass proxy for NguonC / OPStream
app.get("/api/m3u8-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('Invalid url parameter');
  }

  try {
    const isM3u8 = targetUrl.toLowerCase().split('?')[0].endsWith('.m3u8') || targetUrl.includes('m3u8');
    
    // Determine the best Referer based on the target domain
    let referer = 'https://phim.nguonc.com';
    if (targetUrl.includes('opstream') || targetUrl.includes('vip.opstream')) {
      referer = 'https://opstream.com/';
    }

    if (isM3u8) {
      const response = await axiosGetWithRetry(targetUrl, {
        responseType: 'text',
        headers: {
          'Referer': referer,
          'Origin': new URL(targetUrl).origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 12000
      });

      const playlistText = response.data;
      const lines = playlistText.split('\n');
      const rewrittenLines = lines.map((line: string) => {
        const trimmed = line.trim();
        if (trimmed === '') return line;

        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
            try {
              const absolute = new URL(p1, targetUrl).href;
              return `URI="/api/m3u8-proxy?url=${encodeURIComponent(absolute)}"`;
            } catch (e) {
              return match;
            }
          });
        }

        try {
          const absoluteUrl = new URL(trimmed, targetUrl).href;
          return `/api/m3u8-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } catch (e) {
          return line;
        }
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(rewrittenLines.join('\n'));
    } else {
      // Binary stream for TS segment or encryption key
      const response = await axiosGetWithRetry(targetUrl, {
        responseType: 'stream',
        headers: {
          'Referer': referer,
          'Origin': new URL(targetUrl).origin,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', String(response.headers['content-type']));
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', String(response.headers['content-length']));
      }
      response.data.pipe(res);
    }
  } catch (error: any) {
    const status = error.response ? error.response.status : 500;
    console.error(`[m3u8 Proxy Error] status: ${status}, url: ${targetUrl}, msg: ${error.message}`);
    res.status(status).send(`Failed to proxy media segment: ${error.message}`);
  }
});

export default app;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  // Only start the listening server if we are not in a serverless environment (like Vercel)
  // or if we are in development mode.
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
