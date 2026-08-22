import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedCatalog } from '../api';
import { MovieCard } from '../components/MovieCard';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Heart, Clock, Trash2, Film, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MyList() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('cineflix-favorites', []);
  const [history, setHistory] = useLocalStorage<any[]>('cineflix-history', []);
  
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ['unified-catalog'],
    queryFn: fetchUnifiedCatalog,
  });

  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const favoriteMovies = movies.filter(movie => safeFavorites.includes(movie.id));
  
  const clearHistory = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử xem phim?')) {
      setHistory([]);
    }
  };

  const clearFavorites = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ danh sách yêu thích?')) {
      setFavorites([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] pt-24 sm:pt-28 px-4 sm:px-8 lg:px-12 pb-24">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`pb-2 font-black text-lg sm:text-2xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'favorites' 
                ? 'text-white border-[#E50914]' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <Heart className={`w-5 h-5 ${activeTab === 'favorites' ? 'fill-[#E50914] text-[#E50914]' : ''}`} />
            <span>Phim Yêu Thích ({safeFavorites.length})</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-2 font-black text-lg sm:text-2xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'history' 
                ? 'text-white border-[#E50914]' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <Clock className={`w-5 h-5 ${activeTab === 'history' ? 'text-[#E50914]' : ''}`} />
            <span>Lịch Sử Xem ({safeHistory.length})</span>
          </button>
        </div>

        {/* Clear Actions */}
        {activeTab === 'favorites' && safeFavorites.length > 0 && (
          <button
            onClick={clearFavorites}
            className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 self-start sm:self-auto py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa danh sách yêu thích</span>
          </button>
        )}

        {activeTab === 'history' && safeHistory.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 self-start sm:self-auto py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử xem</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'favorites' ? (
        favoriteMovies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {favoriteMovies.map(movie => (
              <div key={movie.id} className="flex justify-center">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#12131b] border border-white/5 rounded-2xl p-8 max-w-md mx-auto">
            <Heart className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Chưa có phim yêu thích</h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-6">
              Bấm vào biểu tượng trái tim ở bất kỳ phim nào để lưu vào danh sách của bạn.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E50914] text-white font-bold text-sm hover:bg-red-700 transition-colors"
            >
              <Film className="w-4 h-4" />
              Khám Phá Phim Ngay
            </Link>
          </div>
        )
      ) : (
        /* History Tab */
        safeHistory.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safeHistory.map((item: any, idx: number) => {
              const movieId = typeof item === 'string' ? item : item.movieId;
              const movie = movies.find(m => m.id === movieId);
              const movieName = typeof item === 'object' && item.movieName ? item.movieName : (movie?.name || 'Chi Tiết Phim');
              const poster = typeof item === 'object' && item.poster ? item.poster : (movie?.poster || '');
              const episodeTitle = typeof item === 'object' ? item.episodeTitle : null;

              return (
                <Link
                  key={idx}
                  to={`/movie/${encodeURIComponent(movieId)}`}
                  className="group flex gap-3 p-3 rounded-xl bg-[#141520] border border-white/5 hover:border-red-500/40 transition-all hover:bg-[#1a1b2a]"
                >
                  <div className="w-20 aspect-[2/3] rounded-lg overflow-hidden bg-black/50 shrink-0 relative">
                    <img 
                      src={poster || 'https://placehold.co/100x150/141520/e50914?text=K-20'} 
                      alt={movieName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-6 h-6 text-[#E50914] fill-white" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center min-w-0">
                    <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-[#E50914] transition-colors">
                      {movieName}
                    </h4>
                    {episodeTitle && (
                      <span className="text-xs text-[#E50914] font-medium mt-1">
                        {episodeTitle}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Đã xem gần đây
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#12131b] border border-white/5 rounded-2xl p-8 max-w-md mx-auto">
            <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Chưa có lịch sử xem</h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-6">
              Các bộ phim bạn đã xem sẽ tự động được lưu lại tại đây để bạn tiện xem tiếp.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E50914] text-white font-bold text-sm hover:bg-red-700 transition-colors"
            >
              <Film className="w-4 h-4" />
              Xem Phim Ngay
            </Link>
          </div>
        )
      )}
    </div>
  );
}
