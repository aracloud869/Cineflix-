import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UnifiedMovie } from '../types';
import { Play, Star, Heart, Film } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getPosterFallbackList, detectMovieType, detectAudioInfo, detectQualityInfo } from '../utils';

interface MovieCardProps {
  movie: UnifiedMovie;
  priority?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  const [favorites, setFavorites] = useLocalStorage<string[]>('cineflix-favorites', []);
  const isFavorite = Array.isArray(favorites) && favorites.includes(movie.id);

  // Candidate images across multiple sources
  const candidateImages = useMemo(() => getPosterFallbackList(movie), [movie]);
  const [imgIndex, setImgIndex] = useState(0);
  const [hasErrorAll, setHasErrorAll] = useState(false);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const safeFavs = Array.isArray(favorites) ? favorites : [];
    if (isFavorite) {
      setFavorites(safeFavs.filter(id => id !== movie.id));
    } else {
      setFavorites([...safeFavs, movie.id]);
    }
  };

  const movieType = useMemo(() => detectMovieType(movie), [movie]);
  const audioInfo = useMemo(() => detectAudioInfo(`${movie.name} ${movie.originName || ''} ${movie.overview || ''}`, movie.lang), [movie]);
  const qualityInfo = useMemo(() => detectQualityInfo(`${movie.name} ${movie.quality || ''}`, movie.quality), [movie]);

  const currentImgSrc = candidateImages[imgIndex] || movie.poster || movie.background;

  const handleImageError = () => {
    if (imgIndex + 1 < candidateImages.length) {
      setImgIndex(prev => prev + 1);
    } else {
      setHasErrorAll(true);
    }
  };

  return (
    <div className="shrink-0 w-36 sm:w-44 md:w-48 lg:w-52 gpu-accelerate">
      <Link 
        to={`/movie/${encodeURIComponent(movie.id)}`}
        className="group relative flex flex-col rounded-xl overflow-hidden bg-[#181820] border border-white/5 hover:border-red-600/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(0,0,0,0.8),0_0_20px_rgba(229,9,20,0.2)] z-10 hover:z-20 w-full"
      >
        {/* Poster Image Container */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#12131a]">
          {!hasErrorAll && currentImgSrc ? (
            <img
              src={currentImgSrc}
              alt={movie.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1b1c2b] to-[#12131d]">
              <Film className="w-8 h-8 text-red-500 mb-2 opacity-80" />
              <span className="text-xs font-bold text-white line-clamp-2">{movie.name}</span>
              <span className="text-[10px] text-gray-400 mt-1">{movie.year || 2026}</span>
            </div>
          )}

          {/* Gradient shadow overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181820] via-transparent to-black/40 opacity-70 group-hover:opacity-90 transition-opacity" />

          {/* Conditional UI based on history row mode */}
          {!movie.isHistory ? (
            <>
              {/* Top Badges */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide shadow-md ${
                  movieType.type === 'anime' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black' :
                  movieType.type === 'series' ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white' : 
                  'bg-[#E50914] text-white'
                }`}>
                  {movieType.typeLabel}
                </span>

                {movie.releaseInfo && (
                  <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-gray-200 font-mono border border-white/10">
                    {movie.releaseInfo}
                  </span>
                )}
              </div>

              {/* Quick Favorite Button */}
              <button
                onClick={toggleFavorite}
                className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 z-30 opacity-0 group-hover:opacity-100 ${
                  isFavorite ? 'bg-[#E50914] text-white opacity-100' : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/80'
                }`}
                title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
              </button>

              {/* Hover Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-900/50 border border-white/40">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
              </div>

              {/* Bottom Rating & Quality Tag on Poster */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white/90">
                <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/10 text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span className="text-white text-[10px]">{movie.rating || '8.8'}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold backdrop-blur-md px-1.5 py-0.5 rounded ${
                  qualityInfo.quality === '4K'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-sm' 
                    : qualityInfo.quality === 'CAM'
                    ? 'bg-amber-600/80 text-white'
                    : 'bg-white/15 text-gray-200'
                }`}>
                  {qualityInfo.quality}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Specialized Minimal Watch History Display Overlay directly inside Poster */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-8 flex flex-col justify-end">
                <p className="text-white text-xs sm:text-sm font-extrabold line-clamp-1 group-hover:text-red-500 transition-colors" title={movie.name}>
                  {movie.name}
                </p>
                {movie.episodeTitle && (
                  <p className="text-[10px] text-red-500 font-bold tracking-wide mt-0.5 uppercase">
                    {movie.episodeTitle}
                  </p>
                )}
              </div>

              {/* Hover Center Play Button for History */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-[#E50914] flex items-center justify-center shadow-xl border border-white/30">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Render detailed bottom box only when NOT in history mode */}
        {!movie.isHistory && (
          <div className="p-3 flex flex-col flex-1 justify-between gap-1.5">
            <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-1 group-hover:text-[#E50914] transition-colors" title={movie.name}>
              {movie.name}
            </h3>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-mono">{movie.year || 2026}</span>
              <span 
                className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wider border shadow-sm ${
                  audioInfo.audio.includes('+') 
                    ? 'bg-gradient-to-r from-red-600/30 to-amber-600/30 text-amber-300 border-amber-500/40'
                    : audioInfo.audio === 'LT'
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                    : audioInfo.audio === 'TM'
                    ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
                    : 'bg-red-600/20 text-red-300 border-red-500/30'
                }`}
                title={audioInfo.audioFull}
              >
                {audioInfo.audio}
              </span>
            </div>
          </div>
        )}
      </Link>
    </div>
  );
};
