import Hls from 'hls.js';
import axios from 'axios';

/**
 * Cineflix OpenSubtitles Auto-Loader
 * 
 * @param videoUrl Link m3u8 của video
 * @param imdbId Mã IMDb (ví dụ: tt0468569)
 */
export async function loadCineflixPlayer(videoUrl: string, imdbId: string) {
  const video = document.getElementById('player') as HTMLVideoElement;
  if (!video) {
    console.error('Không tìm thấy thẻ video với id="player"');
    return;
  }

  // 1. Lấy link phụ đề từ Backend
  let subtitleUrl = '';
  try {
    const response = await axios.get(`/api/opensubtitles?imdb_id=${imdbId}`);
    if (response.data && response.data.success) {
      subtitleUrl = response.data.subtitle_url;
      console.log('Đã tìm thấy phụ đề:', subtitleUrl);
    }
  } catch (error) {
    console.error('Lỗi khi lấy phụ đề từ OpenSubtitles:', error);
  }

  // 2. Khởi tạo HLS.js để phát link .m3u8
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(videoUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.log('Tự động phát bị chặn, hãy nhấn Play:', e));
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Cho Safari/iOS
    video.src = videoUrl;
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(e => console.log('Tự động phát bị chặn:', e));
    });
  }

  // 3. Tự động nhúng thẻ <track> nếu có sub
  if (subtitleUrl) {
    // Xóa các track cũ nếu có
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = 'Tiếng Việt';
    track.srclang = 'vi';
    track.src = subtitleUrl;
    track.default = true;

    video.appendChild(track);
    
    // Đảm bảo phụ đề được hiển thị
    video.textTracks[0].mode = 'showing';
  }
}
