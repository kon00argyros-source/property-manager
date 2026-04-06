import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import QuickActions from '@/components/home/QuickActions';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey(k => k + 1);

  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        refreshKey={refreshKey}
      />
      <main className={cn("transition-all duration-300 min-h-screen", sidebarOpen ? "lg:ml-64" : "lg:ml-16")}>
        <Outlet context={{ refreshKey }} />
      </main>
      <QuickActions onSaved={handleSaved} />
    </div>
  );
}
