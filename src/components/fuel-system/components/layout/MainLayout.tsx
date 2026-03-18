'use client';

import React from 'react';
import { TopNavigation } from './TopNavigation';
import { DashboardView } from '@/components/fuel-system/components/views/DashboardView';
import { useApp } from '../../contexts/AppContext';

export function MainLayout() {
  const { activeTab } = useApp();

  return (
    <div className="flex bg-gray-100 h-screen">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="sticky top-0 z-50">
          {['dashboard', 'reports', 'activity', 'executive'].includes(activeTab) && <TopNavigation />}
        </div>
        
        <main className="flex-1 overflow-auto">
          <DashboardView />
        </main>
      </div>
    </div>
  );
}

