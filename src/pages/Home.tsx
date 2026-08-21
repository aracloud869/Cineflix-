import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedCatalog, fetchCategoryMovies, GENRES_LIST, COUNTRIES_LIST } from '../api';
import { MovieCard } from '../components/MovieCard';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { getWatchedMovies } from '../db/firestore';
import { 
  Play, Info, ChevronLeft, ChevronRight, Star, 
  Flame, Sparkles, Film, Tv, Clock, Heart, Filter, Globe, Zap, ArrowLeft, ArrowRight
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { UnifiedMovie } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { detectMovieType, detectAudioInfo, detectQualityInfo } from '../utils';

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const genre = searchParams.get('genre');
  const country = searchParams.get('country');
  const source = searchParams.get('source');
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(pageParam || 1);

  const isCustomView = Boolean(category || genre || country || source);

  const [heroIndex, setHeroIndex] = useState(0);
  const [favorites, setFavorites] = useLocalStorage<string[]>('cineflix-favorites', []);
  const [filterSort, setFilterSort] = useState<'default' | 'rating' | 'name'>('default');
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      getWatchedMovies(user.uid).then(setWatchedMovies).catch(e => {
        console.error("Safe fetch watched movies failed, suppressing:", e);
        setWatchedMovies([]);
      });
    } else {
      setWatchedMovies([]);
    }
  }, [user]);

  // Sync page state when URL changes
  useEffect(() => {
    setCurrentPage(pageParam || 1);
  }, [pageParam, category, genre, country, source]);

  // Query for Default Home Catalog
  const { data: homeMovies = [], isLoading: isHomeLoading } = useQuery({
    queryKey: ['unified-catalog'],
    queryFn: fetchUnifiedCatalog,
    enabled: !isCustomView,
  });

  // Query for Category / Genre / Country / Source
  const { data: categoryMovies = [], isLoading: isCategoryLoading } = useQuery({
    queryKey: ['category-movies', category, genre, country, source, currentPage],
    queryFn: () => fetchCategoryMovies({ category: category || undefined, genre: genre || undefined, country: country || undefined, source: source || undefined, page: currentPage }),
    enabled: isCustomView,
  });

  const movies = isCustomView ? categoryMovies : homeMovies;
  const isLoading = isCustomView ? isCategoryLoading : isHomeLoading;

  // Hero auto-rotation
  const heroCandidates = homeMovies.slice(0, 6);
  useEffect(() => {
    if (heroCandidates.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroCandidates.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [heroCandidates.length]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b10] pb-24 overflow-x-hidden pt-24">
        <div className="w-full h-[60vh] bg-white/5 animate-pulse mb-8" />
        <div className="space-y-8 px-4 sm:px-12">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="w-48 h-6 bg-white/10 rounded mb-4 animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="w-36 sm:w-48 aspect-[2/3] rounded-xl shrink-0 bg-white/5 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle Category / Genre / Country / Source View (Full Grid View)
  if (isCustomView) {
    let filtered = [...categoryMovies];
    let title = 'Danh Mục Phim';
    let subTitle = 'Tuyển tập phim được cập nhật liên tục';
    let icon = Film;

    if (category === 'series') {
      title = 'Phim Bộ & Truyền Hình Nhiều Tập';
      subTitle = 'Kho phim bộ Hàn Quốc, Trung Quốc, Âu Mỹ full Vietsub & Thuyết minh';
      icon = Tv;
    } else if (category === 'movie') {
      title = 'Phim Lẻ & Điện Ảnh Chiếu Rạp';
      subTitle = 'Phim lẻ bom tấn chất lượng 4K Ultra HD';
      icon = Film;
    } else if (category === 'anime') {
      title = 'Hoạt Hình 3D & Anime';
      subTitle = 'Tuyển tập hoạt hình 3D Trung Quốc, Anime Nhật Bản đồ họa đỉnh cao';
      icon = Sparkles;
    } else if (category === 'tvshows') {
      title = 'TV Shows & Gameshow';
      subTitle = 'Chương trình truyền hình thực tế và gameshow hấp dẫn';
      icon = Tv;
    } else if (category === 'chieurap') {
      title = 'Phim Chiếu Rạp Mới';
      subTitle = 'Các tác phẩm điện ảnh bom tấn vừa ra mắt tại các rạp';
      icon = Film;
    } else if (category === 'new') {
      title = 'Mới Cập Nhật Hôm Nay';
      subTitle = 'Các tập phim và phim mới nhất vừa được bổ sung vào hệ thống';
      icon = Clock;
    } else if (genre) {
      const match = GENRES_LIST.find(g => g.slug === genre);
      title = `Phim Thể Loại ${match ? match.name : genre}`;
      subTitle = `Tổng hợp phim ${match ? match.name : genre} đặc sắc nhất`;
      icon = Sparkles;
    } else if (country) {
      const match = COUNTRIES_LIST.find(c => c.slug === country);
      title = `Phim Quốc Gia ${match ? match.name : country}`;
      subTitle = `Tuyển tập phim ${match ? match.name : country} chất lượng cao`;
      icon = Globe;
    } else if (source) {
      title = `Nguồn Phát ${source.toUpperCase()}`;
      subTitle = `Phim được lấy trực tiếp từ máy chủ đối tác ${source.toUpperCase()}`;
      icon = Zap;
    }

    if (filterSort === 'rating') {
      filtered = [...filtered].sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
    } else if (filterSort === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    const CategoryIcon = icon;

    return (
      <div className="min-h-screen bg-[#0a0b10] pt-24 sm:pt-28 flex flex-col justify-between">
        <div className="px-4 sm:px-8 lg:px-12 pb-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#E50914] text-white shadow-lg shadow-red-900/40">
                <CategoryIcon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">{title}</h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5">{subTitle} (Trang {currentPage})</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Sắp xếp:
              </span>
              <select
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value as any)}
                className="bg-[#181824] border border-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
              >
                <option value="default">Mới & Nổi bật</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="name">Tên A-Z</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <Film className="w-12 h-12 mx-auto text-gray-600 mb-3" />
              <p className="text-lg font-bold text-white">Chưa tìm thấy phim phù hợp</p>
              <p className="text-xs text-gray-400 mt-1">Hệ thống đang tự động làm mới từ các server đối tác, vui lòng thử lại sau giây lát.</p>
              <Link to="/" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs">
                Quay lại Trang Chủ
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {filtered.map((movie) => (
                <div key={movie.id} className="flex justify-center">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 border border-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Trang Trước
              </button>

              <div className="flex items-center gap-1.5">
                {[Math.max(1, currentPage - 2), Math.max(1, currentPage - 1), currentPage, currentPage + 1, currentPage + 2].filter((v, i, a) => a.indexOf(v) === i && v > 0).slice(0, 5).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                      currentPage === p 
                        ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1 border border-white/10 transition-colors"
              >
                Trang Sau <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <Footer />
      </div>
    );
  }

  // Home Page View
  const heroMovie = heroCandidates[heroIndex] || homeMovies[0];
  const isHeroFavorite = heroMovie && Array.isArray(favorites) && favorites.includes(heroMovie.id);

  const toggleHeroFavorite = () => {
    if (!heroMovie) return;
    const safe = Array.isArray(favorites) ? favorites : [];
    if (isHeroFavorite) {
      setFavorites(safe.filter(id => id !== heroMovie.id));
    } else {
      setFavorites([...safe, heroMovie.id]);
    }
  };

  // Groupings for Home
  const top10 = homeMovies.slice(0, 10);
  const anime3D = homeMovies.filter(m => m.id.includes('hh3d') || m.name.toLowerCase().includes('3d') || m.name.toLowerCase().includes('hoạt hình')).slice(0, 16);
  const seriesHot = homeMovies.filter(m => m.type === 'series' || m.id.includes('series')).slice(0, 16);
  const moviesHot = homeMovies.filter(m => m.type !== 'series' && !m.id.includes('series')).slice(0, 16);
  const trending = homeMovies.slice(10, 26);
  const recommended = homeMovies.slice(26, 42);

  const watchedMoviesMapped = watchedMovies.map((w: any) => ({
    id: w.movieId,
    name: w.movieName,
    poster: w.poster,
  })) as any[];

  const MovieRow = ({ title, list, icon: RowIcon, viewAllPath }: { title: string; list: UnifiedMovie[]; icon?: any; viewAllPath?: string }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const offset = direction === 'left' ? -400 : 400;
        scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      }
    };

    if (!list || list.length === 0) return null;

    return (
      <div className="py-4 sm:py-6 group/row relative">
        <div className="flex items-center justify-between px-4 sm:px-8 lg:px-12 mb-3">
          <div className="flex items-center gap-2.5">
            {RowIcon && <RowIcon className="w-5 h-5 text-[#E50914]" />}
            <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {title}
            </h2>
          </div>
          {viewAllPath && (
            <Link to={viewAllPath} className="text-xs text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors">
              Xem tất cả →
            </Link>
          )}
        </div>

        {/* Scroll Left Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-[#E50914] text-white flex items-center justify-center z-30 opacity-0 group-hover/row:opacity-100 transition-all duration-300 shadow-xl border border-white/20 hidden md:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Horizontal Card Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto px-4 sm:px-8 lg:px-12 pb-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {list.map((movie) => (
            <div key={movie.id} className="snap-start shrink-0">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/80 hover:bg-[#E50914] text-white flex items-center justify-center z-30 opacity-0 group-hover/row:opacity-100 transition-all duration-300 shadow-xl border border-white/20 hidden md:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] flex flex-col justify-between overflow-x-hidden">
      <div>
        {/* Hero Showcase Section */}
        {heroMovie && (
          <div className="relative w-full h-[75vh] sm:h-[88vh] lg:h-[92vh] overflow-hidden">
            {/* Background image & gradient masks */}
            <div className="absolute inset-0">
              <img 
                src={heroMovie.background || heroMovie.poster} 
                alt={heroMovie.name}
                className="w-full h-full object-cover object-center scale-105 transition-all duration-1000"
                referrerPolicy="no-referrer"
              />
              {/* Cinematic Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b10] via-[#0a0b10]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b10] via-[#0a0b10]/70 to-transparent" />
              <div className="absolute inset-0 bg-radial-at-c from-transparent via-black/20 to-[#0a0b10]/80" />
            </div>

            {/* Hero Metadata Info */}
            <div className="absolute bottom-16 sm:bottom-24 left-0 w-full px-4 sm:px-8 lg:px-12 z-20 max-w-3xl">
              {/* Badges */}
              {(() => {
                const heroMovieType = detectMovieType(heroMovie);
                const heroAudioInfo = detectAudioInfo(`${heroMovie.name} ${heroMovie.overview || ''}`, heroMovie.lang);
                const heroQualityInfo = detectQualityInfo(`${heroMovie.name} ${heroMovie.quality || ''}`, heroMovie.quality);

                return (
                  <div className="flex flex-wrap items-center gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider shadow-lg ${
                      heroMovieType.type === 'anime' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-amber-900/50' :
                      heroMovieType.type === 'series' ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-blue-900/50' :
                      'bg-[#E50914] text-white shadow-red-900/50'
                    }`}>
                      {heroMovieType.typeLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {heroMovie.rating || '8.9'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 text-gray-200">
                      {heroMovie.releaseInfo || '2026'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/10 text-gray-200">
                      {heroQualityInfo.qualityFull}
                    </span>
                    <span 
                      className={`px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider border shadow-sm ${
                        heroAudioInfo.audio.includes('+') 
                          ? 'bg-gradient-to-r from-red-600/40 to-amber-600/40 text-amber-300 border-amber-500/40'
                          : heroAudioInfo.audio === 'LT'
                          ? 'bg-blue-600/40 text-blue-300 border-blue-500/40'
                          : heroAudioInfo.audio === 'TM'
                          ? 'bg-purple-600/40 text-purple-300 border-purple-500/40'
                          : 'bg-red-600/30 text-red-300 border-red-500/30'
                      }`}
                      title={heroAudioInfo.audioFull}
                    >
                      {heroAudioInfo.audio} ({heroAudioInfo.audioFull})
                    </span>
                  </div>
                );
              })()}

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black mb-4 drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] text-white tracking-tight leading-none">
                {heroMovie.name}
              </h1>

              <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 max-w-xl mb-6 leading-relaxed drop-shadow">
                {heroMovie.overview || 'Trải nghiệm đỉnh cao phim điện ảnh với chất lượng hình ảnh 4K sắc nét, âm thanh sống động và nhiều server phát siêu mượt.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Link 
                  to={`/movie/${encodeURIComponent(heroMovie.id)}`}
                  className="flex items-center gap-2 bg-[#E50914] text-white px-6 sm:px-8 py-3 rounded-xl hover:bg-red-700 transition-all font-extrabold text-sm sm:text-base shadow-xl shadow-red-900/50 hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-white" />
                  Xem Ngay
                </Link>

                <button 
                  onClick={toggleHeroFavorite}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 sm:px-6 py-3 rounded-xl transition-all font-semibold text-sm sm:text-base backdrop-blur-md border border-white/15"
                >
                  <Heart className={`w-5 h-5 ${isHeroFavorite ? 'fill-[#E50914] text-[#E50914]' : ''}`} />
                  {isHeroFavorite ? 'Đã Lưu' : 'Danh Sách'}
                </button>

                <Link 
                  to={`/movie/${encodeURIComponent(heroMovie.id)}`}
                  className="flex items-center gap-2 bg-black/50 hover:bg-black/80 text-gray-200 px-5 sm:px-6 py-3 rounded-xl transition-all font-semibold text-sm sm:text-base backdrop-blur-md border border-white/10 hidden sm:flex"
                >
                  <Info className="w-5 h-5" />
                  Chi Tiết
                </Link>
              </div>
            </div>

            {/* Hero Switcher Indicators */}
            <div className="absolute bottom-6 right-4 sm:right-12 z-20 flex items-center gap-2">
              {heroCandidates.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    heroIndex === i ? 'w-8 bg-[#E50914]' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Content Rows */}
        <div className="-mt-12 sm:-mt-16 relative z-30 space-y-2 sm:space-y-4 pb-16">
          {user && watchedMoviesMapped.length > 0 && (
             <MovieRow title="Tiếp Tục Xem" list={watchedMoviesMapped} icon={Clock} />
          )}

          {/* Top 10 Today Section */}
          {top10.length > 0 && (
            <div className="py-6 px-4 sm:px-8 lg:px-12">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-6 h-6 text-[#E50914]" />
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  TOP 10 PHIM XEM NHIỀU HÔM NAY
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                {top10.map((movie, idx) => (
                  <div key={movie.id} className="relative flex items-center snap-start shrink-0">
                    <span className="text-6xl sm:text-8xl font-black text-white/10 stroke-red-500 font-mono -mr-4 sm:-mr-6 z-0 select-none">
                      {idx + 1}
                    </span>
                    <div className="z-10">
                      <MovieCard movie={movie} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MovieRow title="Hoạt Hình 3D & Anime Hot" list={anime3D} icon={Sparkles} viewAllPath="/?category=anime" />
          <MovieRow title="Phim Bộ Đặc Sắc" list={seriesHot} icon={Tv} viewAllPath="/?category=series" />
          <MovieRow title="Phim Chiếu Rạp Mới Nhất" list={moviesHot} icon={Film} viewAllPath="/?category=movie" />
          <MovieRow title="Thịnh Hành & Đề Xuất Cho Bạn" list={trending} icon={Flame} viewAllPath="/?category=new" />
          <MovieRow title="Tuyển Tập Chọn Lọc" list={recommended} icon={Clock} viewAllPath="/?category=new" />
        </div>
      </div>

      <Footer />
    </div>
  );
}

