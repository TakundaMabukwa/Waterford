'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ScoreCardProps {
  value: string | number;
  label: string;
  barColor: string;
  backgroundColor?: string;
}

export function ScoreCard({ value, label, barColor, backgroundColor }: ScoreCardProps) {
  return (
    <Card
      className="relative overflow-hidden border border-gray-200 shadow-sm"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: barColor }} />
      <CardContent className="p-4 sm:p-5">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</div>
        <div className="mt-1 text-xs sm:text-sm text-gray-600">{label}</div>
      </CardContent>
    </Card>
  );
}
