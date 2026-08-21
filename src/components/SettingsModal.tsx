import React from 'react';
import { useAppSettings } from '../context/SettingsContext';
import { Settings, Zap, Check, X, Shield, RefreshCw, Server, Play, Sparkles } from 'lucide-react';

export function SettingsModal() {
  const {
    isLiteMode,
    toggleLiteMode,
    autoNextEpisode,
    toggleAutoNextEpisode,
    preferredServer,
    setPreferredServer,
    isSettingsOpen,
    setIsSettingsOpen,
    clearAppCache,
  } = useAppSettings();

  if (!isSettingsOpen) return null;

  const serverOptions = [
    { id: 'ALL', name: 'Tất Cả Server', desc: 'Tự động chọn nguồn nhanh nhất' },
    { id: 'OP', name: 'Server OP (Ophim)', desc: 'Tốc độ cao, Vietsub chuẩn' },
    { id: 'KK', name: 'Server KK (KKPhim)', desc: 'Kho phim đa dạng 1080p' },
    { id: 'NC', name: 'Server NC (Nguồn C)', desc: 'Tốc độ load cực nhanh' },
    { id: 'STP', name: 'Server STP (Siêu Tầm)', desc: 'Nguồn phim tổng hợp chất lượng' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setIsSettingsOpen(false)}
    >
      <div 
        className="bg-[#12131e] border border-white/15 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E50914]/20 border border-red-500/30 text-[#E50914]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Cài Đặt Ứng Dụng</h2>
              <p className="text-xs text-gray-400">Tùy chỉnh hiệu năng & trải nghiệm xem phim</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lite Mode Toggle */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isLiteMode ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400'}`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Chế độ Lite Mode</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Siêu Mượt
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Tắt hiệu ứng mờ (backdrop-blur) & giảm đồ họa nặng, giúp điện thoại yếu chạy mượt mà, không giật lag.
              </p>
            </div>
          </div>
          <button
            onClick={toggleLiteMode}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isLiteMode ? 'bg-[#E50914]' : 'bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isLiteMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto Next Episode Toggle */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${autoNextEpisode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Tự động chuyển tập tiếp theo</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Tự động phát tập tiếp theo khi kết thúc phim bộ.
              </p>
            </div>
          </div>
          <button
            onClick={toggleAutoNextEpisode}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              autoNextEpisode ? 'bg-emerald-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                autoNextEpisode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Preferred Server Select */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Ưu tiên Server nguồn phát</span>
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {serverOptions.map((s) => (
              <button
                key={s.id}
                onClick={() => setPreferredServer(s.id)}
                className={`p-2.5 rounded-xl text-left transition-all flex items-center justify-between border ${
                  preferredServer === s.id
                    ? 'bg-[#E50914]/20 border-[#E50914] text-white font-bold'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">{s.name}</div>
                  <div className="text-[10px] text-gray-400">{s.desc}</div>
                </div>
                {preferredServer === s.id && <Check className="w-4 h-4 text-[#E50914] shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Cache Button */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-gray-400">Gặp sự cố tải phim?</div>
          <button
            onClick={clearAppCache}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-600/30 text-gray-200 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Xóa bộ nhớ đệm (Clear Cache)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
