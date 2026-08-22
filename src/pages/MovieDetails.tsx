import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchUnifiedCatalog, fetchMeta, fetchStreams } from '../api';
import { Player } from '../components/Player';
import { MovieCard } from '../components/MovieCard';
import { Footer } from '../components/Footer';
import { 
  ArrowLeft, Play, Star, Heart, Bookmark, Share2, 
  Server, Film, Clock, Calendar, Globe, Tag, Check, 
  ChevronRight, Search as SearchIcon, Sparkles, Layers 
} from 'lucide-react';
import { Stream, Video } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { mapSourceName, extractSlug, detectAudioQualityInfo, detectAudioInfo, detectQualityInfo, detectMovieType } from '../utils';
import { useAuth } from '../context/AuthContext';
import { Comment } from '../types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../firebase';
import { saveWatchedMovie, saveComment, getComments, getSubtitles, saveSubtitle } from '../db/firestore';

export function MovieDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeStream, setActiveStream] = useState<Stream | null>(null);
  const [activeTab, setActiveTab] = useState<'episodes' | 'info' | 'recommendations' | 'comments'>('episodes');
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSubId, setLoadingSubId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [activeManualSubtitle, setActiveManualSubtitle] = useState<any | null>(null);
  
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState<number>(0);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0);
  const [copiedToast, setCopiedToast] = useState<'link' | 'id' | null>(null);

  const [favorites, setFavorites] = useLocalStorage<string[]>('cineflix-favorites', []);
  const [history, setHistory] = useLocalStorage<any[]>('cineflix-history', []);

  // 1. Get unified movie list to resolve sources
  const { data: movies = [] } = useQuery({
    queryKey: ['unified-catalog'],
    queryFn: fetchUnifiedCatalog,
  });

  const unifiedMovie = movies.find(m => m.id === id || (id && m.sourceIds.includes(id)));
  const movieSourceIds = unifiedMovie?.sourceIds || (id ? [id] : []);

  // 2. Fetch all metadata for all sources of this movie
  const { data: allMetas = [], isLoading: metaLoading } = useQuery({
    queryKey: ['meta-all', movieSourceIds],
    queryFn: async () => {
      if (!movieSourceIds.length) return [];
      const promises = movieSourceIds.map(srcId => 
        fetchMeta(srcId).catch(() => null)
      );
      const results = await Promise.all(promises);
      return results.filter(Boolean) as { meta: any }[];
    },
    enabled: movieSourceIds.length > 0,
  });

  const primaryMeta = allMetas[0]?.meta || {
    id: id || '',
    name: unifiedMovie?.name || 'Chi Tiết Phim',
    poster: unifiedMovie?.poster || '',
    background: unifiedMovie?.background || '',
    description: unifiedMovie?.overview || '',
    releaseInfo: unifiedMovie?.releaseInfo || '2026',
    videos: []
  };

  useEffect(() => {
    const fetchData = async () => {
      const targetId = primaryMeta.id || id;
      if (targetId) {
        console.log('Fetching comments and subtitles for:', targetId);
        const [commentsData, subtitlesData] = await Promise.all([
          getComments(targetId),
          getSubtitles(targetId)
        ]);
        setComments(commentsData);
        setSubtitles(subtitlesData);
      }
    };
    fetchData();
  }, [id, primaryMeta.id]);

  const handleAddComment = async () => {
    const targetId = primaryMeta.id || id;
    if (!user || !targetId || !newComment.trim()) return;
    await saveComment(targetId, user.uid, user.displayName || 'Người dùng', user.photoURL || '', newComment);
    setNewComment('');
    getComments(targetId).then(setComments);
  };

  const handleAddSubtitle = async () => {
    const targetId = primaryMeta.id || id;
    if (!user || !targetId || !subtitleFile) return;

    if (subtitleFile.size > 10 * 1024 * 1024) {
      alert('File quá lớn! Vui lòng chọn file dưới 10MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    console.log('--- BẮT ĐẦU QUÁ TRÌNH TẢI PHỤ ĐỀ (FAIL-SAFE MODE) ---');
    console.log('Target Movie ID:', targetId);
    
    try {
      // 1. Đọc nội dung file tại chỗ (để dự phòng)
      const fileReader = new FileReader();
      const fileContentPromise = new Promise<string>((resolve) => {
        fileReader.onload = (e) => resolve(e.target?.result as string || '');
        fileReader.readAsText(subtitleFile);
      });

      // 2. Thử tải lên Storage trước (Ưu tiên)
      const storagePath = `subtitles/${targetId}/${Date.now()}_${subtitleFile.name}`;
      const storageRef = ref(storage, storagePath);
      
      console.log('Bước 1: Thử gửi file lên Storage...');
      setUploadProgress(30);

      let finalUrl = '';
      try {
        await Promise.race([
          uploadBytes(storageRef, subtitleFile),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000))
        ]);
        finalUrl = await getDownloadURL(storageRef);
        console.log('Tải Storage thành công:', finalUrl);
        setUploadProgress(80);
      } catch (storageErr) {
        console.warn('Storage gặp sự cố (treo hoặc lỗi), chuyển sang chế độ Dự phòng Firestore...', storageErr);
        // Nếu Storage lỗi, lấy nội dung text để lưu trực tiếp
        const content = await fileContentPromise;
        finalUrl = `text-fallback:${content}`; // Đánh dấu đây là nội dung text trực tiếp
        setUploadProgress(70);
      }

      // 3. Save to Firestore
      console.log('Bước 2: Đang lưu thông tin vào Firestore cho ID:', targetId);
      await saveSubtitle(targetId, subtitleFile.name, finalUrl, user.uid);
      console.log('Bước 2 HOÀN TẤT.');
      
      setUploadProgress(100);
      alert('THÀNH CÔNG: Phụ đề đã được chia sẻ an toàn!');
      setSubtitleFile(null);
      setUploadProgress(0);
      
      // Refresh list
      const updatedSubtitles = await getSubtitles(targetId);
      setSubtitles(updatedSubtitles);
    } catch (error: any) {
      console.error('--- LỖI NGHIÊM TRỌNG ---', error);
      alert('Lỗi: ' + (error.message || 'Không thể lưu phụ đề. Vui lòng thử lại.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 3. Aggregate episodes across all sources
  const episodes = useMemo(() => {
    const epMap = new Map<number, { title: string; episodeNum: number; sourceVideoIds: string[] }>();
    
    allMetas.forEach(m => {
      if (m?.meta?.videos && Array.isArray(m.meta.videos)) {
        m.meta.videos.forEach((v: Video) => {
          const rawTitle = v.title || v.id || '';
          const num = v.episode || parseInt(rawTitle.replace(/\D/g, ''), 10) || 1;
          const displayTitle = rawTitle.startsWith('Tập') ? rawTitle : `Tập ${num}`;
          
          if (!epMap.has(num)) {
            epMap.set(num, {
              title: displayTitle,
              episodeNum: num,
              sourceVideoIds: [v.id]
            });
          } else {
            const existing = epMap.get(num)!;
            if (!existing.sourceVideoIds.includes(v.id)) {
              existing.sourceVideoIds.push(v.id);
            }
          }
        });
      }
    });

    const list = Array.from(epMap.values());
    list.sort((a, b) => a.episodeNum - b.episodeNum);
    return list;
  }, [allMetas]);

  const isSeries = episodes.length > 0 || (id && id.includes('series'));
  const currentEpisode = episodes[selectedEpisodeIdx] || (episodes.length > 0 ? episodes[0] : null);

  // Active source IDs to query streams for:
  const activeEpisodeSourceIds = useMemo(() => {
    if (isSeries && currentEpisode) {
      return currentEpisode.sourceVideoIds;
    }
    return movieSourceIds;
  }, [isSeries, currentEpisode, movieSourceIds]);

  // 4. Fetch streams for active episode/movie
  const { data: streams = [], isLoading: streamLoading } = useQuery({
    queryKey: ['streams-active', activeEpisodeSourceIds],
    queryFn: async () => {
      if (!activeEpisodeSourceIds.length) return [];
      const promises = activeEpisodeSourceIds.map(srcId => 
        fetchStreams(srcId).catch(() => ({ streams: [] }))
      );
      const results = await Promise.all(promises);
      const combined: Stream[] = [];
      const seenUrls = new Set<string>();

      results.forEach(res => {
        if (res.streams) {
          res.streams.forEach(s => {
            const urlKey = s.url || s.externalUrl || '';
            const nameKey = (s.name || s.sourceName || '').trim().toLowerCase();
            
            if (urlKey && !seenUrls.has(urlKey)) {
              const existingNameMatch = combined.find(existing => (existing.name || existing.sourceName || '').trim().toLowerCase() === nameKey);
              if (!existingNameMatch) {
                seenUrls.add(urlKey);
                combined.push(s);
              } else if (s.serverType === 'hls' && existingNameMatch.serverType !== 'hls') {
                const idx = combined.indexOf(existingNameMatch);
                combined[idx] = s;
                seenUrls.add(urlKey);
              }
            }
          });
        }
      });
      return combined;
    },
    enabled: activeEpisodeSourceIds.length > 0,
  });

  // Auto select best stream on streams loaded or episode changed
  useEffect(() => {
    async function setupStream() {
      if (streams.length > 0) {
        // Prioritize Vietsub or HLS/MP4 or first
        let best = streams.find(s => s.title?.toLowerCase().includes('vietsub') || s.name?.toLowerCase().includes('vietsub'))
                 || streams.find(s => s.serverType === 'hls' || s.serverType === 'mp4')
                 || streams[0];
        
        if (best.url && best.url.includes('torrentsdb.com')) {
          const { resolveStreamUrl } = await import('../lib/streamResolver');
          const resolvedUrl = await resolveStreamUrl(best, {
            name: primaryMeta.name,
            type: primaryMeta.type,
            season: currentEpisode?.season || 1,
            episode: currentEpisode?.episode || 1
          });
          best = { ...best, url: resolvedUrl };
        }
        setActiveStream(best);
      } else {
        setActiveStream(null);
      }
    }
    setupStream();
  }, [streams, primaryMeta.name]);

  // Record into watch history
  useEffect(() => {
    if (primaryMeta && primaryMeta.name && id) {
      if (primaryMeta.name === 'Chi Tiết Phim' || primaryMeta.name?.toLowerCase() === 'chi tiết phim') return;

      const currentHist = Array.isArray(history) ? history : [];
      const newItem = {
        movieId: id,
        movieName: primaryMeta.name,
        poster: primaryMeta.poster || primaryMeta.background || '',
        episodeId: currentEpisode?.sourceVideoIds?.[0],
        episodeTitle: currentEpisode?.title || 'Bản Đầy Đủ',
        updatedAt: Date.now()
      };
      const filtered = currentHist.filter((h: any) => h.movieId !== id && h !== id);
      setHistory([newItem, ...filtered].slice(0, 40));
      
      if (user) {
        saveWatchedMovie(user.uid, newItem);
      }
    }
  }, [id, currentEpisode?.title, primaryMeta?.name, user]);

  // Episode range chunking (50 episodes per tab)
  const CHUNK_SIZE = 50;
  const episodeRanges = useMemo(() => {
    const ranges = [];
    for (let i = 0; i < episodes.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, episodes.length);
      ranges.push({
        label: `Tập ${i + 1} - ${end}`,
        start: i,
        end: end
      });
    }
    return ranges;
  }, [episodes.length]);

  const filteredEpisodes = useMemo(() => {
    if (episodeSearch.trim()) {
      const q = episodeSearch.trim().toLowerCase();
      return episodes.filter(e => e.title.toLowerCase().includes(q) || e.episodeNum.toString().includes(q));
    }
    if (episodeRanges.length > 0) {
      const activeRange = episodeRanges[selectedRangeIdx] || episodeRanges[0];
      return episodes.slice(activeRange.start, activeRange.end);
    }
    return episodes;
  }, [episodes, episodeSearch, episodeRanges, selectedRangeIdx]);

  const handleGoBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch {
      window.location.href = '/';
    }
  };

  const isFavorite = Array.isArray(favorites) && favorites.includes(id || '');

  const toggleFavorite = () => {
    if (!id) return;
    const safeFavs = Array.isArray(favorites) ? favorites : [];
    if (isFavorite) {
      setFavorites(safeFavs.filter(fid => fid !== id));
    } else {
      setFavorites([...safeFavs, id]);
    }
  };

  const handleShare = (type: 'link' | 'id') => {
    if (type === 'link') {
      navigator.clipboard.writeText(window.location.href);
    } else {
      navigator.clipboard.writeText(id || '');
    }
    setCopiedToast(type);
    setTimeout(() => setCopiedToast(null), 2500);
  };

  const handleNextEpisode = () => {
    if (selectedEpisodeIdx < episodes.length - 1) {
      setSelectedEpisodeIdx(prev => prev + 1);
    }
  };

  const cleanDescription = (primaryMeta.description || '')
    .replace(/^Tên Phim : .*? Nội Dung Phim: /i, '')
    .replace(/^Nội dung: /i, '');

  const movieTypeInfo = useMemo(() => detectMovieType({
    id: primaryMeta.id || id,
    name: primaryMeta.name,
    videos: primaryMeta.videos || (episodes.length > 0 ? episodes : []),
    type: isSeries ? 'series' : 'movie'
  }), [primaryMeta, id, isSeries, episodes]);

  const audioInfo = useMemo(() => detectAudioInfo(
    `${primaryMeta.name} ${primaryMeta.description || ''}`, 
    primaryMeta.releaseInfo,
    streams
  ), [primaryMeta, streams]);

  const qualityInfo = useMemo(() => detectQualityInfo(
    `${primaryMeta.name} ${primaryMeta.description || ''}`,
    primaryMeta.releaseInfo
  ), [primaryMeta]);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-white flex flex-col justify-between pt-16 sm:pt-20">
      
      <div>
        {/* Sticky Video Player Container */}
        <div className="w-full bg-black relative z-30 shadow-[0_10px_40px_rgba(0,0,0,0.9)]">
          <div className="max-w-[1400px] mx-auto w-full">
            {streamLoading ? (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-[#0d0e15] border-b border-white/10">
                <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm font-medium animate-pulse">Đang kết nối luồng phim siêu tốc...</p>
              </div>
            ) : activeStream ? (
              <Player 
                stream={activeStream} 
                allStreams={streams} 
                onStreamChange={setActiveStream}
                onNextEpisode={handleNextEpisode}
                hasNextEpisode={selectedEpisodeIdx < episodes.length - 1}
                movieTitle={primaryMeta.name}
                originName={primaryMeta.originName}
                episodeTitle={currentEpisode?.title}
                episodes={episodes}
                currentEpisodeIdx={selectedEpisodeIdx}
                onSelectEpisode={setSelectedEpisodeIdx}
                onBack={handleGoBack}
                imdbId={primaryMeta.imdbId}
                movieId={primaryMeta.id || id}
                userSubtitles={activeManualSubtitle ? [activeManualSubtitle] : []}
              />
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center bg-[#0d0e15] border-b border-white/10 p-6 text-center">
                <Film className="w-12 h-12 text-gray-500 mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Chưa có link phát cho phần này</h3>
                <p className="text-gray-400 text-xs sm:text-sm max-w-sm mb-4">Vui lòng chọn tập khác hoặc kiểm tra lại sau vài phút.</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Info Area */}
        <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-8 py-6 lg:py-8">
          
          {/* Top Title & Quick Actions Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div className="flex items-start gap-4">
              <button 
                onClick={handleGoBack} 
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors shrink-0 mt-1 cursor-pointer"
                title="Quay lại"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                    movieTypeInfo.type === 'anime' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black' :
                    movieTypeInfo.type === 'series' ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white' :
                    'bg-[#E50914] text-white'
                  }`}>
                    {movieTypeInfo.typeLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-gray-300">
                    {primaryMeta.releaseInfo || '2026'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {primaryMeta.imdbRating || '8.9'} Điểm
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                    qualityInfo.quality === '4K'
                      ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                      : 'bg-white/10 text-gray-200'
                  }`}>
                    {qualityInfo.qualityFull}
                  </span>
                  <span 
                    className={`px-2.5 py-0.5 rounded text-[11px] font-black tracking-wider border shadow-sm ${
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
                    {audioInfo.audio} ({audioInfo.audioFull})
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {primaryMeta.name}
                </h1>
                {currentEpisode && isSeries && (
                  <p className="text-[#E50914] font-semibold text-sm mt-1">
                    Đang phát: {currentEpisode.title}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 self-start lg:self-center">
              <button 
                onClick={toggleFavorite}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-200 ${
                  isFavorite 
                    ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/40' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''}`} />
                <span>{isFavorite ? 'Đã Yêu Thích' : 'Yêu Thích'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleShare('link')}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors relative"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Copy Link</span>
                </button>
                <button 
                  onClick={() => handleShare('id')}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors relative"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Copy ID</span>
                </button>
                {copiedToast && (
                  <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-[#E50914] text-white text-[11px] font-bold shadow-lg animate-in fade-in zoom-in-95">
                    Đã copy {copiedToast === 'link' ? 'link' : 'ID'}!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Server & Stream Quick Pills */}
          {streams.length > 0 && (
            <div className="py-4 border-b border-white/10 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mr-2">
                <Server className="w-4 h-4 text-[#E50914]" />
                <span>CHỌN SERVER:</span>
              </div>
              {streams.map((s, idx) => {
                const isSelected = s === activeStream;
                const sourceName = mapSourceName(s.name || s.sourceName || `Server ${idx + 1}`, s.title || s.name);
                const sType = (s.serverType || 'hls').toUpperCase();
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveStream(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-red-600 to-[#E50914] text-white shadow-md shadow-red-900/40 scale-105' 
                        : 'bg-white/5 hover:bg-white/15 text-gray-300 border border-white/5'
                    }`}
                  >
                    <span>{sourceName}</span>
                    <span className="opacity-70 text-[9px] px-1 py-0.2 rounded bg-black/30 uppercase font-mono">{sType}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex gap-6 sm:gap-8 border-b border-white/10 mt-6 mb-6 font-bold text-sm overflow-x-auto whitespace-nowrap scrollbar-none scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button 
              onClick={() => setActiveTab('episodes')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
                activeTab === 'episodes' ? 'border-[#E50914] text-[#E50914]' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isSeries ? `DANH SÁCH TẬP (${episodes.length})` : 'SERVER & THÔNG TIN'}</span>
            </button>

            <button 
              onClick={() => setActiveTab('info')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
                activeTab === 'info' ? 'border-[#E50914] text-[#E50914]' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>NỘI DUNG PHIM</span>
            </button>

            <button 
              onClick={() => setActiveTab('recommendations')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
                activeTab === 'recommendations' ? 'border-[#E50914] text-[#E50914]' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>ĐỀ XUẤT TƯƠNG TỰ</span>
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
                activeTab === 'comments' ? 'border-[#E50914] text-[#E50914]' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>BÌNH LUẬN</span>
            </button>
            <button
              onClick={() => setActiveTab('subtitles')}
              className={`pb-3 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
                activeTab === 'subtitles' ? 'border-[#E50914] text-[#E50914]' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>PHỤ ĐỀ</span>
            </button>
          </div>

          {/* TAB 1: EPISODES & SERVERS */}
          {activeTab === 'episodes' && (
            <div className="space-y-6">
              {isSeries ? (
                <div className="bg-[#12131b] border border-white/5 rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <h3 className="font-extrabold text-lg text-white">Chọn Tập Phim</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                        Tổng {episodes.length} tập
                      </span>
                    </div>

                    {/* Search episode input */}
                    <div className="relative w-full sm:w-60">
                      <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Tìm tập (ví dụ: 10)..."
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Range Tabs for series with > 50 episodes */}
                  {episodeRanges.length > 1 && !episodeSearch && (
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                      {episodeRanges.map((range, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedRangeIdx(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                            selectedRangeIdx === idx 
                              ? 'bg-[#E50914] text-white' 
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Episode grid buttons */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 sm:gap-2.5">
                    {filteredEpisodes.map((ep, idx) => {
                      const actualIdx = episodes.indexOf(ep);
                      const isCurrent = actualIdx === selectedEpisodeIdx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedEpisodeIdx(actualIdx)}
                          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            isCurrent 
                              ? 'bg-[#E50914] text-white shadow-lg shadow-red-900/50 scale-105' 
                              : 'bg-white/5 hover:bg-white/15 text-gray-300 border border-white/5'
                          }`}
                        >
                          <span>{ep.title.replace(/Tập\s*/i, '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[#12131b] border border-white/5 rounded-2xl p-6">
                  <h3 className="font-bold text-lg text-white mb-3">Thông Tin Bản Chiếu</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {cleanDescription || 'Phim đã sẵn sàng với chất lượng cao nhất và âm thanh vòm sống động.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MOVIE FULL INFO */}
          {activeTab === 'info' && (
            <div className="bg-[#12131b] border border-white/5 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-lg text-white mb-2">Tóm Tắt Nội Dung</h3>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                  {cleanDescription || 'Đang cập nhật tóm tắt nội dung chi tiết cho tựa phim này.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-400 block mb-1">Năm phát hành:</span>
                  <span className="font-semibold text-white">{primaryMeta.releaseInfo || '2026'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1">Định dạng:</span>
                  <span className="font-semibold text-white">{movieTypeInfo.typeLabel} ({movieTypeInfo.type === 'series' ? 'Nhiều Tập' : 'Bản Đầy Đủ'})</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1">Âm thanh & Phụ đề:</span>
                  <span className="font-semibold text-white">
                    {audioInfo.audio} ({audioInfo.audioFull}) • {qualityInfo.qualityFull}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {movies
                  .filter(m => m.id !== id && (isSeries ? m.type === 'series' || m.id.includes('series') : m.type !== 'series'))
                  .slice(0, 18)
                  .map(m => (
                    <MovieCard key={m.id} movie={m} />
                  ))}
              </div>
            </div>
          )}

          {/* TAB 5: SUBTITLES */}
          {activeTab === 'subtitles' && (
            <div className="bg-[#12131b] border border-white/5 rounded-2xl p-6 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#E50914]" />
                    Phụ Đề Cộng Đồng
                  </h3>
                  <p className="text-gray-400 text-xs mt-1">Nơi chia sẻ phụ đề tiếng Việt cho cộng đồng.</p>
                </div>
                
                {user ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                    <input 
                      type="file" 
                      accept=".vtt,.srt" 
                      disabled={uploading}
                      onChange={(e) => setSubtitleFile(e.target.files ? e.target.files[0] : null)} 
                      className="text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer disabled:opacity-50"
                    />
                    <button 
                      onClick={handleAddSubtitle} 
                      disabled={uploading || !subtitleFile} 
                      className="w-full sm:w-auto bg-[#E50914] text-white py-1.5 px-4 rounded-lg text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px] relative overflow-hidden"
                    >
                      {uploading && (
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      )}
                      {uploading ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <Share2 className="w-3 h-3" />}
                      <span>{uploading ? `Đang tải ${Math.round(uploadProgress)}%` : 'Đóng góp'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium">
                    Vui lòng đăng nhập để đóng góp phụ đề.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Danh sách phụ đề</h4>
                
                {subtitles.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide select-none">
                    {subtitles.map((s, idx) => {
                      const isFallback = s.fileUrl?.startsWith('text-fallback:');
                      const downloadUrl = isFallback 
                        ? URL.createObjectURL(new Blob([s.fileUrl.replace('text-fallback:', '')], { type: 'text/vtt' }))
                        : s.fileUrl;
                        
                      return (
                        <button 
                          key={s.id || idx} 
                          onClick={async () => {
                              if (loadingSubId) return;
                              setLoadingSubId(s.id || s.fileUrl);
                              try {
                                  const response = await fetch(`/api/subtitles/proxy-cached?url=${encodeURIComponent(s.fileUrl)}&movieId=${primaryMeta.id || id}`);
                                  if (!response.ok) throw new Error('Failed to load subtitle');
                                  const content = await response.text();
                                  setActiveManualSubtitle({
                                      url: `text-fallback:${content}`,
                                      name: s.name,
                                      lang: s.lang,
                                      langName: s.langName,
                                      addon: 'Custom Loaded'
                                  });
                                  alert('Phụ đề đã được tải và áp dụng!');
                              } catch (err) {
                                  console.error(err);
                                  alert('Lỗi tải phụ đề!');
                              } finally {
                                  setLoadingSubId(null);
                              }
                          }}
                          className={`flex-shrink-0 w-64 p-4 bg-[#1a1b23] border border-white/5 rounded-xl hover:border-red-500/50 hover:bg-[#20212e] transition-all group relative overflow-hidden ${loadingSubId === (s.id || s.fileUrl) ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {loadingSubId === (s.id || s.fileUrl) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              </div>
                          )}

                          <div className="absolute top-0 left-0 w-1 h-full bg-[#E50914] opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-start gap-3">
                            <div className="bg-white/5 w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center group-hover:bg-red-600/20 transition-colors">
                              <Globe className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate mb-1" title={s.name}>{s.name}</p>
                              <p className="text-[10px] text-gray-500 font-medium truncate">
                                {isFallback ? '⚡ Tốc độ cao' : '📁 File'} • {s.addedBy === user?.uid ? 'Tôi' : 'Cộng đồng'}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center bg-black/20 rounded-2xl border border-dashed border-white/10">
                    <Globe className="w-10 h-10 text-gray-600 mb-3" />
                    <p className="text-gray-500 text-sm">Chưa có phụ đề nào được tải lên cho phim này.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold">Bình luận</h3>
              {user ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full bg-[#1a1b23] text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E50914]"
                    rows={3}
                    placeholder="Viết bình luận..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    onClick={handleAddComment}
                    className="bg-[#E50914] text-white py-2 px-4 rounded-lg font-bold hover:bg-red-700 transition"
                  >
                    Đăng bình luận
                  </button>
                </div>
              ) : (
                <p className="text-gray-400">Vui lòng đăng nhập để bình luận.</p>
              )}
              <div className="space-y-4 mt-6">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#1a1b23] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={c.userAvatar || '/default-avatar.png'} alt={c.userName} className="w-8 h-8 rounded-full" />
                      <span className="font-bold">{c.userName}</span>
                      <span className="text-gray-500 text-sm">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p>{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
}
