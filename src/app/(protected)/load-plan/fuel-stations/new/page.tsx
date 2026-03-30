'use client'

import { useRouter } from 'next/navigation'

import { FuelStopForm } from '@/components/ui/fuel-stop-modal'

export default function NewFuelStationPage() {
  const router = useRouter()

  return (
    <div className="p-6">
      <FuelStopForm
        title="New Fuel Station"
        showBackButton
        backLabel="Back To Load Plan"
        onCancel={() => router.push('/load-plan')}
        onSaved={() => router.push('/load-plan')}
      />
    </div>
  )
}
