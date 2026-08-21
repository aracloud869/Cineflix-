import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import axios from 'axios';
import { Stream } from '../types';
import { 
  Play, Pause, Maximize, Minimize, Settings, SkipForward, SkipBack, 
  Volume2, VolumeX, Volume1, RotateCcw, RotateCw, AlertTriangle, Moon, Sun, 
  Tv, Server, Check, ShieldCheck, Sparkles, FastForward, Rewind, Loader2,
  ListVideo, X, Search, Smartphone, ArrowLeft, Languages, Upload, Sliders
} from 'lucide-react';
import { mapSourceName, detectStreamType, formatDuration, cleanMediaUrl } from '../utils';

export interface PlayerEpisode {
  title: string;
  episodeNum: number;
  sourceVideoIds?: string[];
}

interface PlayerProps {
  stream: Stream;
  allStreams: Stream[];
  onStreamChange: (stream: Stream) => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  movieTitle?: string;
  episodeTitle?: string;
  episodes?: PlayerEpisode[];
  currentEpisodeIdx?: number;
  onSelectEpisode?: (index: number) => void;
  onBack?: () => void;
}

export const Player: React.FC<PlayerProps> = ({ 
  stream, 
  allStreams, 
  onStreamChange,
  onNextEpisode,
  hasNextEpisode = false,
  movieTitle,
  episodeTitle,
  episodes = [],
  currentEpisodeIdx = 0,
  onSelectEpisode,
  onBack
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [needsUnmutePrompt, setNeedsUnmutePrompt] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [selectedEpisodeRangeIdx, setSelectedEpisodeRangeIdx] = useState(0);
  const [rotationAngle, setRotationAngle] = useState<0 | 90 | 180 | 270>(0);
  const [rotateToast, setRotateToast] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [playerMode, setPlayerMode] = useState<'auto' | 'embed' | 'native'>('auto');
  const [retryCount, setRetryCount] = useState(0);

  // Auto audio preference (Lồng tiếng, Vietsub, Thuyết minh)
  const [autoAudioPref, setAutoAudioPref] = useState<'all' | 'long-tieng' | 'vietsub' | 'thuyet-minh'>(() => {
    return (localStorage.getItem('auto_audio_pref') as any) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('auto_audio_pref', autoAudioPref);
  }, [autoAudioPref]);

  // Auto-select stream based on preferred audio type
  useEffect(() => {
    if (autoAudioPref === 'all' || !allStreams || allStreams.length === 0) return;

    const match = allStreams.find(s => {
      const text = ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.sourceName || '')).toLowerCase();
      if (autoAudioPref === 'long-tieng') {
        return text.includes('lồng tiếng') || text.includes('long tieng') || text.includes('dub') || text.includes('lt');
      }
      if (autoAudioPref === 'thuyet-minh') {
        return text.includes('thuyết minh') || text.includes('thuyet minh') || text.includes('tm');
      }
      if (autoAudioPref === 'vietsub') {
        return text.includes('vietsub') || text.includes('phụ đề') || text.includes('phu de') || text.includes('sub') || text.includes('vs');
      }
      return false;
    });

    if (match && match !== stream) {
      onStreamChange(match);
    }
  }, [autoAudioPref, allStreams, stream, onStreamChange]);

  // Subtitle states from AIO Subtitle and SubDL addons
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<any | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<{ start: number; end: number; text: string }[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState({
    fontSize: 'lg',
    fontColor: '#ffffff',
    bgColor: 'rgba(0, 0, 0, 0.75)',
    offset: 0
  });

  // Fetch subtitles from AIO Subtitle & SubDL addons
  useEffect(() => {
    let isMounted = true;
    async function fetchSubs() {
      setIsLoadingSubtitles(true);
      try {
        const pathParts = window.location.pathname.split('/');
        const movieId = pathParts[pathParts.indexOf('watch') + 1] || 'tt1234567';
        const isSeries = episodes.length > 0;
        const epNum = (currentEpisodeIdx !== undefined ? currentEpisodeIdx + 1 : 1);

        const res = await axios.get('/api/subtitles', {
          params: {
            id: movieId,
            type: isSeries ? 'series' : 'movie',
            season: 1,
            episode: epNum
          }
        });

        if (isMounted && res.data && Array.isArray(res.data.subtitles)) {
          setSubtitles(res.data.subtitles);
          const viSub = res.data.subtitles.find((s: any) => (s.lang || '').toLowerCase().includes('vi') || (s.lang || '').toLowerCase().includes('vie'));
          if (viSub && !activeSubtitle) {
            setActiveSubtitle(viSub);
          } else if (res.data.subtitles.length > 0 && !activeSubtitle) {
            setActiveSubtitle(res.data.subtitles[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch subtitles:', err);
      } finally {
        if (isMounted) setIsLoadingSubtitles(false);
      }
    }

    fetchSubs();
    return () => {
      isMounted = false;
    };
  }, [stream, currentEpisodeIdx]);

  // Load and parse VTT cues when activeSubtitle changes
  useEffect(() => {
    if (!activeSubtitle || !activeSubtitle.url) {
      setSubtitleCues([]);
      setCurrentSubtitleText('');
      return;
    }

    let isMounted = true;
    async function loadSubFile() {
      try {
        if (activeSubtitle.url === 'local') return;
        const proxyUrl = `/api/subtitles/proxy?url=${encodeURIComponent(activeSubtitle.url)}`;
        const res = await axios.get(proxyUrl);
        const vttText = res.data;
        if (!isMounted) return;

        const cues = parseVttString(vttText);
        setSubtitleCues(cues);
      } catch (err) {
        console.error('Error loading subtitle file:', err);
        setSubtitleCues([]);
      }
    }

    loadSubFile();
    return () => {
      isMounted = false;
    };
  }, [activeSubtitle]);

  function parseVttString(vttString: string) {
    const cues: { start: number; end: number; text: string }[] = [];
    const lines = vttString.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      let line = lines[i].trim();
      if (line.includes('-->')) {
        const parts = line.split('-->');
        const start = parseTs(parts[0].trim());
        const end = parseTs(parts[1].trim());
        let textLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        cues.push({
          start,
          end,
          text: textLines.join('\n').replace(/<[^>]*>/g, '')
        });
      } else {
        i++;
      }
    }
    return cues;
  }

  function parseTs(timeStr: string) {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
    }
    return 0;
  }

  // Update subtitle text based on currentTime + offset
  useEffect(() => {
    if (subtitleCues.length === 0) {
      setCurrentSubtitleText('');
      return;
    }
    const adjustedTime = currentTime + subtitleSettings.offset;
    const match = subtitleCues.find(c => adjustedTime >= c.start && adjustedTime <= c.end);
    setCurrentSubtitleText(match ? match.text : '');
  }, [currentTime, subtitleCues, subtitleSettings.offset]);

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

  // Visual gesture feedback state
  const [feedback, setFeedback] = useState<{
    type: 'seek-backward' | 'seek-forward' | 'play' | 'pause' | null;
    key: number;
  }>({ type: null, key: 0 });

  const lastClickTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStreamType = detectStreamType(stream.url || stream.externalUrl);
  const isEmbed = playerMode === 'embed' || (!stream.url && !!stream.externalUrl) || (playerMode === 'auto' && currentStreamType === 'embed');
  const effectiveEmbedUrl = cleanMediaUrl(stream.externalUrl || stream.embedUrl || (currentStreamType === 'embed' ? stream.url : ''));

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showSettings && !showServerMenu && !showEpisodeMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, showSettings, showServerMenu, showEpisodeMenu]);

  // Episode chunking & filtering logic
  const EP_CHUNK_SIZE = 50;
  const episodeRanges = useMemo(() => {
    if (!episodes || episodes.length <= EP_CHUNK_SIZE) return [];
    const ranges = [];
    for (let i = 0; i < episodes.length; i += EP_CHUNK_SIZE) {
      const end = Math.min(i + EP_CHUNK_SIZE, episodes.length);
      ranges.push({
        label: `Tập ${i + 1} - ${end}`,
        start: i,
        end: end
      });
    }
    return ranges;
  }, [episodes]);

  useEffect(() => {
    if (currentEpisodeIdx !== undefined && episodeRanges.length > 0) {
      const rIdx = Math.floor(currentEpisodeIdx / EP_CHUNK_SIZE);
      if (rIdx >= 0 && rIdx < episodeRanges.length) {
        setSelectedEpisodeRangeIdx(rIdx);
      }
    }
  }, [currentEpisodeIdx, episodeRanges.length]);

  const filteredEpisodes = useMemo(() => {
    if (!episodes) return [];
    if (episodeSearch.trim()) {
      const q = episodeSearch.trim().toLowerCase();
      return episodes
        .map((ep, idx) => ({ ...ep, originalIdx: idx }))
        .filter(e => e.title.toLowerCase().includes(q) || e.episodeNum.toString().includes(q));
    }
    if (episodeRanges.length > 0) {
      const activeRange = episodeRanges[selectedEpisodeRangeIdx] || episodeRanges[0];
      return episodes
        .slice(activeRange.start, activeRange.end)
        .map((ep, idx) => ({ ...ep, originalIdx: activeRange.start + idx }));
    }
    return episodes.map((ep, idx) => ({ ...ep, originalIdx: idx }));
  }, [episodes, episodeSearch, episodeRanges, selectedEpisodeRangeIdx]);

  // Screen Rotation Handler (Physical Device Orientation Lock)
  const handleRotateScreen = async () => {
    try {
      const orientation = window.screen?.orientation || (window.screen as any)?.mozOrientation || (window.screen as any)?.msOrientation;
      if (orientation && typeof orientation.lock === 'function') {
        const currentType = orientation.type || '';
        if (currentType.startsWith('portrait')) {
          await orientation.lock('landscape').catch(() => {});
          setRotateToast('Đã xoay ngang màn hình');
        } else {
          await orientation.lock('portrait').catch(() => {});
          setRotateToast('Đã xoay dọc màn hình');
        }
      } else {
        setRotateToast('Hãy bật "Xoay tự động" trên điện thoại');
      }
    } catch {
      setRotateToast('Hãy bật "Xoay tự động" trên điện thoại');
    }
    setTimeout(() => setRotateToast(null), 2500);
  };


  // Attempt smart auto-failover
  const triggerAutoFailover = useCallback((reason: string) => {
    if (failoverTimeoutRef.current) clearTimeout(failoverTimeoutRef.current);
    setIsAutoSwitching(true);
    setIsBuffering(false);
    setErrorMessage(reason);

    failoverTimeoutRef.current = setTimeout(() => {
      // 1. Try embed player if available and not currently in embed
      if (effectiveEmbedUrl && playerMode !== 'embed') {
        setPlayerMode('embed');
        setIsAutoSwitching(false);
        setHasError(false);
        return;
      }

      // 2. Try next available server
      if (allStreams.length > 1) {
        const currentIndex = allStreams.findIndex(s => s === stream);
        const nextIndex = (currentIndex + 1) % allStreams.length;
        if (nextIndex !== currentIndex) {
          onStreamChange(allStreams[nextIndex]);
          setIsAutoSwitching(false);
          setHasError(false);
          return;
        }
      }

      // 3. If no other options, display error options
      setIsAutoSwitching(false);
      setHasError(true);
    }, 1200);
  }, [effectiveEmbedUrl, playerMode, allStreams, stream, onStreamChange]);

  // Helper safe play to handle browser autoplay policies
  const safePlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play();
      setIsPlaying(true);
      setHasError(false);
      setIsBuffering(false);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // Autoplay policy prevented playback with sound: mute and retry
        try {
          video.muted = true;
          setIsMuted(true);
          setNeedsUnmutePrompt(true);
          await video.play();
          setIsPlaying(true);
          setHasError(false);
          setIsBuffering(false);
        } catch {
          setIsPlaying(false);
        }
      } else {
        console.warn('Playback play() was rejected:', err);
        setIsPlaying(false);
      }
    }
  }, []);

  // Handle stream loading for videoRef
  useEffect(() => {
    setHasError(false);
    setErrorMessage('');
    setIsAutoSwitching(false);
    setIsBuffering(true);
    setNeedsUnmutePrompt(false);
    
    if (isEmbed || !stream.url) {
      setIsBuffering(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = cleanMediaUrl(stream.url);
    const isMp4 = url.includes('.mp4') || url.includes('.m4v') || url.includes('type=mp4') || url.includes('format=mp4');
    const isHlsStream = !isMp4 && (url.includes('.m3u8') || url.includes('proxy-playlist') || currentStreamType === 'hls');

    // Anti-0s stall watchdog for hh3d and direct streams
    const stallWatchdog = setTimeout(() => {
      const vid = videoRef.current;
      if (vid && vid.readyState >= 1 && vid.currentTime === 0 && vid.paused) {
        vid.currentTime = 0.01;
        safePlay(vid);
      }
    }, 1000);

    let errorTolerateCount = 0;

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        nudgeOffset: 0.15,
        nudgeMaxRetry: 5,
        maxFragLookUpTolerance: 0.25,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 1000,
        xhrSetup: function (xhr) {
          xhr.withCredentials = false;
        }
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setHasError(false);
        safePlay(video);
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          if (video && !video.paused) {
            video.currentTime += 0.15;
          }
          hls.recoverMediaError();
          return;
        }

        if (
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR || 
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR
        ) {
          console.warn('HLS Manifest error, fast failover to embed...', data);
          hls.destroy();
          hlsRef.current = null;
          triggerAutoFailover('Nguồn video STP đang tải qua Trình phát VIP Embed...');
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errorTolerateCount++;
              if (errorTolerateCount <= 2) {
                hls.startLoad();
              } else {
                triggerAutoFailover('Nguồn phát HLS bị gián đoạn CDN. Đang kết nối Trình phát VIP...');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              triggerAutoFailover('Đang kết nối Server dự phòng khả dụng...');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHlsStream) {
      // Native Apple HLS (Safari / iOS)
      video.src = url;
      video.load();
      safePlay(video);
    } else {
      video.src = url;
      video.load();
      safePlay(video);
    }

    return () => {
      clearTimeout(stallWatchdog);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (failoverTimeoutRef.current) {
        clearTimeout(failoverTimeoutRef.current);
      }
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }
    };
  }, [stream.url, isEmbed, retryCount, currentStreamType, triggerAutoFailover, safePlay]);

  // Anti-Stall / Infinite Buffering Watchdog
  useEffect(() => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);

    if (isBuffering && isPlaying && !isEmbed && !hasError && !isAutoSwitching) {
      // If buffering continues for 4 seconds, nudge buffer
      stallTimerRef.current = setTimeout(() => {
        const video = videoRef.current;
        if (video && !video.paused) {
          video.currentTime += 0.2;
          if (hlsRef.current) {
            hlsRef.current.recoverMediaError();
          }
        }

        // If still buffering after another 4 seconds, auto-failover
        stallTimerRef.current = setTimeout(() => {
          if (isBuffering && isPlaying && !hasError) {
            triggerAutoFailover('Đang tự động chuyển nguồn phát mượt hơn...');
          }
        }, 4000);
      }, 4000);
    }

    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [isBuffering, isPlaying, isEmbed, hasError, isAutoSwitching, triggerAutoFailover]);

  // Handle Playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle Volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Listen to Fullscreen changes from ESC key or browser native controls & manage orientation
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFs);

      // If exited fullscreen, unlock screen orientation
      if (!isCurrentlyFs) {
        try {
          if (window.screen?.orientation && typeof (window.screen.orientation as any).unlock === 'function') {
            (window.screen.orientation as any).unlock();
          } else if ((window.screen as any)?.unlockOrientation) {
            (window.screen as any).unlockOrientation();
          }
        } catch (err) {
          // Ignore orientation unlock errors
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skip(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skip(10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          setIsMuted(prev => !prev);
          break;
        case 't':
          e.preventDefault();
          setIsTheater(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen]);

  const triggerFeedback = (type: 'seek-backward' | 'seek-forward' | 'play' | 'pause') => {
    setFeedback({ type, key: Date.now() });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback({ type: null, key: 0 });
    }, 700);
  };

  const togglePlay = () => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      triggerFeedback('pause');
    } else {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            triggerFeedback('play');
          })
          .catch(err => {
            console.log('Play interrupted:', err);
            setIsPlaying(false);
          });
      }
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    resetControlsTimeout();
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const nextTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      triggerFeedback(seconds < 0 ? 'seek-backward' : 'seek-forward');
    }
    resetControlsTimeout();
  };

  // Dedicated Gesture Handler (Single Click -> Toggle Layer, Double Click -> Pause / Seek -10s / Seek +10s)
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEmbed) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickXRatio = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    // DOUBLE CLICK / TAP DETECTED (within 280ms)
    if (timeSinceLastClick < 280) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickTimeRef.current = 0;

      if (clickXRatio < 0.35) {
        // Double tap on LEFT side -> Seek backward 10s
        skip(-10);
      } else if (clickXRatio > 0.65) {
        // Double tap on RIGHT side -> Seek forward 10s
        skip(10);
      } else {
        // Double tap in CENTER -> Play / Pause
        togglePlay();
      }
      return;
    }

    // FIRST CLICK: Wait to distinguish from double click
    lastClickTimeRef.current = now;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    clickTimeoutRef.current = setTimeout(() => {
      // SINGLE CLICK CONFIRMED -> Toggle Controls Layer
      setShowControls(prev => {
        const nextState = !prev;
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (nextState && !showSettings && !showServerMenu && isPlaying) {
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
          }, 3500);
        }
        return nextState;
      });
      lastClickTimeRef.current = 0;
    }, 280);
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    // Only wake up controls if there was actual mouse movement (desktop)
    if (e.movementX !== 0 || e.movementY !== 0) {
      resetControlsTimeout();
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const isCurrentlyFs = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isCurrentlyFs) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        } else if (video && (video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.warn('requestFullscreen failed:', err);
      }

      // Automatically Lock Screen Orientation to Landscape
      try {
        if (window.screen?.orientation && typeof (window.screen.orientation as any).lock === 'function') {
          await (window.screen.orientation as any).lock('landscape').catch(() => {
            // Some browsers require 'landscape-primary'
            (window.screen.orientation as any).lock('landscape-primary').catch(() => {});
          });
        } else if ((window.screen as any)?.lockOrientation) {
          (window.screen as any).lockOrientation('landscape');
        } else if ((window.screen as any)?.mozLockOrientation) {
          (window.screen as any).mozLockOrientation('landscape');
        } else if ((window.screen as any)?.msLockOrientation) {
          (window.screen as any).msLockOrientation('landscape');
        }
      } catch (err) {
        console.warn('Orientation lock error:', err);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      } catch (err) {
        console.warn('exitFullscreen failed:', err);
      }

      // Unlock Screen Orientation
      try {
        if (window.screen?.orientation && typeof (window.screen.orientation as any).unlock === 'function') {
          (window.screen.orientation as any).unlock();
        } else if ((window.screen as any)?.unlockOrientation) {
          (window.screen as any).unlockOrientation();
        }
      } catch (err) {
        console.warn('Orientation unlock error:', err);
      }
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(prev => prev + 1);
  };

  const handleNextServer = () => {
    if (allStreams.length <= 1) return;
    const currentIndex = allStreams.findIndex(s => s === stream);
    const nextIndex = (currentIndex + 1) % allStreams.length;
    onStreamChange(allStreams[nextIndex]);
    setHasError(false);
  };

  const currentSourceName = mapSourceName(stream.name || stream.sourceName || 'Server VIP');

  return (
    <>
      {/* Lights off backdrop overlay */}
      {isLightsOff && (
        <div 
          className="fixed inset-0 bg-black/95 z-40 transition-opacity duration-500 cursor-pointer"
          onClick={() => setIsLightsOff(false)}
        />
      )}

      <div 
        ref={containerRef}
        className={`relative w-full bg-black overflow-hidden group select-none transition-all duration-300 ${
          isLightsOff ? 'z-50 shadow-[0_0_80px_rgba(229,9,20,0.3)]' : 'z-20'
        } ${isTheater ? 'aspect-[21/9] sm:h-[75vh]' : 'aspect-video'}`}
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={() => { if (!showSettings && !showServerMenu && isPlaying) setShowControls(false); }}
      >
        {/* EMBED PLAYER MODE */}
        {isEmbed && effectiveEmbedUrl ? (
          <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <iframe 
              src={effectiveEmbedUrl}
              className="w-full h-full border-0"
              allowFullScreen
              referrerPolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              title={movieTitle || 'Movie Player'}
            />
            {/* Embed floating quick switch pills */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 sm:gap-2 bg-black/85 backdrop-blur-md p-1.5 rounded-xl border border-white/20 z-30 shadow-xl">
              {episodes && episodes.length > 1 && (
                <button 
                  onClick={() => setShowEpisodeMenu(!showEpisodeMenu)}
                  className={`px-2 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1 ${
                    showEpisodeMenu ? 'bg-[#E50914] text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'
                  }`}
                  title="Chọn tập phim"
                >
                  <ListVideo className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden xs:inline">Tập</span>
                  <span>({currentEpisodeIdx + 1}/{episodes.length})</span>
                </button>
              )}
              {isFullscreen && (
                <button 
                  onClick={() => handleRotateScreen()}
                  className="p-1.5 rounded bg-white/10 text-gray-200 hover:bg-white/20 transition-colors"
                  title="Xoay màn hình thiết bị"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                onClick={() => setPlayerMode('native')}
                className="px-2.5 py-1 bg-[#E50914] text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors flex items-center gap-1.5"
              >

                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dùng Trình phát Gốc</span>
                <span className="sm:hidden">Gốc</span>
              </button>
              <button 
                onClick={() => setShowServerMenu(!showServerMenu)}
                className="px-2 py-1 bg-white/10 text-gray-200 text-xs font-medium rounded hover:bg-white/20 transition-colors flex items-center gap-1"
              >
                <Server className="w-3 h-3" />
                <span>Server</span>
              </button>
            </div>
          </div>
        ) : (
          /* NATIVE VIDEO / HLS MODE */
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out"
              style={{ 
                objectFit: aspectRatio,
                transform: rotationAngle !== 0 ? `rotate(${rotationAngle}deg) ${rotationAngle === 90 || rotationAngle === 270 ? 'scale(1.35)' : ''}` : undefined,
                transformOrigin: 'center center'
              }}
              onPlay={() => {
                setIsPlaying(true);
                setHasError(false);
                setIsBuffering(false);
              }}
              onPlaying={() => {
                setIsPlaying(true);
                setIsBuffering(false);
                setHasError(false);
              }}
              onWaiting={() => setIsBuffering(true)}
              onSeeking={() => setIsBuffering(true)}
              onSeeked={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onError={() => {
                triggerAutoFailover('Nguồn video không phản hồi. Đang tự động kết nối nguồn dự phòng...');
              }}
              playsInline
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />

            {/* Rotation Toast Badge Overlay */}
            {rotateToast && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-black/90 backdrop-blur-md border border-white/20 rounded-full shadow-2xl flex items-center gap-2 text-white text-xs font-bold animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                <RotateCw className="w-4 h-4 text-[#E50914] animate-spin" />
                <span>{rotateToast}</span>
              </div>
            )}

            {/* Buffering Indicator */}
            {isBuffering && !isAutoSwitching && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-25">
                <div className="p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex flex-col items-center gap-2 shadow-2xl animate-in fade-in duration-200">
                  <Loader2 className="w-8 h-8 text-[#E50914] animate-spin" />
                  <span className="text-xs text-gray-200 font-medium tracking-wide">Đang tối ưu luồng phát...</span>
                </div>
              </div>
            )}

            {/* CUSTOM SUBTITLE OVERLAY */}
            {currentSubtitleText && !isEmbed && (
              <div className="absolute bottom-16 sm:bottom-20 left-4 right-4 text-center z-25 pointer-events-none flex justify-center">
                <div 
                  className={`px-3.5 py-1.5 rounded-xl max-w-2xl text-center leading-relaxed transition-all ${
                    subtitleSettings.fontSize === 'sm' ? 'text-xs sm:text-sm' :
                    subtitleSettings.fontSize === 'base' ? 'text-sm sm:text-base' :
                    subtitleSettings.fontSize === 'lg' ? 'text-base sm:text-lg' :
                    subtitleSettings.fontSize === 'xl' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                  } font-bold shadow-2xl backdrop-blur-sm`}
                  style={{
                    color: subtitleSettings.fontColor,
                    backgroundColor: subtitleSettings.bgColor,
                    textShadow: '0 2px 4px rgba(0,0,0,0.95)',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {currentSubtitleText}
                </div>
              </div>
            )}

            {/* Unmute Prompt Banner if browser muted autoplay */}
            {needsUnmutePrompt && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                    setIsMuted(false);
                    setNeedsUnmutePrompt(false);
                  }
                }}
                className="absolute top-16 left-4 z-40 px-3 py-1.5 bg-[#E50914] hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 animate-bounce transition-all cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
                Âm thanh đang tắt (Nhấn vào đây để bật tiếng)
              </button>
            )}

            {/* Auto Switching Toast / Indicator */}
            {isAutoSwitching && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-40 animate-in fade-in duration-200">
                <Loader2 className="w-10 h-10 text-[#E50914] animate-spin mb-3" />
                <h3 className="text-base sm:text-lg font-bold text-white mb-1">Đang tự động chuyển nguồn phát...</h3>
                <p className="text-gray-300 text-xs sm:text-sm max-w-sm">{errorMessage || 'Đang kết nối Server dự phòng khả dụng...'}</p>
              </div>
            )}

            {/* Gesture & Click Interaction Surface */}
            <div 
              className="absolute inset-0 z-20 cursor-pointer"
              onClick={handleSurfaceClick}
            />

            {/* Dynamic Visual Ripple Feedback Indicators */}
            {/* Seek Backward (Left Ripple) */}
            {feedback.type === 'seek-backward' && (
              <div 
                key={feedback.key}
                className="absolute left-0 top-0 bottom-0 w-1/3 z-25 flex items-center justify-center pointer-events-none bg-gradient-to-r from-[#E50914]/30 to-transparent rounded-r-full animate-in fade-in zoom-in duration-200"
              >
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/70 backdrop-blur-md border border-white/20 shadow-2xl">
                  <Rewind className="w-8 h-8 text-white fill-white animate-pulse" />
                  <span className="text-xs font-black text-white mt-1">-10 Giây</span>
                </div>
              </div>
            )}

            {/* Seek Forward (Right Ripple) */}
            {feedback.type === 'seek-forward' && (
              <div 
                key={feedback.key}
                className="absolute right-0 top-0 bottom-0 w-1/3 z-25 flex items-center justify-center pointer-events-none bg-gradient-to-l from-[#E50914]/30 to-transparent rounded-l-full animate-in fade-in zoom-in duration-200"
              >
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/70 backdrop-blur-md border border-white/20 shadow-2xl">
                  <FastForward className="w-8 h-8 text-white fill-white animate-pulse" />
                  <span className="text-xs font-black text-white mt-1">+10 Giây</span>
                </div>
              </div>
            )}

            {/* Play/Pause Center Feedback */}
            {(feedback.type === 'play' || feedback.type === 'pause') && (
              <div 
                key={feedback.key}
                className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none animate-in zoom-in-75 fade-in duration-150"
              >
                <div className="p-5 rounded-full bg-black/80 backdrop-blur-lg border-2 border-white/30 shadow-2xl">
                  {feedback.type === 'play' ? (
                    <Play className="w-10 h-10 text-white fill-white ml-1" />
                  ) : (
                    <Pause className="w-10 h-10 text-white fill-white" />
                  )}
                </div>
              </div>
            )}

            {/* Error Overlay with One-Click Fallback */}
            {hasError && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-40">
                <AlertTriangle className="w-12 h-12 text-[#E50914] mb-3 animate-bounce" />
                <h3 className="text-lg font-bold text-white mb-2">Đang xử lý nguồn phát...</h3>
                <p className="text-gray-400 text-xs sm:text-sm max-w-md mb-6">{errorMessage}</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs sm:text-sm font-semibold flex items-center gap-2 border border-white/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Thử lại
                  </button>
                  {allStreams.length > 1 && (
                    <button
                      onClick={handleNextServer}
                      className="px-4 py-2 bg-[#E50914] hover:bg-red-700 text-white rounded-md text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-900/40"
                    >
                      <Server className="w-4 h-4" />
                      Chuyển sang Server tiếp theo ({allStreams.length} có sẵn)
                    </button>
                  )}
                  {effectiveEmbedUrl && (
                    <button
                      onClick={() => setPlayerMode('embed')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Bật Trình phát VIP Embed
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Top Bar Info & Quick Actions */}
            <div 
              className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 z-30 flex items-center justify-between pointer-events-auto ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <button
                  onClick={() => {
                    if (onBack) onBack();
                    else if (window.history.length > 2) window.history.back();
                    else window.location.href = '/';
                  }}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-white/20 text-gray-300 hover:text-white transition-colors border border-white/20 shrink-0 cursor-pointer flex items-center justify-center"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="text-white text-xs sm:text-sm font-medium truncate max-w-[180px] sm:max-w-md">
                  {movieTitle && <span className="font-bold">{movieTitle}</span>}
                  {episodeTitle && <span className="text-gray-300 ml-1.5 font-semibold text-red-400">- {episodeTitle}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Rotate Screen Button (Only in Fullscreen) */}
                {isFullscreen && (
                  <button
                    onClick={() => handleRotateScreen()}
                    className="p-1.5 rounded-full transition-colors flex items-center gap-1 bg-black/60 text-gray-300 hover:text-white border border-white/20"
                    title="Xoay màn hình thiết bị"
                  >
                    <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}


                <button
                  onClick={() => setIsLightsOff(!isLightsOff)}
                  className={`p-1.5 rounded-full transition-colors ${isLightsOff ? 'bg-amber-500 text-black' : 'bg-black/60 text-gray-300 hover:text-white border border-white/20'}`}
                  title={isLightsOff ? 'Bật đèn' : 'Tắt đèn xung quanh'}
                >
                  {isLightsOff ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
                <button
                  onClick={() => setIsTheater(!isTheater)}
                  className={`p-1.5 rounded-full transition-colors hidden sm:block ${isTheater ? 'bg-[#E50914] text-white' : 'bg-black/60 text-gray-300 hover:text-white border border-white/20'}`}
                  title="Chế độ rạp chiếu phim (Theater Mode)"
                >
                  <Tv className="w-4 h-4" />
                </button>
                {effectiveEmbedUrl && (
                  <button
                    onClick={() => {
                      const nextMode = playerMode === 'embed' ? 'native' : 'embed';
                      setPlayerMode(nextMode);
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors flex items-center gap-1 shadow-md"
                    title="Chuyển đổi giữa Trình phát HLS và Trình phát Gốc của nguồn"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{playerMode === 'embed' ? '⚡ Trình phát HLS' : '🌐 Trình phát Gốc'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div 
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 sm:p-4 transition-opacity duration-300 flex flex-col justify-end z-30 pointer-events-auto ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress Slider */}
              <div className="relative w-full mb-2 sm:mb-3 flex items-center group/scrub">
                <div className="relative w-full h-1 sm:h-1.5 bg-white/20 hover:h-2 sm:hover:h-2.5 rounded-full overflow-hidden transition-all">
                  {/* Buffer bar */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full"
                    style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                  />
                  {/* Played bar */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-[#E50914] rounded-full"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={currentTime} 
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between text-white text-xs sm:text-sm gap-1 sm:gap-2">
                <div className="flex items-center gap-1 sm:gap-3 min-w-0">
                  <button onClick={togglePlay} className="p-1 sm:p-1.5 hover:text-[#E50914] transition-colors shrink-0" title={isPlaying ? "Tạm dừng" : "Phát"}>
                    {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
                  </button>
                  <button onClick={() => skip(-10)} className="p-1 hover:text-gray-300 transition-colors hidden min-[440px]:flex items-center gap-0.5 shrink-0" title="Lùi 10 giây (Nhấp đúp bên trái)">
                    <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[9px] font-bold">10s</span>
                  </button>
                  <button onClick={() => skip(10)} className="p-1 hover:text-gray-300 transition-colors hidden min-[440px]:flex items-center gap-0.5 shrink-0" title="Tua 10 giây (Nhấp đúp bên phải)">
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[9px] font-bold">10s</span>
                  </button>

                  {/* Volume Group */}
                  <div className="flex items-center gap-1 group/volume shrink-0">
                    <button onClick={() => setIsMuted(!isMuted)} className="p-1 hover:text-gray-300 transition-colors shrink-0">
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                      ) : volume < 0.5 ? (
                        <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        setIsMuted(v === 0);
                      }}
                      className="w-14 sm:w-20 h-1 bg-white/30 rounded-full appearance-none accent-[#E50914] cursor-pointer hidden md:block"
                    />
                  </div>

                  <div className="text-gray-300 text-[10px] sm:text-xs font-mono shrink-0 ml-0.5">
                    <span className="text-white font-semibold">{formatDuration(currentTime)}</span>
                    <span className="mx-0.5 text-gray-500">/</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Episode Selector Button directly in Player controls */}
                  {episodes && episodes.length > 1 && (
                    <button 
                      onClick={() => {
                        setShowEpisodeMenu(!showEpisodeMenu);
                        setShowServerMenu(false);
                        setShowSettings(false);
                      }}
                      className={`px-2 py-1 rounded border text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                        showEpisodeMenu 
                          ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-900/50 scale-105' 
                          : 'bg-black/50 border-white/20 text-gray-200 hover:bg-white/10 hover:border-white/40'
                      }`}
                      title="Chọn tập phim trong trình phát"
                    >
                      <ListVideo className="w-3.5 h-3.5 text-red-400" />
                      <span className="hidden xs:inline">Chọn tập</span>
                      <span className="font-mono text-red-300 text-[10px] sm:text-[11px]">
                        ({currentEpisodeIdx + 1}/{episodes.length})
                      </span>
                    </button>
                  )}

                  {hasNextEpisode && onNextEpisode && (
                    <button 
                      onClick={onNextEpisode}
                      className="px-1.5 sm:px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] sm:text-xs font-bold text-gray-200 transition-colors flex items-center gap-1 shrink-0"
                      title="Chuyển tập tiếp theo"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tập tiếp</span>
                    </button>
                  )}

                  {/* Rotate Screen Button (Only in Fullscreen) */}
                  {isFullscreen && (
                    <button 
                      onClick={() => handleRotateScreen()}
                      className="p-1 sm:p-1.5 rounded transition-colors shrink-0 bg-black/50 border border-white/20 text-gray-200 hover:bg-white/10"
                      title="Xoay màn hình thiết bị"
                    >
                      <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}


                  {/* Subtitle menu button */}
                  <button
                    onClick={() => {
                      setShowSubtitleMenu(!showSubtitleMenu);
                      setShowServerMenu(false);
                      setShowSettings(false);
                      setShowEpisodeMenu(false);
                    }}
                    className={`px-1.5 sm:px-2.5 py-1 rounded border text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                      showSubtitleMenu ? 'bg-[#E50914] border-[#E50914] text-white' : 'bg-black/50 border-white/20 text-gray-200 hover:bg-white/10'
                    }`}
                    title="Chọn và tùy chỉnh phụ đề (AIO Subtitle & SubDL)"
                  >
                    <Languages className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden xs:inline">Sub</span>
                    {activeSubtitle && <span className="text-[10px] text-amber-300 uppercase font-mono">({activeSubtitle.lang || 'VIE'})</span>}
                  </button>

                  {/* Server quick picker */}
                  <button 
                    onClick={() => {
                      setShowServerMenu(!showServerMenu);
                      setShowSettings(false);
                      setShowEpisodeMenu(false);
                    }}
                    className={`px-1.5 sm:px-2.5 py-1 rounded border text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                      showServerMenu ? 'bg-[#E50914] border-[#E50914] text-white' : 'bg-black/50 border-white/20 text-gray-200 hover:bg-white/10'
                    }`}
                  >
                    <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden xs:inline">Server</span>
                    <span>({allStreams.length})</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowSettings(!showSettings);
                      setShowServerMenu(false);
                      setShowEpisodeMenu(false);
                    }} 
                    className={`p-1 sm:p-1.5 rounded transition-colors shrink-0 ${showSettings ? 'text-[#E50914]' : 'text-gray-300 hover:text-white'}`}
                    title="Cài đặt phát"
                  >
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Fullscreen button */}
                  <button 
                    onClick={toggleFullscreen} 
                    className="p-1 sm:p-1.5 text-white hover:text-[#E50914] bg-white/10 sm:bg-transparent rounded-lg sm:rounded-none transition-colors shrink-0" 
                    title="Toàn màn hình & Tự động xoay ngang (F)"
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* EPISODE SELECTION DRAWER / MODAL (Accessible in both native & embed modes) */}
        {showEpisodeMenu && episodes && episodes.length > 0 && (
          <div 
            className="absolute right-2 sm:right-4 bottom-16 sm:bottom-16 bg-black/95 border border-white/20 rounded-2xl p-3 sm:p-4 w-[calc(100%-1rem)] sm:w-96 max-h-[72vh] flex flex-col z-50 backdrop-blur-2xl shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-[#E50914]" />
                <span className="font-bold text-sm text-white">Danh Sách Tập Phim</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-300 bg-white/10 px-2 py-0.5 rounded-full font-mono">
                  {episodes.length} tập
                </span>
                <button 
                  onClick={() => setShowEpisodeMenu(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search & Range Tabs */}
            <div className="flex flex-col gap-2 mb-2.5 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Tìm nhanh số tập..." 
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914] transition-colors"
                />
                {episodeSearch && (
                  <button 
                    onClick={() => setEpisodeSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-[10px]"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {!episodeSearch && episodeRanges.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                  {episodeRanges.map((range, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => setSelectedEpisodeRangeIdx(rIdx)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${
                        selectedEpisodeRangeIdx === rIdx 
                          ? 'bg-[#E50914] text-white shadow-sm' 
                          : 'bg-white/5 hover:bg-white/10 text-gray-400'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode Grid Scrollable List */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[140px] max-h-[280px]">
              {filteredEpisodes.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  Không tìm thấy tập phù hợp
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  {filteredEpisodes.map((ep) => {
                    const isCurrent = ep.originalIdx === currentEpisodeIdx;
                    return (
                      <button
                        key={ep.originalIdx}
                        onClick={() => {
                          if (onSelectEpisode) onSelectEpisode(ep.originalIdx);
                          setShowEpisodeMenu(false);
                        }}
                        className={`py-2 px-1.5 rounded-lg text-center font-bold text-xs transition-all relative flex flex-col items-center justify-center gap-0.5 border ${
                          isCurrent 
                            ? 'bg-[#E50914] text-white border-red-500 shadow-md shadow-red-900/50 scale-[1.02]' 
                            : 'bg-white/5 hover:bg-white/15 text-gray-300 border-white/5 hover:border-white/20'
                        }`}
                        title={ep.title}
                      >
                        <span className="truncate w-full text-[11px]">
                          {ep.title.replace(/^Tập\s+/i, 'T.')}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono text-red-200 flex items-center gap-0.5">
                            <Play className="w-2 h-2 fill-current" /> Đang phát
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Server Selection Popover */}
        {showServerMenu && (
          <div 
            className="absolute right-4 bottom-16 bg-black/95 border border-white/20 rounded-xl p-3 w-80 max-h-[65vh] overflow-y-auto z-50 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#E50914]" />
                <span className="font-bold text-sm text-white">Danh sách Máy Chủ</span>
              </div>
              <span className="text-[11px] text-gray-400">{allStreams.length} luồng khả dụng</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {allStreams.map((s, idx) => {
                const isCurrent = s === stream;
                const sName = mapSourceName(s.name || s.sourceName || `Server ${idx + 1}`, s.title || s.name);
                const sTitle = s.title?.split('\n')?.[0] || 'Phát HD';
                const sType = detectStreamType(s.url || s.externalUrl);

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg transition-all flex items-center justify-between gap-2 ${
                      isCurrent 
                        ? 'bg-[#E50914]/20 border border-[#E50914] text-white' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => {
                        onStreamChange(s);
                        setPlayerMode('native');
                        setShowServerMenu(false);
                      }}
                      className="text-left flex-1 min-w-0 pr-1 flex flex-col"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs ${isCurrent ? 'text-[#E50914]' : 'text-white'}`}>{sName}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/10 text-gray-300 uppercase font-mono">
                          {sType}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 truncate mt-0.5">{sTitle}</span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(s.embedUrl || s.externalUrl) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStreamChange(s);
                            setPlayerMode('embed');
                            setShowServerMenu(false);
                          }}
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition-colors flex items-center gap-1 shadow"
                          title="Phát bằng trình phát gốc (Embed) của nguồn này"
                        >
                          <span>🌐 Gốc</span>
                        </button>
                      )}
                      {isCurrent && <Check className="w-4 h-4 text-[#E50914] shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div 
            className="absolute right-4 bottom-16 bg-black/95 border border-white/20 rounded-xl p-4 w-76 max-h-[65vh] overflow-y-auto z-50 backdrop-blur-xl shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-sm text-white mb-3 pb-1.5 border-b border-white/10 flex items-center justify-between">
              <span>Cài đặt Video & Màn hình</span>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Screen Rotation Setting */}
            {isFullscreen ? (
              <div className="mb-4">
                <span className="text-gray-400 block mb-1.5 font-medium">Xoay màn hình thiết bị</span>
                <button
                  onClick={handleRotateScreen}
                  className="w-full py-2 px-3 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-2 transition-colors border border-white/10"
                >
                  <RotateCw className="w-4 h-4 text-[#E50914]" />
                  <span>Xoay Ngang / Dọc màn hình</span>
                </button>
              </div>
            ) : (
              <div className="mb-4 p-2 bg-white/5 rounded text-[11px] text-gray-400 text-center border border-white/5">
                Bật <span className="text-white font-semibold">Toàn màn hình</span> để sử dụng tính năng xoay màn hình thiết bị
              </div>
            )}

            {/* Auto Audio Preference */}
            <div className="mb-4">
              <span className="text-gray-400 block mb-1.5 font-medium">Tự động chọn nguồn ưu tiên</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: 'all', label: 'Tất cả (Mặc định)' },
                  { id: 'long-tieng', label: '🎙️ Lồng tiếng' },
                  { id: 'vietsub', label: '🇻🇳 Vietsub' },
                  { id: 'thuyet-minh', label: '🎧 Thuyết minh' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setAutoAudioPref(opt.id as any)}
                    className={`py-1.5 px-2 rounded font-medium transition-colors text-left ${
                      autoAudioPref === opt.id ? 'bg-[#E50914] text-white font-bold' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>


            {/* Aspect Ratio */}
            <div className="mb-4">
              <span className="text-gray-400 block mb-1.5 font-medium">Tỷ lệ khung hình</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'contain', label: 'Vừa vặn' },
                  { id: 'cover', label: 'Cắt viền' },
                  { id: 'fill', label: 'Tràn viền' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setAspectRatio(opt.id as any)}
                    className={`py-1.5 px-2 rounded font-medium transition-colors ${
                      aspectRatio === opt.id ? 'bg-[#E50914] text-white font-bold' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed */}
            <div className="mb-4">
              <span className="text-gray-400 block mb-1.5 font-medium">Tốc độ phát</span>
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackRate(speed)}
                    className={`px-2.5 py-1.5 rounded font-mono font-medium shrink-0 transition-colors ${
                      playbackRate === speed ? 'bg-[#E50914] text-white font-bold' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Player Engine */}
            <div>
              <span className="text-gray-400 block mb-1.5 font-medium">Chế độ Player</span>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setPlayerMode('native');
                    setShowSettings(false);
                  }}
                  className={`p-2 rounded text-left transition-colors ${
                    playerMode === 'native' ? 'bg-[#E50914]/20 border border-[#E50914] text-white' : 'bg-white/5 text-gray-300'
                  }`}
                >
                  <span className="font-bold block">Trình phát HLS / MP4 Siêu Tốc</span>
                  <span className="text-[10px] text-gray-400">Tối ưu điều khiển, tua nhanh, full chức năng</span>
                </button>
                {effectiveEmbedUrl && (
                  <button
                    onClick={() => {
                      setPlayerMode('embed');
                      setShowSettings(false);
                    }}
                    className={`p-2 rounded text-left transition-colors ${
                      playerMode === 'embed' ? 'bg-[#E50914]/20 border border-[#E50914] text-white' : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <span className="font-bold block text-amber-400">Trình phát Nhúng VIP (Iframe)</span>
                    <span className="text-[10px] text-gray-400">Dùng khi server gốc bị nghẽn mạng</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTITLE MENU DRAWER / MODAL */}
        {showSubtitleMenu && (
          <div 
            className="absolute right-4 bottom-16 bg-black/95 border border-white/20 rounded-2xl p-4 w-80 sm:w-96 max-h-[75vh] overflow-y-auto z-50 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm text-white">Quản lý & Tùy Chỉnh Phụ Đề</span>
              </div>
              <button 
                onClick={() => setShowSubtitleMenu(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Subtitles Source List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider">Nguồn Phụ Đề (AIO & SubDL)</span>
                  {isLoadingSubtitles && <span className="text-amber-400 animate-pulse text-[10px]">Đang quét...</span>}
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  <button
                    onClick={() => {
                      setActiveSubtitle(null);
                      setShowSubtitleMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg font-semibold flex items-center justify-between transition-colors ${
                      !activeSubtitle ? 'bg-[#E50914] text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <span>Tắt phụ đề (Off)</span>
                    {!activeSubtitle && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  {subtitles.map((sub, idx) => {
                    const isCurrent = activeSubtitle?.url === sub.url;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveSubtitle(sub);
                          setShowSubtitleMenu(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors ${
                          isCurrent ? 'bg-[#E50914]/20 border border-[#E50914] text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white truncate">{sub.langName || sub.lang || 'Tiếng Việt'}</span>
                            <span className="px-1 py-0.2 rounded text-[8px] bg-amber-500/20 text-amber-300 font-mono uppercase">{sub.addon || 'Addon'}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 truncate mt-0.5">{sub.id || sub.url}</span>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-[#E50914] shrink-0" />}
                      </button>
                    );
                  })}

                  {!isLoadingSubtitles && subtitles.length === 0 && (
                    <div className="text-center py-3 text-gray-400 bg-white/5 rounded-lg text-[11px]">
                      Không tìm thấy phụ đề tự động. Tải file thủ công bên dưới.
                    </div>
                  )}
                </div>

                {/* Upload Custom Subtitle */}
                <div className="mt-2.5">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 font-semibold transition-colors flex items-center justify-center gap-1.5 border border-white/10">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tải file .srt / .vtt</span>
                    <input
                      type="file"
                      accept=".srt,.vtt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            if (content) {
                              const vttText = file.name.endsWith('.srt') ? srtToVtt(content) : content;
                              const cues = parseVttString(vttText);
                              setSubtitleCues(cues);
                              setActiveSubtitle({ lang: 'Custom', addon: 'Local Upload', url: 'local' });
                              setShowSubtitleMenu(false);
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Subtitle Customization */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <span className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider block">Tùy Chỉnh Giao Diện</span>

                {/* Font Size */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Cỡ chữ</span>
                  <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded border border-white/10">
                    {(['sm', 'base', 'lg', 'xl', '2xl'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setSubtitleSettings(prev => ({ ...prev, fontSize: sz }))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                          subtitleSettings.fontSize === sz ? 'bg-[#E50914] text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {sz === 'sm' ? 'Nhỏ' : sz === 'base' ? 'Vừa' : sz === 'lg' ? 'Lớn' : sz === 'xl' ? 'R.Lớn' : 'C.Lớn'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Color */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Màu chữ</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Trắng', val: '#ffffff' },
                      { label: 'Vàng', val: '#facc15' },
                      { label: 'Xanh lá', val: '#4ade80' },
                      { label: 'Xanh dương', val: '#38bdf8' },
                      { label: 'Đỏ', val: '#f87171' },
                    ].map((c) => (
                      <button
                        key={c.val}
                        onClick={() => setSubtitleSettings(prev => ({ ...prev, fontColor: c.val }))}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          subtitleSettings.fontColor === c.val ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.val }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Background Style */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Nền</span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                    {[
                      { label: 'Trong suốt', val: 'transparent' },
                      { label: 'Mờ', val: 'rgba(0, 0, 0, 0.75)' },
                      { label: 'Đen', val: '#000000' },
                    ].map((bg) => (
                      <button
                        key={bg.val}
                        onClick={() => setSubtitleSettings(prev => ({ ...prev, bgColor: bg.val }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          subtitleSettings.bgColor === bg.val ? 'bg-[#E50914] text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offset / Delay */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Độ trễ (Delay)</span>
                    <span className="font-mono text-amber-400 font-bold">{subtitleSettings.offset > 0 ? `+${subtitleSettings.offset}s` : `${subtitleSettings.offset}s`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.5"
                      value={subtitleSettings.offset}
                      onChange={(e) => setSubtitleSettings(prev => ({ ...prev, offset: parseFloat(e.target.value) }))}
                      className="flex-1 h-1 bg-white/25 rounded-full appearance-none accent-amber-400 cursor-pointer"
                    />
                    <button
                      onClick={() => setSubtitleSettings(prev => ({ ...prev, offset: 0 }))}
                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-mono"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
