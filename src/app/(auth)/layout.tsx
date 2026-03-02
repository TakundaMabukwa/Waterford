'use client'

import { usePathname } from 'next/navigation'
import { WaterfordBrand } from '@/components/branding/waterford-brand'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#f8f6f2]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0C1E3D]/12 via-white to-[#E79B54]/15"></div>
      <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-[#0C1E3D] via-[#E79B54] to-[#0C1E3D]" />

      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-[#0C1E3D]/10 bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <WaterfordBrand showTagline />
          </div>
          <h1 className="mb-1 text-2xl font-bold text-[#0C1E3D]">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-sm text-gray-600">Fleet operations platform</p>
        </div>

        {children}

        <div className="mt-6 text-center text-xs text-gray-500">
          &copy; 2026 Waterford Carriers. All rights reserved.
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-20 w-full -skew-y-3 bg-gradient-to-r from-[#0C1E3D] via-[#0C1E3D]/75 to-[#E79B54]/80"></div>
    </div>
  )
}