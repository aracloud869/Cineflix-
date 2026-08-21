/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { MovieDetails } from './pages/MovieDetails';
import { Search } from './pages/Search';
import { MyList } from './pages/MyList';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { SettingsModal } from './components/SettingsModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <Router>
            <div className="min-h-screen bg-[#141414] font-sans text-white selection:bg-[#E50914] selection:text-white flex flex-col">
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/movie/:id" element={<MovieDetails />} />
                <Route path="/search" element={<Search />} />
                <Route path="/my-list" element={<MyList />} />
              </Routes>
              <SettingsModal />
            </div>
          </Router>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


