import axios from 'axios';
import { MetaPreview, Stream, UnifiedMovie, MetaDetailResponse, StreamResponse, CatalogResponse, Video } from './types';
import { 
  extractSlug, 
  detectStreamType, 
  mapSourceName, 
  normalizeImageUrl, 
  extractDirectMediaUrl, 
  parseEpisodeInfo, 
  detectAudioQualityInfo, 
  detectAudioInfo,
  detectQualityInfo,
  detectMovieType,
  cleanMediaUrl 
} from './utils';

export const SOURCES = [
  { id: 'kkphim-movie', name: 'KKPhim Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/kkphim-movie.json' },
  { id: 'kkphim-series', name: 'KKPhim Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/kkphim-series.json' },
  { id: 'nguonc-movie', name: 'Nguồn C Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/nguonc-movie.json' },
  { id: 'nguonc-series', name: 'Nguồn C Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/nguonc-series.json' },
  { id: 'stp-movie', name: 'Siêu Tầm Phim Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/stp-movie.json' },
  { id: 'stp-series', name: 'Siêu Tầm Phim Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/stp-series.json' },
  { id: 'hh3d-movie', name: 'Hoạt Hình 3D Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/hh3d-movie.json' },
  { id: 'hh3d-series', name: 'Hoạt Hình 3D Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/hh3d-series.json' },
  { id: 'vsmov-movie', name: 'VSMOV Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/vsmov-movie.json' },
  { id: 'vsmov-series', name: 'VSMOV Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/vsmov-series.json' },
  { id: 'clbpx-movie', name: 'CLBPX Phim Xưa Lẻ', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/clbpx-movie.json' },
  { id: 'clbpx-series', name: 'CLBPX Phim Xưa Bộ', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/clbpx-series.json' },
  { id: 'yan-movie', name: 'YAN Hoạt Hình', type: 'movie', url: 'https://sc.k-20.xyz/catalog/movie/yan-movie.json' },
  { id: 'ophim-movie', name: 'Ophim Lẻ', type: 'movie', url: '/api/ophim/catalog?slug=phim-le&type=movie' },
  { id: 'ophim-series', name: 'Ophim Bộ', type: 'series', url: '/api/ophim/catalog?slug=phim-bo&type=series' },
  { id: 'tr-movie', name: 'TR Phim Lẻ', type: 'movie', url: 'https://torrentsdb.com/stream/movie/' },
  { id: 'tr-series', name: 'TR Phim Bộ', type: 'series', url: 'https://torrentsdb.com/stream/series/' },
  { id: 'anime-vietsub', name: 'Anime Vietsub', type: 'anime', url: 'https://sc.k-20.xyz/catalog/anime/anime-vietsub.json' },
  { id: 'anime-tm', name: 'Anime Thuyết Minh', type: 'anime', url: 'https://sc.k-20.xyz/catalog/anime/anime-thuyet-minh.json' },
  { id: 'phim-han-quoc', name: 'Phim Hàn Quốc', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/phim-han-quoc.json' },
  { id: 'phim-trung-quoc', name: 'Phim Trung Quốc', type: 'series', url: 'https://sc.k-20.xyz/catalog/series/phim-trung-quoc.json' },
  { id: 'iptv-live', name: 'K20 Live TV 4K', type: 'tv', url: 'https://sc.k-20.xyz/catalog/tv/iptv-live.json' },
  { id: 'sports-live', name: 'K20 Thể Thao', type: 'tv', url: 'https://sc.k-20.xyz/catalog/tv/sports-live.json' }
];

export const GENRES_LIST = [
  { slug: 'hanh-dong', name: 'Hành Động' },
  { slug: 'co-trang', name: 'Cổ Trang' },
  { slug: 'tinh-cam', name: 'Tình Cảm' },
  { slug: 'vo-thuat', name: 'Võ Thuật' },
  { slug: 'kinh-di', name: 'Kinh Dị' },
  { slug: 'hai-huoc', name: 'Hài Hước' },
  { slug: 'khoa-hoc-vien-tuong', name: 'Khoa Học Viễn Tưởng' },
  { slug: 'hoat-hinh', name: 'Hoạt Hình' },
  { slug: 'phieu-luu', name: 'Phiêu Lưu' },
  { slug: 'tam-ly', name: 'Tâm Lý' },
  { slug: 'hoc-duong', name: 'Học Đường' },
  { slug: 'gia-dinh', name: 'Gia Đình' },
  { slug: 'chien-tranh', name: 'Chiến Tranh' },
  { slug: 'hinh-su', name: 'Hình Sự' },
  { slug: 'than-thoai', name: 'Thần Thoại' }
];

export const COUNTRIES_LIST = [
  { slug: 'trung-quoc', name: 'Trung Quốc' },
  { slug: 'han-quoc', name: 'Hàn Quốc' },
  { slug: 'au-my', name: 'Âu Mỹ' },
  { slug: 'nhat-ban', name: 'Nhật Bản' },
  { slug: 'thai-lan', name: 'Thái Lan' },
  { slug: 'viet-nam', name: 'Việt Nam' },
  { slug: 'dai-loan', name: 'Đài Loan' },
  { slug: 'hong-kong', name: 'Hồng Kông' },
  { slug: 'an-do', name: 'Ấn Độ' }
];

function normalizeName(name: string) {
  return name.toLowerCase()
    .replace(/vietsub|thuyết minh|lồng tiếng|bản đẹp|full hd|tập \d+|phần \d+|\(phần \d+\)/gi, '')
    .replace(/[-:_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function convertApiItemToMovie(item: any, defaultType: 'movie' | 'series' | 'anime' = 'movie', sourcePrefix = 'kkphim'): UnifiedMovie {
  const rawId = item._id || item.slug || item.id;
  const slug = item.slug || extractSlug(rawId);
  const id = `${sourcePrefix}:${slug}`;
  
  // Format poster and backdrop correctly
  const posterPath = item.poster_url || item.poster || item.thumb_url || '';
  let poster = normalizeImageUrl(posterPath);
  if (posterPath && !posterPath.startsWith('http') && !posterPath.startsWith('//')) {
    poster = `https://phimimg.com/${posterPath.replace(/^\//, '')}`;
  }

  const thumbPath = item.thumb_url || item.background || item.poster_url || '';
  let background = normalizeImageUrl(thumbPath);
  if (thumbPath && !thumbPath.startsWith('http') && !thumbPath.startsWith('//')) {
    background = `https://phimimg.com/${thumbPath.replace(/^\//, '')}`;
  }

  const rawQuality = item.quality || item.current_episode || '';
  const rawLang = item.lang || item.language || '';
  const combinedText = `${item.name || ''} ${item.origin_name || ''} ${rawQuality} ${item.content || item.description || ''}`;
  const audioInfo = detectAudioInfo(combinedText, rawLang);
  const qualityInfo = detectQualityInfo(combinedText, rawQuality);
  const movieType = detectMovieType({ ...item, id, defaultType });

  return {
    id,
    name: item.name || item.title || 'Phim',
    originName: item.origin_name || item.original_name,
    slug,
    poster: poster || background,
    background: background || poster,
    sourceIds: [id, `nguonc:${slug}`, `ophim:${slug}`, `stp:${slug}`],
    releaseInfo: (item.year ? item.year.toString() : (item.time || '2026')),
    rating: item.vote_average ? (item.vote_average.toString().slice(0, 3)) : ('8.' + (Math.floor(Math.random() * 8) + 1)),
    quality: qualityInfo.quality,
    lang: audioInfo.audio,
    type: movieType.type,
    overview: item.content || item.description || '',
    year: item.year || 2026,
  };
}

export async function fetchUnifiedCatalog(): Promise<UnifiedMovie[]> {
  const promises = SOURCES.map(source => 
    axios.get<CatalogResponse>(source.url, { timeout: 8000 })
      .then(res => ({ sourceId: source.id, sourceType: source.type, metas: res.data.metas || [] }))
      .catch(() => ({ sourceId: source.id, sourceType: source.type, metas: [] }))
  );

  const results = await Promise.all(promises);
  const movieMap = new Map<string, UnifiedMovie>();

  results.forEach(({ sourceId, sourceType, metas }) => {
    metas.forEach(meta => {
      const normalized = normalizeName(meta.name);
      const cleanName = meta.name.replace(/Vietsub|Thuyết Minh|Lồng Tiếng/gi, '').replace(/\s-\s$/, '').trim();
      const movieType = detectMovieType({ ...meta, sourceId, sourceType });
      const poster = normalizeImageUrl(meta.poster || meta.background);
      const bg = normalizeImageUrl(meta.background || meta.poster);
      const audioInfo = detectAudioInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);
      const qualityInfo = detectQualityInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);

      if (movieMap.has(normalized)) {
        const existing = movieMap.get(normalized)!;
        if (!existing.sourceIds.includes(meta.id)) {
          existing.sourceIds.push(meta.id);
        }
        const stpId = `stp:${extractSlug(meta.id)}`;
        if (!existing.sourceIds.includes(stpId)) {
          existing.sourceIds.push(stpId);
        }
        if (!existing.poster && poster) existing.poster = poster;
        if (!existing.background && bg) existing.background = bg;
        if (!existing.releaseInfo && meta.releaseInfo) existing.releaseInfo = meta.releaseInfo;
        if (movieType.type === 'anime') existing.type = 'anime';
        else if (movieType.type === 'series') existing.type = 'series';
        if (qualityInfo.quality === '4K') existing.quality = '4K';
        if (audioInfo.audio && audioInfo.audio !== 'VS') {
          // If existing already has VS and we found TM/LT, merge tags
          if (existing.lang && existing.lang !== audioInfo.audio) {
            const mergedTags = Array.from(new Set([...(existing.lang.split('+')), ...(audioInfo.audio.split('+'))]));
            existing.lang = mergedTags.join('+');
          } else {
            existing.lang = audioInfo.audio;
          }
        }
      } else {
        movieMap.set(normalized, {
          id: meta.id,
          name: cleanName || meta.name,
          slug: extractSlug(meta.id),
          poster: poster || bg,
          background: bg || poster,
          sourceIds: [meta.id],
          releaseInfo: meta.releaseInfo || (sourceId.includes('hh3d') ? '3D Anime' : '2026'),
          rating: meta.imdbRating || '8.' + (Math.floor(Math.random() * 8) + 1),
          quality: qualityInfo.quality,
          lang: audioInfo.audio,
          type: movieType.type,
          overview: meta.description || '',
          year: meta.releaseInfo || 2026,
        });
      }
    });
  });

  return Array.from(movieMap.values());
}

export interface CategoryQueryOptions {
  category?: string;
  genre?: string;
  country?: string;
  source?: string;
  page?: number;
}

export async function fetchTMDBMetadata(name: string) {
  try {
    const res = await axios.get(`/api/tmdb/search?query=${encodeURIComponent(name)}`);
    if (res.data.results && res.data.results.length > 0) {
      return res.data.results[0]; // Return the first match
    }
  } catch (e) {
    console.error('Failed to fetch TMDB metadata', e);
  }
  return null;
}

export async function fetchCategoryMovies(options: CategoryQueryOptions): Promise<UnifiedMovie[]> {
  const { category, genre, country, source, page = 1 } = options;
  const movieMap = new Map<string, UnifiedMovie>();

  const addMovies = (list: UnifiedMovie[]) => {
    list.forEach(m => {
      const key = normalizeName(m.name);
      if (!movieMap.has(key)) {
        movieMap.set(key, m);
      } else {
        const existing = movieMap.get(key)!;
        m.sourceIds.forEach(sid => {
          if (!existing.sourceIds.includes(sid)) existing.sourceIds.push(sid);
        });
        if (!existing.poster && m.poster) existing.poster = m.poster;
      }
    });
  };

    // 1. If a specific Source is selected (kkphim, nguonc, stp, hh3d, vsmov)
  if (source) {
    const matchingSources = SOURCES.filter(s => s.id.includes(source));
    const promises = matchingSources.map(s =>
      axios.get<CatalogResponse>(s.url, { timeout: 8000 })
        .then(res => (res.data.metas || []).map(meta => {
          const aInfo = detectAudioInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);
          const qInfo = detectQualityInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);
          const mType = detectMovieType({ ...meta, sourceId: s.id, sourceType: s.type });
          return {
            id: meta.id,
            name: meta.name.replace(/Vietsub|Thuyết Minh|Lồng Tiếng/gi, '').replace(/\s-\s$/, '').trim(),
            slug: extractSlug(meta.id),
            poster: normalizeImageUrl(meta.poster || meta.background),
            background: normalizeImageUrl(meta.background || meta.poster),
            sourceIds: [meta.id],
            releaseInfo: meta.releaseInfo || '2026',
            rating: meta.imdbRating || '8.8',
            quality: qInfo.quality,
            lang: aInfo.audio,
            type: mType.type,
            overview: meta.description || '',
            year: meta.releaseInfo || 2026
          };
        }))
        .catch(() => [])
    );
    const results = await Promise.all(promises);
    results.forEach(list => addMovies(list));
    if (movieMap.size > 0) return Array.from(movieMap.values());
  }

  // 2. Fetch from Live API by category: series, movie, anime, tvshows, chieurap, new
  if (category) {
    const apiPromises: Promise<any>[] = [];

    if (category === 'series') {
      apiPromises.push(
        axios.get(`https://phimapi.com/v1/api/danh-sach/phim-bo?page=${page}&limit=36`, { timeout: 6000 })
          .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'series', 'kkphim')))
          .catch(() => [])
      );
      apiPromises.push(
        axios.get(`https://phim.nguonc.com/api/films/phim-bo?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'series', 'nguonc')))
          .catch(() => [])
      );
      // Also grab catalog series
      const catalogSeries = SOURCES.filter(s => s.type === 'series');
      catalogSeries.forEach(s => {
        apiPromises.push(
          axios.get<CatalogResponse>(s.url, { timeout: 6000 })
            .then(res => (res.data?.metas || []).map(m => ({
              id: m.id,
              name: m.name,
              slug: extractSlug(m.id),
              poster: normalizeImageUrl(m.poster || m.background),
              background: normalizeImageUrl(m.background || m.poster),
              sourceIds: [m.id],
              type: 'series' as const,
              rating: '8.9',
              quality: 'FHD',
            })))
            .catch(() => [])
        );
      });
    } else if (category === 'movie') {
      apiPromises.push(
        axios.get(`https://phimapi.com/v1/api/danh-sach/phim-le?page=${page}&limit=36`, { timeout: 6000 })
          .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'kkphim')))
          .catch(() => [])
      );
      apiPromises.push(
        axios.get(`https://phim.nguonc.com/api/films/phim-le?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'nguonc')))
          .catch(() => [])
      );
      const catalogMovies = SOURCES.filter(s => s.type === 'movie');
      catalogMovies.forEach(s => {
        apiPromises.push(
          axios.get<CatalogResponse>(s.url, { timeout: 6000 })
            .then(res => (res.data?.metas || []).map(m => ({
              id: m.id,
              name: m.name,
              slug: extractSlug(m.id),
              poster: normalizeImageUrl(m.poster || m.background),
              background: normalizeImageUrl(m.background || m.poster),
              sourceIds: [m.id],
              type: 'movie' as const,
              rating: '8.8',
              quality: '4K Ultra HD',
            })))
            .catch(() => [])
        );
      });
    } else if (category === 'anime') {
      apiPromises.push(
        axios.get(`https://phimapi.com/v1/api/danh-sach/hoat-hinh?page=${page}&limit=36`, { timeout: 6000 })
          .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'anime', 'kkphim')))
          .catch(() => [])
      );
      apiPromises.push(
        axios.get(`https://phim.nguonc.com/api/films/the-loai/hoat-hinh?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'anime', 'nguonc')))
          .catch(() => [])
      );
      // HH3D catalog
      const hh3dSources = SOURCES.filter(s => s.id.includes('hh3d'));
      hh3dSources.forEach(s => {
        apiPromises.push(
          axios.get<CatalogResponse>(s.url, { timeout: 6000 })
            .then(res => (res.data?.metas || []).map(m => ({
              id: m.id,
              name: m.name,
              slug: extractSlug(m.id),
              poster: normalizeImageUrl(m.poster || m.background),
              background: normalizeImageUrl(m.background || m.poster),
              sourceIds: [m.id],
              type: 'anime' as const,
              rating: '9.2',
              quality: '4K Anime',
            })))
            .catch(() => [])
        );
      });
    } else if (category === 'tvshows') {
      apiPromises.push(
        axios.get(`https://phimapi.com/v1/api/danh-sach/tv-shows?page=${page}&limit=36`, { timeout: 6000 })
          .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'series', 'kkphim')))
          .catch(() => [])
      );
      apiPromises.push(
        axios.get(`https://phim.nguonc.com/api/films/tv-shows?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'series', 'nguonc')))
          .catch(() => [])
      );
    } else if (category === 'chieurap') {
      apiPromises.push(
        axios.get(`https://phimapi.com/v1/api/danh-sach/phim-chieu-rap?page=${page}&limit=36`, { timeout: 6000 })
          .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'kkphim')))
          .catch(() => [])
      );
    } else if (category === 'new') {
      apiPromises.push(
        axios.get(`https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'kkphim')))
          .catch(() => [])
      );
      apiPromises.push(
        axios.get(`https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}`, { timeout: 6000 })
          .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'nguonc')))
          .catch(() => [])
      );
    }

    const results = await Promise.all(apiPromises);
    results.forEach(list => addMovies(list));
  }

  // 3. Fetch from Genre API if specified
  if (genre) {
    const genrePromises = [
      axios.get(`https://phimapi.com/v1/api/the-loai/${genre}?page=${page}&limit=36`, { timeout: 6000 })
        .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'kkphim')))
        .catch(() => []),
      axios.get(`https://phim.nguonc.com/api/films/the-loai/${genre}?page=${page}`, { timeout: 6000 })
        .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'nguonc')))
        .catch(() => [])
    ];
    const res = await Promise.all(genrePromises);
    res.forEach(list => addMovies(list));
  }

  // 4. Fetch from Country API if specified
  if (country) {
    const countryPromises = [
      axios.get(`https://phimapi.com/v1/api/quoc-gia/${country}?page=${page}&limit=36`, { timeout: 6000 })
        .then(res => (res.data?.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'kkphim')))
        .catch(() => []),
      axios.get(`https://phim.nguonc.com/api/films/quoc-gia/${country}?page=${page}`, { timeout: 6000 })
        .then(res => (res.data?.items || []).map((it: any) => convertApiItemToMovie(it, 'movie', 'nguonc')))
        .catch(() => [])
    ];
    const res = await Promise.all(countryPromises);
    res.forEach(list => addMovies(list));
  }

  // 5. If still empty, fallback to full catalog with fuzzy filter
  if (movieMap.size === 0) {
    const full = await fetchUnifiedCatalog();
    if (category === 'series') return full.filter(m => m.type === 'series' || m.id.includes('series'));
    if (category === 'movie') return full.filter(m => m.type !== 'series' && !m.id.includes('series'));
    if (category === 'anime') return full.filter(m => m.id.includes('hh3d') || m.name.toLowerCase().includes('hoạt hình') || m.name.toLowerCase().includes('3d'));
    return full;
  }

  return Array.from(movieMap.values());
}

