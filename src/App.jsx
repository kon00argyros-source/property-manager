import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import RoomPage from '@/pages/RoomPage';
import RoomStatus from '@/pages/RoomStatus';
import Settings from '@/pages/Settings';
import PinLock from '@/components/PinLock';
import { autoCreateMonthlyRent } from '@/lib/rentAutoCreate';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked) autoCreateMonthlyRent();
  }, [unlocked]);

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomNumber" element={<RoomPage />} />
          <Route path="/room/:roomNumber/status" element={<RoomStatus />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-light text-slate-300 mb-4">404</h1>
              <a href="/" className="text-primary hover:underline">Αρχική</a>
            </div>
          </div>
        } />
      </Routes>
      <Toaster richColors position="top-right" />
    </Router>
  );
}
