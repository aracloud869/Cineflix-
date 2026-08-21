export function mapSourceName(name: string, streamTitle?: string): string {
  if (!name) return 'OP(Vietsub)';
  const n = (name + ' ' + (streamTitle || '')).toLowerCase();
  
  // Detect audio / subtitle mode
  let audioType = '';
  if (n.includes('lồng tiếng') || n.includes('long tieng') || n.includes('lồngtiếng') || n.includes('longtieng') || /\b(lt|dub|dubbed)\b/i.test(n)) {
    audioType = '(Lồng Tiếng)';
  } else if (n.includes('thuyết minh') || n.includes('thuyet minh') || n.includes('thuyếtminh') || n.includes('thuyetminh') || /\b(tm|voiceover)\b/i.test(n)) {
    audioType = '(Thuyết Minh)';
  } else if (n.includes('vietsub') || n.includes('phụ đề') || n.includes('phu de') || n.includes('sub') || /\b(vs|vsub)\b/i.test(n)) {
    audioType = '(Vietsub)';
  } else if (n.includes('embed') || n.includes('iframe')) {
    audioType = '(Embed)';
  } else {
    audioType = '(Vietsub)';
  }

  // Detect base abbreviated source: OP, KK, NC, STP, HH3D, VSMOV, VIP
  let baseSource = 'OP';
  if (n.includes('hh3d') || n.includes('hoathinh') || n.includes('3d')) {
    baseSource = 'HH3D';
  } else if (n.includes('ophim') || n.includes('opstream') || n.includes('op')) {
    baseSource = 'OP';
  } else if (n.includes('kkphim') || n.includes('phimapi') || n.includes('kk')) {
    baseSource = 'KK';
  } else if (n.includes('nguonc') || n.includes('streamc') || n.includes('nc')) {
    baseSource = 'NC';
  } else if (n.includes('sieutam') || n.includes('stp') || n.includes('abyss')) {
    baseSource = 'STP';
  } else if (n.includes('vsmov') || n.includes('vmos') || n.includes('vm')) {
    baseSource = 'VM';
  } else if (n.includes('vip')) {
    baseSource = 'VIP';
  } else {
    const cleaned = name.replace(/server|embed|m3u8|hls/gi, '').trim();
    baseSource = cleaned ? cleaned.slice(0, 6).toUpperCase() : 'OP';
  }

  return `${baseSource}${audioType}`;
}

export function detectAudioInfo(text?: string, lang?: string, streams?: any[]): { audio: string; audioFull: string } {
  let pool = ((text || '') + ' ' + (lang || '')).toLowerCase();
  
  if (streams && Array.isArray(streams)) {
    streams.forEach(s => {
      pool += ' ' + ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.sourceName || '')).toLowerCase();
    });
  }

  // Check for Vietsub / Phụ đề
  const hasVS = (
    pool.includes('vietsub') || 
    pool.includes('viet sub') || 
    pool.includes('phụ đề') || 
    pool.includes('phu de') || 
    pool.includes('vsub') || 
    /\b(sub|vs|vsub)\b/i.test(pool)
  );

  // Check for Lồng Tiếng
  const hasLT = (
    pool.includes('lồng tiếng') || 
    pool.includes('long tieng') || 
    pool.includes('lồngtiếng') || 
    pool.includes('longtieng') || 
    /\b(lt|dub|dubbed)\b/i.test(pool)
  );

  // Check for Thuyết Minh
  const hasTM = (
    pool.includes('thuyết minh') || 
    pool.includes('thuyet minh') || 
    pool.includes('thuyếtminh') || 
    pool.includes('thuyetminh') || 
    /\b(tm|voiceover)\b/i.test(pool)
  );

  const tags: string[] = [];
  const fullTags: string[] = [];

  if (hasVS) {
    tags.push('VS');
    fullTags.push('Vietsub');
  }
  if (hasTM) {
    tags.push('TM');
    fullTags.push('Thuyết Minh');
  }
  if (hasLT) {
    tags.push('LT');
    fullTags.push('Lồng Tiếng');
  }

  // If nothing detected explicitly, default to Vietsub (VS)
  if (tags.length === 0) {
    tags.push('VS');
    fullTags.push('Vietsub');
  }

  return {
    audio: tags.join('+'),
    audioFull: fullTags.join(' + '),
  };
}