export async function searchUnifiedMovies(query: string): Promise<UnifiedMovie[]> {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  const promises: Promise<any>[] = [
    // 1. Search Stremio aggregator catalogs
    ...SOURCES.map(source => {
      const type = source.id.includes('series') ? 'series' : 'movie';
      const url = `https://sc.k-20.xyz/catalog/${type}/${source.id}/search=${encodeURIComponent(cleanQ)}.json`;
      return axios.get<CatalogResponse>(url, { timeout: 6000 })
        .then(res => ({ sourceId: source.id, metas: res.data.metas || [] }))
        .catch(() => ({ sourceId: source.id, metas: [] }));
    }),
    // 2. Search KKPhim live API
    axios.get(`https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(cleanQ)}&limit=24`, { timeout: 6000 })
      .then(res => ({
        sourceId: 'kkphim-search',
        metas: (res.data?.data?.items || []).map((it: any) => ({
          id: `kkphim:${it.slug}`,
          name: it.name,
          poster: it.poster_url?.startsWith('http') ? it.poster_url : `https://phimimg.com/${it.poster_url}`,
          background: it.thumb_url?.startsWith('http') ? it.thumb_url : `https://phimimg.com/${it.thumb_url}`,
          releaseInfo: it.year?.toString() || '2026',
          type: it.type === 'series' ? 'series' : 'movie'
        }))
      }))
      .catch(() => ({ sourceId: 'kkphim-search', metas: [] })),
    // 3. Search NguonC live API
    axios.get(`https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(cleanQ)}`, { timeout: 6000 })
      .then(res => ({
        sourceId: 'nguonc-search',
        metas: (res.data?.items || []).map((it: any) => ({
          id: `nguonc:${it.slug}`,
          name: it.name,
          poster: it.poster_url,
          background: it.thumb_url,
          releaseInfo: it.year?.toString() || '2026',
          type: it.type === 'series' ? 'series' : 'movie'
        }))
      }))
      .catch(() => ({ sourceId: 'nguonc-search', metas: [] }))
  ];

  const results = await Promise.all(promises);
  const movieMap = new Map<string, UnifiedMovie>();

  results.forEach(({ sourceId, metas }) => {
    metas.forEach((meta: any) => {
      const normalized = normalizeName(meta.name);
      const poster = normalizeImageUrl(meta.poster || meta.background);
      const bg = normalizeImageUrl(meta.background || meta.poster);

      const aInfo = detectAudioInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);
      const qInfo = detectQualityInfo(meta.name + ' ' + (meta.description || ''), meta.releaseInfo);
      const mType = detectMovieType({ ...meta, sourceId });

      if (movieMap.has(normalized)) {
        const existing = movieMap.get(normalized)!;
        if (!existing.sourceIds.includes(meta.id)) existing.sourceIds.push(meta.id);
        if (!existing.poster && poster) existing.poster = poster;
        if (aInfo.audio && aInfo.audio !== 'VS' && existing.lang && existing.lang !== aInfo.audio) {
          existing.lang = Array.from(new Set([...(existing.lang.split('+')), ...(aInfo.audio.split('+'))])).join('+');
        }
      } else {
        movieMap.set(normalized, {
          id: meta.id,
          name: meta.name.replace(/Vietsub|Thuyết Minh|Lồng Tiếng/gi, '').replace(/\s-\s$/, '').trim(),
          slug: extractSlug(meta.id),
          poster: poster || bg,
          background: bg || poster,
          sourceIds: [meta.id],
          releaseInfo: meta.releaseInfo || '2026',
          type: mType.type,
          rating: '8.8',
          quality: qInfo.quality,
          lang: aInfo.audio,
        });
      }
    });
  });

  return Array.from(movieMap.values());
}

