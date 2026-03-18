'use client';

import React from 'react';
import { FuelGaugesView } from '@/components/fuel-system/components/views/FuelGaugesView';
import { FuelReportsView } from '@/components/fuel-system/components/views/FuelReportsView';
import { ActivityReportView } from '@/components/fuel-system/components/views/ActivityReportView';
import { ExecutiveDashboardView } from '@/components/fuel-system/components/views/ExecutiveDashboardView';
import { useApp } from '@/components/fuel-system/contexts/AppContext';

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