export function detectQualityInfo(text?: string, rawQuality?: string): { quality: string; qualityFull: string } {
  const pool = ((text || '') + ' ' + (rawQuality || '')).toLowerCase();

  if (pool.includes('4k') || pool.includes('uhd') || pool.includes('2160') || pool.includes('ultra hd')) {
    return { quality: '4K', qualityFull: '4K Ultra HD' };
  }
  if (pool.includes('cam') || pool.includes('ts') || pool.includes('tc') || pool.includes('hdcam') || pool.includes('bản cam')) {
    return { quality: 'CAM', qualityFull: 'Bản CAM' };
  }
  if (pool.includes('hd-rip') || pool.includes('hdrip') || pool.includes('web-rip') || pool.includes('webrip')) {
    return { quality: 'HD-Rip', qualityFull: 'HD-Rip' };
  }
  if (pool.includes('1080') || pool.includes('fhd') || pool.includes('full hd') || pool.includes('fullhd') || pool.includes('1080p')) {
    return { quality: 'FHD', qualityFull: 'Full HD 1080p' };
  }
  if (pool.includes('720') || pool.includes('720p') || /\bhd\b/i.test(pool)) {
    return { quality: 'HD', qualityFull: 'HD 720p' };
  }

  return { quality: 'FHD', qualityFull: 'Full HD 1080p' };
}

export function detectMovieType(movieOrItem: any): { type: 'movie' | 'series' | 'anime'; typeLabel: string } {
  if (!movieOrItem) return { type: 'movie', typeLabel: 'Phim Lẻ' };
  
  const id = String(movieOrItem.id || movieOrItem._id || movieOrItem.slug || '').toLowerCase();
  const name = String(movieOrItem.name || movieOrItem.title || '').toLowerCase();
  const rawType = String(movieOrItem.type || '').toLowerCase();
  const epTotal = String(movieOrItem.episode_total || movieOrItem.total_episodes || '').toLowerCase();
  const epCurrent = String(movieOrItem.episode_current || movieOrItem.current_episode || '').toLowerCase();

  // Check Anime / 3D Hoạt Hình first
  if (
    rawType === 'anime' || 
    rawType === 'hoathinh' || 
    id.includes('hh3d') || 
    name.includes('hoạt hình') || 
    name.includes('hoathinh') || 
    name.includes('anime') || 
    name.includes('donghua') ||
    (name.includes('3d') && (name.includes('phần') || name.includes('tập') || name.includes('mùa')))
  ) {
    return { type: 'anime', typeLabel: '3D Anime' };
  }

  // Check Series (Phim Bộ)
  if (
    rawType === 'series' || 
    rawType === 'tvshows' || 
    rawType === 'phim-bo' ||
    id.includes('series') || 
    id.includes('phim-bo') || 
    id.includes('tv-shows') ||
    (epTotal && epTotal !== '1' && !epTotal.includes('full') && epTotal !== '1/1') ||
    (epCurrent && (epCurrent.includes('tập') || epCurrent.includes('ep')) && !epCurrent.includes('full')) ||
    (Array.isArray(movieOrItem.videos) && movieOrItem.videos.length > 1) ||
    name.includes('phần ') || 
    name.includes('mùa ') || 
    name.includes('season ') ||
    /\btập\s*\d+/i.test(name)
  ) {
    return { type: 'series', typeLabel: 'Phim Bộ' };
  }

  return { type: 'movie', typeLabel: 'Phim Lẻ' };
}

export function detectAudioQualityInfo(text?: string, lang?: string, streams?: any[]): { 
  audio: string; 
  audioFull: string; 
  quality: string; 
  qualityFull: string;
} {
  const a = detectAudioInfo(text, lang, streams);
  const q = detectQualityInfo(text, lang);
  return {
    audio: a.audio,
    audioFull: a.audioFull,
    quality: q.quality,
    qualityFull: q.qualityFull,
  };
}

export function extractSlug(id: string): string {
  if (!id) return '';
  // Remove prefixes like 'kkphim-series:', 'hh3d-series:', 'nguonc:', 'stp:'
  let clean = id.trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    clean = parts[1];
  }
  // Strip any trailing episode info if present
  return clean.replace(/-tap-\d+.*$/i, '').replace(/_ep\d+.*$/i, '').trim();
}

export function parseEpisodeInfo(id: string): { slug: string; season: number; episode: number } {
  if (!id) return { slug: '', season: 1, episode: 1 };
  const parts = id.split(':');
  const slug = extractSlug(id);
  
  let season = 1;
  let episode = 1;

  if (parts.length >= 4) {
    season = parseInt(parts[2], 10) || 1;
    episode = parseInt(parts[3], 10) || 1;
  } else if (parts.length === 3) {
    episode = parseInt(parts[2], 10) || 1;
  } else {
    const match = id.match(/t[aậ]p[-_\s]*(\d+)/i) || id.match(/ep[-_\s]*(\d+)/i) || id.match(/:(\d+)$/);
    if (match) {
      episode = parseInt(match[1], 10) || 1;
    }
  }

  return { slug, season, episode };
}

