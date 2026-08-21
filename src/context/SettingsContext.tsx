import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  isLiteMode: boolean;
  toggleLiteMode: () => void;
  autoNextEpisode: boolean;
  toggleAutoNextEpisode: () => void;
  preferredServer: string;
  setPreferredServer: (server: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  clearAppCache: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLiteMode, setIsLiteMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('phim_lite_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [autoNextEpisode, setAutoNextEpisode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('phim_auto_next') !== 'false';
    } catch {
      return true;
    }
  });

  const [preferredServer, setPreferredServerState] = useState<string>(() => {
    try {
      return localStorage.getItem('phim_preferred_server') || 'ALL';
    } catch {
      return 'ALL';
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('phim_lite_mode', isLiteMode.toString());
      if (isLiteMode) {
        document.documentElement.classList.add('lite-mode');
      } else {
        document.documentElement.classList.remove('lite-mode');
      }
    } catch {}
  }, [isLiteMode]);

  useEffect(() => {
    try {
      localStorage.setItem('phim_auto_next', autoNextEpisode.toString());
    } catch {}
  }, [autoNextEpisode]);

  const setPreferredServer = (server: string) => {
    setPreferredServerState(server);
    try {
      localStorage.setItem('phim_preferred_server', server);
    } catch {}
  };

  const toggleLiteMode = () => setIsLiteMode(prev => !prev);
  const toggleAutoNextEpisode = () => setAutoNextEpisode(prev => !prev);

  const clearAppCache = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {}
  };

  return (
    <SettingsContext.Provider
      value={{
        isLiteMode,
        toggleLiteMode,
        autoNextEpisode,
        toggleAutoNextEpisode,
        preferredServer,
        setPreferredServer,
        isSettingsOpen,
        setIsSettingsOpen,
        clearAppCache,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within SettingsProvider');
  }
  return context;
};
