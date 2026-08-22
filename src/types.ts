export interface CatalogResponse {
  metas: MetaPreview[];
  hasMore?: boolean;
}

export interface Video {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
}

export interface MetaPreview {
  id: string;
  type: string;
  name: string;
  originName?: string;
  poster: string;
  posterShape?: string;
  background?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  country?: string[];
  videos?: Video[];
}

export interface UnifiedMovie {
  id: string;
  name: string;
  originName?: string;
  slug?: string;
  poster: string;
  background: string;
  sourceIds: string[];
  releaseInfo?: string;
  rating?: string;
  quality?: string;
  lang?: string;
  type?: 'movie' | 'series' | 'anime';
  genres?: string[];
  year?: number | string;
  overview?: string;
  isHistory?: boolean;
  episodeTitle?: string;
}

export interface MetaDetailResponse {
  meta: MetaPreview;
}

export interface StreamResponse {
  streams: Stream[];
}

export interface StreamSubtitle {
  id: string;
  url: string;
  lang: string;
}

export interface Stream {
  name?: string;
  title?: string;
  url?: string;
  externalUrl?: string;
  embedUrl?: string;
  quality?: string;
  sourceName?: string;
  serverType?: 'hls' | 'mp4' | 'embed' | 'proxy';
  subtitles?: StreamSubtitle[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: Record<string, string>;
  };
}

export interface WatchHistoryItem {
  movieId: string;
  movieName: string;
  poster: string;
  episodeId?: string;
  episodeTitle?: string;
  currentTime?: number;
  duration?: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  movieId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: number;
}
