'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/components/fuel-system/contexts/AppContext';

const viewFallback = (
  <div className="flex min-h-[240px] items-center justify-center bg-white text-sm text-slate-500">
    Loading section...
  </div>
);

const FuelGaugesView = dynamic(
  () =>
    import('@/components/fuel-system/components/views/FuelGaugesView').then(
      (mod) => mod.FuelGaugesView
    ),
  { loading: () => viewFallback }
);

const FuelReportsView = dynamic(
  () =>
    import('@/components/fuel-system/components/views/FuelReportsView').then(
      (mod) => mod.FuelReportsView
    ),
  { loading: () => viewFallback }
);

const ActivityReportView = dynamic(
  () =>
    import('@/components/fuel-system/components/views/ActivityReportView').then(
      (mod) => mod.ActivityReportView
    ),
  { loading: () => viewFallback }
);

const ExecutiveDashboardView = dynamic(
  () =>
    import(
      '@/components/fuel-system/components/views/ExecutiveDashboardView'
    ).then((mod) => mod.ExecutiveDashboardView),
  { loading: () => viewFallback }
);

export function DashboardView() {
  const { activeTab } = useApp();

  // Route to appropriate view based on active tab
  switch (activeTab) {
    case 'reports':
      return <FuelReportsView onBack={() => {}} />;
    case 'activity':
      return <ActivityReportView onBack={() => {}} />;
    case 'executive':
      return <ExecutiveDashboardView onBack={() => {}} />;
    case 'dashboard':
    default:
      // Show Fuel Gauges for dashboard tab only
      return <FuelGaugesView onBack={() => {}} />;
  }
}
