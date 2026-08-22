import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchUnifiedMovies, fetchUnifiedCatalog } from '../api';
import { MovieCard } from '../components/MovieCard';
import { Search as SearchIcon, Film, Sparkles, TrendingUp, X, Server, ArrowLeft, Filter } from 'lucide-react';

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const deferredQuery = useDeferredValue(query);
  const [localQuery, setLocalQuery] = useState(query);
  const [selectedServer, setSelectedServer] = useState<string>('ALL');
  const navigate = useNavigate();

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ['search', deferredQuery],
    queryFn: () => searchUnifiedMovies(deferredQuery),
    enabled: !!deferredQuery,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['unified-catalog'],
    queryFn: fetchUnifiedCatalog,
  });

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchParams({ q: localQuery.trim() });
    }
  };

  const trendingTags = [
    'Tiên Nghịch', 'Đấu La Đại Lục', 'Anh Hùng', 'Điệp Vụ Báo Hồng', 
    'Nàng Búp Bê Thử Đồ', 'Conan', 'Thanh Xuân', 'Hành Động'
  ];

  const serverFilters = [
    { id: 'ALL', label: 'Tất cả Server' },
    { id: 'OP', label: 'Nguồn OP (Ophim)' },
    { id: 'KK', label: 'Nguồn KK (KKPhim)' },
    { id: 'NC', label: 'Nguồn NC (Nguồn C)' },
    { id: 'STP', label: 'Nguồn STP (Siêu Tầm)' },
    { id: 'HH3D', label: 'Nguồn HH3D (Hoạt Hình 3D)' },
    { id: 'VM', label: 'Nguồn VM (vmos)' },
    { id: 'CLBPX', label: 'CLBPX (Phim Xưa)' },
    { id: 'YAN', label: 'YAN Hoạt Hình' },
    { id: 'IPTV', label: 'Live TV 4K' },
    { id: 'SPORTS', label: 'Thể Thao' },
  ];

  const filteredMovies = useMemo(() => {
    if (selectedServer === 'ALL') return movies;
    return movies.filter(movie => {
      const ids = movie.sourceIds || [movie.id];
      return ids.some(id => {
        const lower = id.toLowerCase();
        if (selectedServer === 'OP') return lower.includes('ophim');
        if (selectedServer === 'KK') return lower.includes('kkphim') || lower.includes('phimapi');
        if (selectedServer === 'NC') return lower.includes('nguonc');
        if (selectedServer === 'STP') return lower.includes('stp') || lower.includes('sieutam');
        if (selectedServer === 'HH3D') return lower.includes('hh3d') || lower.includes('hoathinh');
        if (selectedServer === 'VM') return lower.includes('vsmov') || lower.includes('vmos') || lower.includes('vm');
        if (selectedServer === 'CLBPX') return lower.includes('clbpx');
        if (selectedServer === 'YAN') return lower.includes('yan');
        if (selectedServer === 'IPTV') return lower.includes('iptv');
        if (selectedServer === 'SPORTS') return lower.includes('sports');
        return true;
      });
    });
  }, [movies, selectedServer]);

  return (
    <div className="min-h-screen bg-[#0a0b10] pt-24 sm:pt-28 px-4 sm:px-8 lg:px-12 pb-24">
      {/* Header back button */}
      <div className="max-w-5xl mx-auto mb-4 flex items-center gap-3">
        <button
          onClick={handleGoBack}
          className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
          title="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-gray-400">Tìm Kiếm Phim</span>
      </div>

      {/* Search Input Box */}
      <div className="max-w-3xl mx-auto mb-8">
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên phim, diễn viên, thể loại..."
            className="w-full pl-13 pr-12 py-3.5 sm:py-4 rounded-2xl bg-[#14151f] border border-white/10 text-white text-sm sm:text-base outline-none focus:border-[#E50914] shadow-2xl focus:shadow-[0_0_20px_rgba(229,9,20,0.3)] transition-all"
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                setSearchParams({});
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </form>

        {/* Trending Keywords */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-400 font-semibold mr-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Tìm kiếm phổ biến:</span>
          </div>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setLocalQuery(tag);
                setSearchParams({ q: tag });
              }}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 text-xs text-gray-300 transition-colors border border-white/5 cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header & Server Filter */}
      {query && (
        <div className="max-w-7xl mx-auto mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Kết quả tìm kiếm cho: <span className="text-[#E50914]">"{query}"</span>
            </h1>
            <span className="text-xs text-gray-400 font-semibold">
              Hiển thị {filteredMovies.length} / {movies.length} kết quả
            </span>
          </div>

          {/* Server Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold shrink-0 mr-1">
              <Server className="w-4 h-4 text-[#E50914]" />
              <span>Bộ lọc Server:</span>
            </div>
            {serverFilters.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServer(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedServer === s.id
                    ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40 scale-105'
                    : 'bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-full aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : query && filteredMovies.length > 0 ? (
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredMovies.map(movie => (
            <div key={movie.id} className="flex justify-center">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-20 bg-[#12131b] border border-white/5 rounded-2xl p-8 max-w-lg mx-auto">
          <Film className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Không tìm thấy phim phù hợp với bộ lọc</h3>
          <p className="text-gray-400 text-xs sm:text-sm mb-6">
            Thử chuyển sang chọn "Tất cả Server" hoặc tìm kiếm với từ khóa khác.
          </p>
          {selectedServer !== 'ALL' && (
            <button
              onClick={() => setSelectedServer('ALL')}
              className="px-4 py-2 bg-[#E50914] text-white font-bold text-xs rounded-xl shadow-lg hover:bg-red-700 transition-colors cursor-pointer"
            >
              Xem tất cả nguồn phim ({movies.length})
            </button>
          )}
        </div>
      ) : (
        /* Empty Query Showcase */
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Gợi Ý Phim Hay Cho Bạn</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {catalog.slice(0, 18).map(movie => (
              <div key={movie.id} className="flex justify-center">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