export function extractDirectMediaUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const clean = rawUrl.trim();

  // Try parsing query params for embedded video URL
  try {
    const parsed = new URL(clean);
    const candidateParams = ['url', 'link', 'v', 'file', 'source', 'm3u8', 'src', 'stream'];
    for (const p of candidateParams) {
      const val = parsed.searchParams.get(p);
      if (val) {
        let decoded = decodeURIComponent(val);
        if (decoded.startsWith('//')) decoded = 'https:' + decoded;
        if (decoded.includes('.m3u8') || decoded.includes('.mp4') || decoded.includes('/hls/')) {
          return decoded;
        }
      }
    }
  } catch (e) {}

  // If it's already a direct m3u8 or mp4 file
  const lower = clean.toLowerCase();
  if ((lower.includes('.m3u8') || lower.includes('.mp4') || lower.includes('/hls/')) && 
      !lower.includes('/share/') && 
      !lower.includes('embed') && 
      !lower.includes('/player/') &&
      !lower.includes('player.abyssplayer.com') &&
      !lower.includes('sieutamphim.com/player')) {
    return clean;
  }

  return null;
}

export function normalizeImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  if (!clean) return '';

  if (clean.startsWith('//')) {
    return 'https:' + clean;
  }
  if (clean.startsWith('/uploads/')) {
    return 'https://phimimg.com' + clean;
  }
  if (clean.startsWith('uploads/')) {
    return 'https://phimimg.com/' + clean;
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return 'https://' + clean;
  }
  return clean;
}

export function getPosterFallbackList(movie: {
  poster?: string;
  background?: string;
  slug?: string;
  id?: string;
  sourceIds?: string[];
}): string[] {
  const list: string[] = [];
  const add = (url?: string) => {
    const norm = normalizeImageUrl(url);
    if (norm && !list.includes(norm)) {
      list.push(norm);
    }
  };

  // 1. Primary poster
  add(movie.poster);
  // 2. Primary background
  add(movie.background);

  // 3. Extract slug
  const slug = movie.slug || extractSlug(movie.id || '');
  if (slug) {
    // 4. KKPhim / PhimApi domain
    add(`https://phimimg.com/uploads/movies/${slug}-poster.jpg`);
    add(`https://phimimg.com/uploads/movies/${slug}-thumb.jpg`);
    add(`https://phimimg.com/uploads/movies/${slug}.jpg`);

    // 5. Ophim domain
    add(`https://img.ophim1.com/uploads/movies/${slug}-poster.jpg`);
    add(`https://img.ophim1.com/uploads/movies/${slug}-thumb.jpg`);

    // 6. NguonC domain
    add(`https://phim.nguonc.com/uploads/${slug}.jpg`);
  }

  // 7. Check other source IDs if available
  if (movie.sourceIds && Array.isArray(movie.sourceIds)) {
    movie.sourceIds.forEach(srcId => {
      const srcSlug = extractSlug(srcId);
      if (srcSlug && srcSlug !== slug) {
        add(`https://phimimg.com/uploads/movies/${srcSlug}-poster.jpg`);
        add(`https://img.ophim1.com/uploads/movies/${srcSlug}-poster.jpg`);
      }
    });
  }

  return list;
}

export function cleanMediaUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = rawUrl.trim();
  if (!clean) return '';

  // Upgrade http to https for browser security and prevent Mixed Content blocking
  if (clean.startsWith('http://') && !clean.includes('localhost') && !clean.includes('127.0.0.1')) {
    clean = clean.replace('http://', 'https://');
  }
  if (clean.startsWith('//')) {
    clean = 'https:' + clean;
  }
  return clean;
}

export function detectStreamType(url?: string): 'mp4' | 'hls' | 'embed' {
  if (!url) return 'hls';
  const clean = cleanMediaUrl(url);
  const lower = clean.toLowerCase();

  // If it's a direct m3u8 or HLS stream
  if (lower.includes('.m3u8') || lower.includes('proxy-playlist') || lower.includes('/hls/')) {
    return 'hls';
  }

  // If it's a direct mp4/webm video
  if (lower.includes('.mp4') || lower.includes('/hx-mp4') || lower.includes('.mkv') || lower.includes('.webm')) {
    return 'mp4';
  }

  // If it's an iframe / web player / embed / abyss / sieutamphim link
  if (
    lower.includes('/share/') || 
    lower.includes('embed') || 
    lower.includes('/player') || 
    lower.includes('abyss') || 
    lower.includes('sieutam') || 
    lower.includes('streamc') ||
    lower.includes('short.ink') ||
    lower.includes('streamsilk') ||
    lower.includes('vidsrc') ||
    lower.includes('.html') ||
    lower.includes('.php') ||
    lower.includes('iframe')
  ) {
    return 'embed';
  }

  return 'hls';
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

