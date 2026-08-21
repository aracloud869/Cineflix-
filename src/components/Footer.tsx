import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv, Sparkles, Flame, ShieldCheck, Zap, Heart, Globe, Play } from 'lucide-react';
import { GENRES_LIST, COUNTRIES_LIST } from '../api';

export function Footer() {
  return (
    <footer className="w-full bg-[#07080c] border-t border-white/10 text-gray-400 text-xs sm:text-sm mt-auto">
      {/* Top Banner Feature Ribbon */}
      <div className="border-b border-white/5 bg-gradient-to-r from-red-950/20 via-black to-red-950/20 py-4 px-4 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-white font-bold">Trạng thái hệ thống:</span>
            <span className="text-emerald-400 font-semibold">Tất cả 5 Server VIP đang hoạt động 100%</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> Tốc độ cao 4K</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Không quảng cáo độc hại</span>
            <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-red-400" /> Đa nguồn tự động thay thế</span>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
        
        {/* Brand Col */}
        <div className="lg:col-span-2 space-y-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E50914] via-red-500 to-amber-500 bg-clip-text text-transparent">
              CINEFLIX
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#E50914] text-white">
              VIP
            </span>
          </Link>

          <p className="text-gray-400 text-xs leading-relaxed max-w-sm">
            Nền tảng xem phim trực tuyến hàng đầu với kho phim khổng lồ, tự động tổng hợp từ nhiều nguồn phát siêu tốc (Ophim1, KKPhim, Nguồn C, Siêu Tầm Phim, Hoạt Hình 3D). Trải nghiệm hình ảnh chuẩn 4K và âm thanh vòm đỉnh cao.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300">
              ⚡ HLS Multi-bitrate
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300">
              🎬 Embed VIP Backup
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300">
              🛡️ Auto Fallback
            </span>
          </div>
        </div>

        {/* Categories Col */}
        <div className="space-y-3">
          <h4 className="text-white font-bold text-sm tracking-wider uppercase flex items-center gap-1.5">
            <Film className="w-4 h-4 text-[#E50914]" /> Danh Mục Phim
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/?category=movie" className="hover:text-white transition-colors">
                Phim Lẻ & Chiếu Rạp
              </Link>
            </li>
            <li>
              <Link to="/?category=series" className="hover:text-white transition-colors">
                Phim Bộ Nhiều Tập
              </Link>
            </li>
            <li>
              <Link to="/?category=anime" className="hover:text-white transition-colors">
                Hoạt Hình 3D & Anime
              </Link>
            </li>
            <li>
              <Link to="/?category=tvshows" className="hover:text-white transition-colors">
                TV Shows & Gameshow
              </Link>
            </li>
            <li>
              <Link to="/?category=chieurap" className="hover:text-white transition-colors">
                Phim Chiếu Rạp Mới
              </Link>
            </li>
            <li>
              <Link to="/?category=new" className="hover:text-white transition-colors">
                Mới Cập Nhật Hôm Nay
              </Link>
            </li>
          </ul>
        </div>

        {/* Genres Col */}
        <div className="space-y-3">
          <h4 className="text-white font-bold text-sm tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Thể Loại Hot
          </h4>
          <ul className="space-y-2 text-xs">
            {GENRES_LIST.slice(0, 6).map(g => (
              <li key={g.slug}>
                <Link to={`/?genre=${g.slug}`} className="hover:text-white transition-colors">
                  Phim {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Countries & Sources Col */}
        <div className="space-y-3">
          <h4 className="text-white font-bold text-sm tracking-wider uppercase flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-blue-400" /> Quốc Gia & Nguồn
          </h4>
          <ul className="space-y-2 text-xs">
            {COUNTRIES_LIST.slice(0, 5).map(c => (
              <li key={c.slug}>
                <Link to={`/?country=${c.slug}`} className="hover:text-white transition-colors">
                  Phim {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/my-list" className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1">
                <Heart className="w-3 h-3 fill-red-400" /> Phim Đã Lưu & Lịch Sử
              </Link>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Copyright & Disclaimer */}
      <div className="border-t border-white/5 py-6 px-4 sm:px-8 lg:px-12 text-center text-xs text-gray-500">
        <div className="max-w-4xl mx-auto space-y-2">
          <p>
            Tuyên bố miễn trừ trách nhiệm: Trang web không lưu trữ bất kỳ tệp video nào trên máy chủ riêng. Tất cả nội dung phim được tổng hợp tự động từ các dịch vụ bên thứ ba công khai trên Internet.
          </p>
          <p className="font-medium text-gray-400">
            © 2026 CINEFLIX VIP. All rights reserved. Trải nghiệm xem phim điện ảnh tốc độ cao.
          </p>
        </div>
      </div>
    </footer>
  );
}
