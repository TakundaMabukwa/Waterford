'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/components/fuel-system/contexts/AppContext';
import { BarChart3, FileText, Activity, TrendingUp } from 'lucide-react';

const topNavItems = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dash', icon: BarChart3 },
  { id: 'reports', label: 'Reports', mobileLabel: 'Reports', icon: FileText },
  { id: 'activity', label: 'Activity Report', mobileLabel: 'Activity', icon: Activity },
  { id: 'executive', label: 'Executive Dashboard', mobileLabel: 'Executive', icon: TrendingUp }
];

export function TopNavigation() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-2 sm:px-5 py-1.5 sm:py-2">
        <div className="flex items-center">
          <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:pb-0.5 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
          {topNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-200 sm:justify-start",
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">{item.mobileLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