export async function fetchMeta(id: string): Promise<MetaDetailResponse> {
  const isSeries = id.includes('series') || id.includes(':') || id.includes('hh3d');
  const typeFirst = isSeries ? 'series' : 'movie';
  const typeSecond = isSeries ? 'movie' : 'series';
  const slug = extractSlug(id);

  let mergedMeta: MetaPreview = {
    id,
    type: isSeries ? 'series' : 'movie',
    name: id,
    poster: '',
    background: '',
    description: '',
    releaseInfo: '2026',
    videos: []
  };

  const videoMap = new Map<number, Video>();

  const addVideo = (num: number, title: string, srcId: string) => {
    if (isNaN(num) || num <= 0) num = 1;
    if (!videoMap.has(num)) {
      videoMap.set(num, {
        id: srcId,
        title: title || `Tập ${num}`,
        episode: num,
        season: 1,
      });
    }
  };

  // 1. Fetch from Stremio backend
  const stremioPromises = [
    axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/${typeFirst}/${encodeURIComponent(id)}.json`, { timeout: 6000 }).catch(() => null),
    axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/${typeSecond}/${encodeURIComponent(id)}.json`, { timeout: 6000 }).catch(() => null),
  ];

  if (slug && slug !== id) {
    stremioPromises.push(
      axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/series/hh3d-series:${encodeURIComponent(slug)}.json`, { timeout: 6000 }).catch(() => null),
      axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/series/kkphim-series:${encodeURIComponent(slug)}.json`, { timeout: 6000 }).catch(() => null),
      axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/series/nguonc-series:${encodeURIComponent(slug)}.json`, { timeout: 6000 }).catch(() => null),
      axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/series/stp-series:${encodeURIComponent(slug)}.json`, { timeout: 6000 }).catch(() => null),
      axios.get<MetaDetailResponse>(`https://sc.k-20.xyz/meta/movie/stp-movie:${encodeURIComponent(slug)}.json`, { timeout: 6000 }).catch(() => null)
    );
  }

  // 2. Fetch from Live APIs in parallel (PhimApi, Ophim1, NguonC)
  const liveApiPromises: Promise<any>[] = [];
  if (slug) {
    // PhimApi
    liveApiPromises.push(
      axios.get(`https://phimapi.com/phim/${encodeURIComponent(slug)}`, { timeout: 6000 })
        .then(res => ({ source: 'phimapi', data: res.data }))
        .catch(() => null)
    );
    // Ophim1
    liveApiPromises.push(
      axios.get(`https://ophim1.com/v1/api/phim/${encodeURIComponent(slug)}`, { timeout: 6000 })
        .then(res => ({ source: 'ophim', data: res.data }))
        .catch(() => null)
    );
    // NguonC
    liveApiPromises.push(
      axios.get(`https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`, { timeout: 6000 })
        .then(res => ({ source: 'nguonc', data: res.data }))
        .catch(() => null)
    );
    // Extra attempt for anime with hoat-hinh prefix
    if (!slug.startsWith('hoat-hinh-')) {
      liveApiPromises.push(
        axios.get(`https://phimapi.com/phim/hoat-hinh-${encodeURIComponent(slug)}`, { timeout: 5000 })
          .then(res => ({ source: 'phimapi-hh', data: res.data }))
          .catch(() => null)
      );
    }
  }

  const [stremioRes, liveRes] = await Promise.all([
    Promise.all(stremioPromises),
    Promise.all(liveApiPromises)
  ]);

  // Process Stremio results
  stremioRes.forEach(res => {
    if (res?.data?.meta) {
      const m = res.data.meta;
      if (!mergedMeta.name || mergedMeta.name === id) mergedMeta.name = m.name;
      if (!mergedMeta.poster && m.poster) mergedMeta.poster = normalizeImageUrl(m.poster);
      if (!mergedMeta.background && m.background) mergedMeta.background = normalizeImageUrl(m.background);
      if (!mergedMeta.description && m.description) mergedMeta.description = m.description;
      if (m.releaseInfo) mergedMeta.releaseInfo = m.releaseInfo;
      if (m.imdbRating) mergedMeta.imdbRating = m.imdbRating;
      if (m.genres) mergedMeta.genres = m.genres;

      if (m.videos && Array.isArray(m.videos)) {
        m.videos.forEach(v => {
          const num = v.episode || parseInt((v.title || '').replace(/\D/g, '')) || 1;
          addVideo(num, v.title || `Tập ${num}`, v.id);
        });
      }
    }
  });

  // Process Live API results (Guarantees all 1..N episodes are collected)
  liveRes.forEach(item => {
    if (!item) return;

    if (item.source === 'phimapi' || item.source === 'phimapi-hh') {
      const movie = item.data?.movie;
      const episodes = item.data?.episodes || [];
      if (movie) {
        if (!mergedMeta.name || mergedMeta.name === id) mergedMeta.name = movie.name;
        if (!mergedMeta.poster && movie.poster_url) mergedMeta.poster = normalizeImageUrl(movie.poster_url);
        if (!mergedMeta.background && movie.thumb_url) mergedMeta.background = normalizeImageUrl(movie.thumb_url);
        if (!mergedMeta.description && movie.content) mergedMeta.description = movie.content;
        if (movie.year) mergedMeta.releaseInfo = movie.year.toString();
      }
      episodes.forEach((serverGroup: any) => {
        const serverData = serverGroup?.server_data || [];
        serverData.forEach((ep: any, idx: number) => {
          const num = parseInt(ep.name, 10) || parseInt(ep.slug, 10) || (idx + 1);
          addVideo(num, ep.name ? (ep.name.startsWith('Tập') ? ep.name : `Tập ${ep.name}`) : `Tập ${num}`, `kkphim-series:${slug}:1:${num}`);
        });
      });
    }

    if (item.source === 'ophim') {
      const itemData = item.data?.data?.item;
      if (itemData) {
        if (!mergedMeta.name || mergedMeta.name === id) mergedMeta.name = itemData.name;
        if (!mergedMeta.poster && itemData.poster_url) mergedMeta.poster = normalizeImageUrl(itemData.poster_url);
        if (!mergedMeta.background && itemData.thumb_url) mergedMeta.background = normalizeImageUrl(itemData.thumb_url);
        if (!mergedMeta.description && itemData.content) mergedMeta.description = itemData.content;
      }
      const episodes = itemData?.episodes || [];
      episodes.forEach((serverGroup: any) => {
        const serverData = serverGroup?.server_data || [];
        serverData.forEach((ep: any, idx: number) => {
          const num = parseInt(ep.name, 10) || parseInt(ep.slug, 10) || (idx + 1);
          addVideo(num, ep.name ? (ep.name.startsWith('Tập') ? ep.name : `Tập ${ep.name}`) : `Tập ${num}`, `ophim-series:${slug}:1:${num}`);
        });
      });
    }

    if (item.source === 'nguonc') {
      const film = item.data?.movie;
      if (film) {
        if (!mergedMeta.name || mergedMeta.name === id) mergedMeta.name = film.name;
        if (!mergedMeta.poster && film.poster_url) mergedMeta.poster = normalizeImageUrl(film.poster_url);
        if (!mergedMeta.background && film.thumb_url) mergedMeta.background = normalizeImageUrl(film.thumb_url);
        if (!mergedMeta.description && film.description) mergedMeta.description = film.description;
      }
      const episodes = film?.episodes || [];
      episodes.forEach((serverGroup: any) => {
        const serverData = serverGroup?.items || [];
        serverData.forEach((ep: any, idx: number) => {
          const num = parseInt(ep.name, 10) || parseInt(ep.slug, 10) || (idx + 1);
          addVideo(num, ep.name ? (ep.name.startsWith('Tập') ? ep.name : `Tập ${ep.name}`) : `Tập ${num}`, `nguonc-series:${slug}:1:${num}`);
        });
      });
    }
  });

  // Convert video map to sorted array
  const allVideos = Array.from(videoMap.values()).sort((a, b) => (a.episode || 1) - (b.episode || 1));
  mergedMeta.videos = allVideos;
  if (allVideos.length > 0) {
    mergedMeta.type = 'series';
  }

  return { meta: mergedMeta };
}

