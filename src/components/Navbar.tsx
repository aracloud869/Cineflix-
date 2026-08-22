import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, Heart, Film, Tv, Sparkles, Flame, Clock, ChevronDown, Globe, Layers, Zap, Settings, User, LogOut } from 'lucide-react';
import { GENRES_LIST, COUNTRIES_LIST, SOURCES } from '../api';
import { useAppSettings } from '../context/SettingsContext';
import { AuthModal } from './AuthModal';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { AdminPanel } from './AdminPanel';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { setIsSettingsOpen, isLiteMode } = useAppSettings();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const { user, isAdmin } = useAuth();

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);


  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setIsMobileMenuOpen(false);
    }
  };

  const navCategories = [
    { label: 'Trang Chủ', path: '/', icon: Flame },
    { label: 'Phim Bộ', path: '/?category=series', icon: Tv },
    { label: 'Phim Lẻ', path: '/?category=movie', icon: Film },
    { label: 'Hoạt Hình 3D', path: '/?category=anime', icon: Sparkles },
    { label: 'TV Shows', path: '/?category=tvshows', icon: Tv },
    { label: 'Chiếu Rạp', path: '/?category=chieurap', icon: Film },
  ];

  const searchParams = new URLSearchParams(location.search);
  const currentCategory = searchParams.get('category');
  const currentGenre = searchParams.get('genre');
  const currentCountry = searchParams.get('country');
  const currentSource = searchParams.get('source');

  const isLinkActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' && !currentCategory && !currentGenre && !currentCountry && !currentSource;
    }
    if (path.includes('category=')) {
      const cat = path.split('category=')[1];
      return location.pathname === '/' && currentCategory === cat;
    }
    return location.pathname === path;
  };

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 transition-all duration-300 flex items-center justify-between px-4 sm:px-8 lg:px-12 ${
          isScrolled 
            ? 'bg-[#0a0b10]/95 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' 
            : 'bg-gradient-to-b from-[#0a0b10]/90 via-[#0a0b10]/50 to-transparent'
        }`}
      >
        {/* Left Side: Brand Logo + Nav Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link to="/" className="flex items-center gap-2 group" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="relative flex items-center">
              <span className="text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-r from-[#E50914] via-red-500 to-amber-500 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300">
                CINEFLIX
              </span>

            </div>
          </Link>

          {/* Desktop Navigation */}
          <div ref={dropdownRef} className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-sm font-medium">
            {navCategories.map((link) => {
              const active = isLinkActive(link.path);
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 ${
                    active 
                      ? 'bg-white/15 text-white font-bold shadow-sm border border-white/10' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[#E50914]' : 'text-gray-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Thể Loại Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'genres' ? null : 'genres')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  currentGenre ? 'bg-white/15 text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>Thể Loại</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'genres' ? 'rotate-180 text-red-500' : ''}`} />
              </button>

              {activeDropdown === 'genres' && (
                <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-[#10111a]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl grid grid-cols-2 gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {GENRES_LIST.map((g) => (
                    <Link
                      key={g.slug}
                      to={`/?genre=${g.slug}`}
                      onClick={() => setActiveDropdown(null)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        currentGenre === g.slug ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {g.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quốc Gia Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'countries' ? null : 'countries')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  currentCountry ? 'bg-white/15 text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>Quốc Gia</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'countries' ? 'rotate-180 text-red-500' : ''}`} />
              </button>

              {activeDropdown === 'countries' && (
                <div className="absolute top-full left-0 mt-2 w-56 p-3 bg-[#10111a]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl grid grid-cols-2 gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {COUNTRIES_LIST.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/?country=${c.slug}`}
                      onClick={() => setActiveDropdown(null)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        currentCountry === c.slug ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Nguồn Phát Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'sources' ? null : 'sources')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  currentSource ? 'bg-white/15 text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Nguồn VIP</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'sources' ? 'rotate-180 text-red-500' : ''}`} />
              </button>

              {activeDropdown === 'sources' && (
                <div className="absolute top-full left-0 mt-2 w-56 p-2 bg-[#10111a]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { id: 'kkphim', name: 'KKPhim Full HD' },
                    { id: 'nguonc', name: 'Nguồn C VIP' },
                    { id: 'stp', name: 'Siêu Tầm Phim' },
                    { id: 'hh3d', name: 'Hoạt Hình 3D' },
                    { id: 'vsmov', name: 'VM (vmos)' },
                    { id: 'clbpx', name: 'CLBPX (Phim Xưa)' },
                    { id: 'yan', name: 'YAN Hoạt Hình' },
                    { id: 'tr-movie', name: 'TR Phim Lẻ' },
                    { id: 'tr-series', name: 'TR Phim Bộ' },
                    { id: 'iptv', name: 'K20 Live TV 4K' },
                    { id: 'sports', name: 'K20 Thể Thao' },
                    { id: 'the-thao', name: 'Thể Thao (Genre)' },
                  ].map((s) => (
                    <Link
                      key={s.id}
                      to={`/?source=${s.id}`}
                      onClick={() => setActiveDropdown(null)}
                      className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        currentSource === s.id ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Side: Search bar & User controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          <form 
            onSubmit={handleSearch} 
            className={`flex items-center transition-all duration-300 rounded-full border ${
              isSearchOpen 
                ? 'bg-black/80 border-red-500/50 px-3 py-1.5 shadow-[0_0_15px_rgba(229,9,20,0.2)]' 
                : 'border-transparent bg-white/5 hover:bg-white/10 p-2'
            }`}
          >
            <button 
              type={isSearchOpen ? 'submit' : 'button'} 
              onClick={() => { if (!isSearchOpen) setIsSearchOpen(true); }}
              className="text-gray-300 hover:text-white transition-colors"
              title="Tìm kiếm phim"
            >
              <Search className="w-5 h-5" />
            </button>
            {isSearchOpen && (
              <div className="flex items-center">
                <input 
                  type="text" 
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tên phim, diễn viên..." 
                  className="bg-transparent border-none outline-none text-white text-xs sm:text-sm w-36 sm:w-60 px-2 placeholder-gray-400 font-normal"
                />
                <button 
                  type="button" 
                  onClick={() => setIsSearchOpen(false)}
                  className="text-gray-400 hover:text-white p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>

          <Link
            to="/my-list"
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors relative hidden sm:flex items-center justify-center"
            title="Danh sách của tôi"
          >
            <Heart className="w-5 h-5" />
          </Link>

          {/* App Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded-full transition-colors flex items-center justify-center ${
              isLiteMode 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
            }`}
            title="Cài đặt ứng dụng & Lite Mode"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Auth Button */}
          {user && isAdmin && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors flex items-center justify-center"
              title="Admin Panel"
            >
              <Zap className="w-5 h-5 text-yellow-500" />
            </button>
          )}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors flex items-center justify-center"
            title={user ? "Hồ sơ" : "Đăng nhập"}
          >
            {user && user.photoURL ? (
              <img src={user.photoURL} className="w-5 h-5 rounded-full" alt="Profile" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </button>

          {/* Mobile hamburger menu toggle */}
          <button 
            className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>

        {/* Auth Modal */}
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        <AdminPanel isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />

        {/* Mobile Dropdown Drawer (3-Gạch Menu) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed top-16 left-0 right-0 max-h-[85vh] overflow-y-auto bg-[#0c0d14]/98 backdrop-blur-2xl border-b border-white/10 p-5 flex flex-col gap-5 shadow-2xl z-50 animate-in slide-in-from-top duration-300">
            {/* Primary Categories */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Danh Mục Chính
              </div>
              <div className="grid grid-cols-2 gap-2">
                {navCategories.map((link) => {
                  const active = isLinkActive(link.path);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                        active 
                          ? 'bg-[#E50914] text-white font-bold shadow-lg shadow-red-900/30' 
                          : 'text-gray-300 hover:text-white bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Thể Loại */}
            <div className="space-y-1 border-t border-white/5 pt-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Thể Loại Phim
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {GENRES_LIST.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/?genre=${g.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-2.5 py-2 rounded-lg text-xs text-center transition-colors ${
                      currentGenre === g.slug ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile Quốc Gia */}
            <div className="space-y-1 border-t border-white/5 pt-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Quốc Gia
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COUNTRIES_LIST.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/?country=${c.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-2.5 py-2 rounded-lg text-xs text-center transition-colors ${
                      currentCountry === c.slug ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile Nguồn VIP */}
            <div className="space-y-1 border-t border-white/5 pt-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Nguồn VIP
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'kkphim', name: 'KKPhim Full HD' },
                  { id: 'nguonc', name: 'Nguồn C VIP' },
                  { id: 'stp', name: 'Siêu Tầm Phim' },
                  { id: 'hh3d', name: 'Hoạt Hình 3D' },
                  { id: 'vsmov', name: 'VM (vmos)' },
                  { id: 'clbpx', name: 'CLBPX (Phim Xưa)' },
                  { id: 'yan', name: 'YAN Hoạt Hình' },
                  { id: 'tr-movie', name: 'TR Phim Lẻ' },
                  { id: 'tr-series', name: 'TR Phim Bộ' },
                  { id: 'iptv', name: 'K20 Live TV 4K' },
                  { id: 'sports', name: 'K20 Thể Thao' },
                  { id: 'the-thao', name: 'Thể Thao (Genre)' },
                ].map((s) => (
                  <Link
                    key={s.id}
                    to={`/?source=${s.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-2.5 py-2 rounded-lg text-xs text-center transition-colors ${
                      currentSource === s.id ? 'bg-[#E50914] text-white font-bold' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile Quick Actions: Favorites & Settings */}
            <div className="border-t border-white/5 pt-4 space-y-2">
              <Link
                to="/my-list"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-sm shadow-lg shadow-red-950"
              >
                <Heart className="w-4 h-4 fill-white" />
                <span>Phim Yêu Thích & Lịch Sử Xem</span>
              </Link>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-colors"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Cài Đặt Ứng Dụng & Lite Mode</span>
              </button>
            </div>

          </div>
        )}
      </nav>
    </>
  );
}

