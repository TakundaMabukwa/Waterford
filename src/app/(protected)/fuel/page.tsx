// import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { AppProvider } from '@/components/fuel-system/contexts/AppContext';
import { UserProvider } from '@/components/fuel-system/contexts/UserContext';
//src\components\fuel-system\contexts\UserContext.tsx

const MainLayout = dynamic(
  () => import('@/components/fuel-system/components/layout/MainLayout').then((mod) => mod.MainLayout),
  {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading fuel dashboard...
      </div>
    ),
  }
)

function FuelPageContent() {
  return (
    <UserProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </UserProvider>
  )
}

export default async function FuelPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading fuel dashboard...</div>}>
      <FuelPageContent />
    </Suspense>
  )
}
