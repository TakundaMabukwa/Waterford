'use client'

import { Suspense } from 'react'
import { FuelComparisonView } from '@/components/fuel-system/components/views/FuelComparisonView'

export default function FuelComparisonPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading fuel comparison...</div>}>
      <div className="min-h-full bg-slate-50">
        <div className="space-y-4 px-3 pb-6 pt-3 sm:px-4 lg:px-6">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
            <div className="max-w-7xl mx-auto">
              <h1 className="mb-1 text-xl font-semibold text-gray-900 sm:text-2xl">Fuel Comparison</h1>
              <p className="break-words text-xs text-gray-500 sm:text-sm">Review fuel fills and thefts — confirm or investigate anomalies</p>
            </div>
          </div>
          <FuelComparisonView />
        </div>
      </div>
    </Suspense>
  )
}