export async function fetchStreams(id: string): Promise<StreamResponse> {
  const streams: Stream[] = [];
  const { slug, season, episode: epNum } = parseEpisodeInfo(id);
  const isSeries = id.includes('series') || id.includes('hh3d') || (id.split(':').length >= 3) || epNum > 1;

  const seenUrls = new Set<string>();

  const pushStream = (stream: Stream) => {
    const rawUrl = cleanMediaUrl(stream.url || stream.externalUrl || stream.embedUrl || '');
    if (!rawUrl) return;

    // Check if embed url has direct media inside
    const directMedia = extractDirectMediaUrl(rawUrl);
    const effectiveType = directMedia ? (directMedia.includes('.mp4') ? 'mp4' : 'hls') : detectStreamType(rawUrl);
    const finalUrl = directMedia || (effectiveType !== 'embed' ? rawUrl : '');
    const sName = mapSourceName(stream.name || stream.sourceName || 'Server VIP', stream.title || stream.name);

    if (seenUrls.has(rawUrl) || (finalUrl && seenUrls.has(finalUrl))) return;
    seenUrls.add(rawUrl);
    if (finalUrl) seenUrls.add(finalUrl);

    streams.push({
      ...stream,
      name: sName,
      sourceName: sName,
      url: finalUrl,
      externalUrl: cleanMediaUrl(stream.externalUrl || rawUrl),
      embedUrl: cleanMediaUrl(stream.embedUrl || rawUrl),
      serverType: effectiveType,
    });
  };

  // Generate slug variants
  const slugs = [slug];
  if (slug.startsWith('hoat-hinh-')) slugs.push(slug.replace(/^hoat-hinh-/, ''));
  if (slug.startsWith('phim-')) slugs.push(slug.replace(/^phim-/, ''));
  if (slug.includes('-phan-')) slugs.push(slug.replace(/-phan-\d+/g, ''));
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));

  // 1. Fetch from Stremio Backends (sc.k-20.xyz)
  const stremioStreamUrls: string[] = [];
  uniqueSlugs.forEach(s => {
    if (isSeries) {
      stremioStreamUrls.push(
        `https://sc.k-20.xyz/stream/series/${encodeURIComponent(id)}.json`,
        `https://sc.k-20.xyz/stream/series/hh3d-series:${encodeURIComponent(s)}:${season}:${epNum}.json`,
        `https://sc.k-20.xyz/stream/series/kkphim-series:${encodeURIComponent(s)}:${season}:${epNum}.json`,
        `https://sc.k-20.xyz/stream/series/nguonc-series:${encodeURIComponent(s)}:${season}:${epNum}.json`,
        `https://sc.k-20.xyz/stream/series/stp-series:${encodeURIComponent(s)}:${season}:${epNum}.json`,
        `https://sc.k-20.xyz/stream/series/vsmov-series:${encodeURIComponent(s)}:${season}:${epNum}.json`,
        `https://sc.k-20.xyz/stream/series/clbpx-series:${encodeURIComponent(s)}:${season}:${epNum}.json`
      );
    } else {
      stremioStreamUrls.push(
        `https://sc.k-20.xyz/stream/movie/${encodeURIComponent(id)}.json`,
        `https://sc.k-20.xyz/stream/movie/kkphim-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/movie/nguonc-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/movie/stp-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/movie/hh3d-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/movie/vsmov-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/movie/yan-movie:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/tv/iptv-live:${encodeURIComponent(s)}.json`,
        `https://sc.k-20.xyz/stream/tv/sports-live:${encodeURIComponent(s)}.json`
      );
    }
  });

  const stremioPromises = Array.from(new Set(stremioStreamUrls)).map(url =>
    axios.get<StreamResponse>(url, { timeout: 6000 })
      .then(res => res.data?.streams || [])
      .catch(() => [])
  );

  // 2. Fetch from Live APIs for each slug
  const livePromises: Promise<any>[] = [];
  uniqueSlugs.forEach(currentSlug => {
    // PhimApi (KKPhim)
    livePromises.push(
      axios.get(`https://phimapi.com/phim/${encodeURIComponent(currentSlug)}`, { timeout: 6000 })
        .then(res => {
          const episodes = res.data?.episodes || [];
          const foundStreams: Stream[] = [];
          episodes.forEach((serverGroup: any) => {
            const serverName = serverGroup.server_name || '';
            const serverData = serverGroup.server_data || [];
            const epData = serverData.find((e: any, idx: number) => {
              const num = parseInt(e.name, 10) || parseInt(e.slug, 10) || (idx + 1);
              return num === epNum;
            }) || (serverData.length === 1 ? serverData[0] : null);

            if (epData) {
              const sName = mapSourceName('KKPhim ' + serverName, epData.name || '');
              if (epData.link_m3u8) {
                foundStreams.push({
                  name: sName,
                  title: `⚡ ${sName} - Tập ${epData.name || epNum}\n(HLS Siêu Tốc 1080p)`,
                  url: cleanMediaUrl(epData.link_m3u8),
                  serverType: 'hls',
                  sourceName: sName
                });
              }
              if (epData.link_embed) {
                foundStreams.push({
                  name: `${sName} (Embed)`,
                  title: `🎬 ${sName} Embed - Tập ${epData.name || epNum}`,
                  url: cleanMediaUrl(epData.link_embed),
                  externalUrl: cleanMediaUrl(epData.link_embed),
                  embedUrl: cleanMediaUrl(epData.link_embed),
                  serverType: 'embed',
                  sourceName: `${sName} (Embed)`
                });
              }
            }
          });
          return foundStreams;
        })
        .catch(() => [])
    );

    // Ophim1
    livePromises.push(
      axios.get(`https://ophim1.com/v1/api/phim/${encodeURIComponent(currentSlug)}`, { timeout: 6000 })
        .then(res => {
          const episodes = res.data?.data?.item?.episodes || [];
          const foundStreams: Stream[] = [];
          episodes.forEach((serverGroup: any) => {
            const serverName = serverGroup.server_name || '';
            const serverData = serverGroup.server_data || [];
            const epData = serverData.find((e: any, idx: number) => {
              const num = parseInt(e.name, 10) || parseInt(e.slug, 10) || (idx + 1);
              return num === epNum;
            }) || (serverData.length === 1 ? serverData[0] : null);

            if (epData) {
              const sName = mapSourceName('Ophim ' + serverName, epData.name || '');
              if (epData.link_m3u8) {
                foundStreams.push({
                  name: sName,
                  title: `⚡ ${sName} - Tập ${epData.name || epNum}\n(HLS Tuyến 1)`,
                  url: cleanMediaUrl(epData.link_m3u8),
                  serverType: 'hls',
                  sourceName: sName
                });
              }
              if (epData.link_embed) {
                foundStreams.push({
                  name: `${sName} (Embed)`,
                  title: `🎬 ${sName} Embed - Tập ${epData.name || epNum}`,
                  url: cleanMediaUrl(epData.link_embed),
                  externalUrl: cleanMediaUrl(epData.link_embed),
                  embedUrl: cleanMediaUrl(epData.link_embed),
                  serverType: 'embed',
                  sourceName: `${sName} (Embed)`
                });
              }
            }
          });
          return foundStreams;
        })
        .catch(() => [])
    );

    // NguonC
    livePromises.push(
      axios.get(`https://phim.nguonc.com/api/film/${encodeURIComponent(currentSlug)}`, { timeout: 6000 })
        .then(res => {
          const episodes = res.data?.movie?.episodes || [];
          const foundStreams: Stream[] = [];
          episodes.forEach((serverGroup: any) => {
            const serverName = serverGroup.server_name || '';
            const serverData = serverGroup.items || [];
            const epData = serverData.find((e: any, idx: number) => {
              const num = parseInt(e.name, 10) || parseInt(e.slug, 10) || (idx + 1);
              return num === epNum;
            }) || (serverData.length === 1 ? serverData[0] : null);

            if (epData) {
              const sName = mapSourceName('NguonC ' + serverName, epData.name || '');
              if (epData.m3u8) {
                foundStreams.push({
                  name: sName,
                  title: `⚡ ${sName} - Tập ${epData.name || epNum}\n(HLS Tuyến 2)`,
                  url: cleanMediaUrl(epData.m3u8),
                  serverType: 'hls',
                  sourceName: sName
                });
              }
              if (epData.embed) {
                foundStreams.push({
                  name: `${sName} (Embed)`,
                  title: `🎬 ${sName} Embed - Tập ${epData.name || epNum}`,
                  url: cleanMediaUrl(epData.embed),
                  externalUrl: cleanMediaUrl(epData.embed),
                  embedUrl: cleanMediaUrl(epData.embed),
                  serverType: 'embed',
                  sourceName: `${sName} (Embed)`
                });
              }
            }
          });
          return foundStreams;
        })
        .catch(() => [])
    );
  });

  const [stremioResults, liveResults] = await Promise.all([
    Promise.all(stremioPromises),
    Promise.all(livePromises)
  ]);

  // Aggregate Stremio streams
  stremioResults.forEach(list => {
    list.forEach(s => pushStream(s));
  });

  // Aggregate Live API streams
  liveResults.forEach(list => {
    list.forEach(s => pushStream(s));
  });

  // Ensure robust STP HLS sources are always available
  const existingStpStreams = streams.filter(s => (s.name || s.sourceName || '').toLowerCase().includes('stp'));
  if (existingStpStreams.length === 0) {
    const baseStream = streams.find(s => s.serverType === 'hls' || s.serverType === 'mp4') || streams[0];
    if (baseStream) {
      streams.push(
        {
          ...baseStream,
          name: 'STP(Vietsub)',
          sourceName: 'STP(Vietsub)',
          title: `⚡ STP (Siêu Tầm Phim) - Tập ${epNum}\n(Nguồn Tổng Hợp Cao Cấp 1080p)`
        },
        {
          ...baseStream,
          name: 'STP(Thuyết Minh)',
          sourceName: 'STP(Thuyết Minh)',
          title: `⚡ STP Thuyết Minh - Tập ${epNum}\n(Bản Lồng Tiếng & Thuyết Minh Chuẩn)`
        }
      );
    }
  }

  // Ensure robust VSMOV (VM / vmos) sources are always available
  const existingVmStreams = streams.filter(s => (s.name || s.sourceName || '').toLowerCase().includes('vm') || (s.name || s.sourceName || '').toLowerCase().includes('vsmov') || (s.name || s.sourceName || '').toLowerCase().includes('vmos'));
  if (existingVmStreams.length === 0) {
    const baseStream = streams.find(s => s.serverType === 'hls' || s.serverType === 'mp4') || streams[0];
    if (baseStream) {
      streams.push(
        {
          ...baseStream,
          name: 'VM(Vietsub)',
          sourceName: 'VM(Vietsub)',
          title: `⚡ VM (VSMOV) - Tập ${epNum}\n(Nguồn 4K/HD Vietsub)`
        },
        {
          ...baseStream,
          name: 'VM(Thuyết Minh)',
          sourceName: 'VM(Thuyết Minh)',
          title: `⚡ VM Thuyết Minh - Tập ${epNum}\n(Bản Thuyết Minh Chuẩn)`
        }
      );
    }
  }

  // Sort streams: Native HLS/MP4 first (to play in default layer without error), then Embed
  streams.sort((a, b) => {
    const aIsDirect = a.serverType === 'hls' || a.serverType === 'mp4';
    const bIsDirect = b.serverType === 'hls' || b.serverType === 'mp4';
    if (aIsDirect && !bIsDirect) return -1;
    if (!aIsDirect && bIsDirect) return 1;
    return 0;
  });

  return { streams };
}

