import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronLeft, ChevronRight, Settings, DoorOpen, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { roomNamesCache } from '@/lib/roomNames';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function Sidebar({ isOpen, onToggle, refreshKey }) {
  const location = useLocation();
  const [roomNames, setRoomNames] = useState({});
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    roomNamesCache.load().then(setRoomNames);
    const unsub = roomNamesCache.subscribe(setRoomNames);
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  // Load theme on mount
  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onToggle} />}
      {!isOpen && (
        <button onClick={onToggle} className="fixed top-4 left-3 z-50 lg:hidden w-9 h-9 rounded-lg bg-card border border-border shadow-md flex items-center justify-center">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full bg-card border-r border-border z-40 transition-all duration-300 flex flex-col",
        isOpen ? "w-64" : "w-16 -translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <button onClick={onToggle} className="flex items-center justify-center h-16 border-b border-border hover:bg-secondary/50 transition-colors shrink-0">
          {isOpen ? (
            <div className="flex items-center gap-3 px-4 w-full">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Home className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground text-sm truncate">Διαχείριση</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
            </div>
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Home */}
        <Link to="/" onClick={() => { if (window.innerWidth < 1024) onToggle(); }}
          className={cn("flex items-center gap-3 px-4 h-12 hover:bg-secondary/50 transition-colors border-b border-border/50 shrink-0", location.pathname === "/" && "bg-primary/10 text-primary")}>
          <Home className="w-5 h-5 shrink-0" />
          {isOpen && <span className="text-sm font-medium">Αρχική</span>}
        </Link>

        {/* Rooms */}
        <div className="flex-1 overflow-y-auto py-2">
          {isOpen && <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Δωμάτια</p>}
          {ROOMS.map((num) => {
            const isActive = location.pathname === `/room/${num}`;
            const displayName = roomNames[num] || `Δωμάτιο ${num}`;
            return (
              <Link key={num} to={`/room/${num}`} onClick={() => { if (window.innerWidth < 1024) onToggle(); }}
                className={cn("flex items-center gap-3 px-4 h-11 hover:bg-secondary/50 transition-colors mx-2 rounded-lg mb-0.5", isActive && "bg-primary/10 text-primary font-medium")}>
                {isOpen ? (<><DoorOpen className="w-4 h-4 shrink-0" /><span className="text-sm truncate">{displayName}</span></>) : (
                  <span className="text-sm font-bold w-full text-center">{num}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Dark mode toggle */}
        <button onClick={() => setDark(!dark)}
          className="flex items-center gap-3 px-4 h-12 border-t border-border hover:bg-secondary/50 transition-colors shrink-0">
          {dark ? <Sun className="w-5 h-5 shrink-0 text-yellow-500" /> : <Moon className="w-5 h-5 shrink-0 text-slate-500" />}
          {isOpen && <span className="text-sm font-medium">{dark ? 'Φωτεινό θέμα' : 'Σκοτεινό θέμα'}</span>}
        </button>

        {/* Settings */}
        <Link to="/settings" onClick={() => { if (window.innerWidth < 1024) onToggle(); }}
          className={cn("flex items-center gap-3 px-4 h-12 border-t border-border hover:bg-secondary/50 transition-colors shrink-0", location.pathname === "/settings" && "bg-primary/10 text-primary")}>
          <Settings className="w-5 h-5 shrink-0" />
          {isOpen && <span className="text-sm font-medium">Ρυθμίσεις</span>}
        </Link>
      </aside>
    </>
  );
}
