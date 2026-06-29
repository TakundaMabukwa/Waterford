"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const COMMODITIES = [
  { comId: 'LITH', comGroup: '', comName: 'Lithium' },
  { comId: 'STL', comGroup: '', comName: 'Steel' },
  { comId: 'WIRE', comGroup: '', comName: 'Wire' },
  { comId: 'ALC', comGroup: '', comName: 'Alcohol' },
  { comId: 'GROC', comGroup: '', comName: 'Groceries' },
  { comId: 'CHR', comGroup: '', comName: 'Chrome' },
  { comId: 'PIG', comGroup: '', comName: 'Pig Iron' },
  { comId: 'PLC', comGroup: '', comName: 'Plastic Closures' },
  { comId: 'COIL', comGroup: '', comName: 'Coils' },
  { comId: 'TW', comGroup: '', comName: 'Train Wheels' },
  { comId: 'CHEP', comGroup: '', comName: 'Chep Pallets' },
  { comId: 'CIT', comGroup: '', comName: 'Citrus' },
  { comId: 'SNK', comGroup: '', comName: 'Snacks' },
  { comId: 'SOL', comGroup: '', comName: 'Solar Panels' },
  { comId: 'FPG', comGroup: '', comName: 'Fertilizer Plastic Granules' },
  { comId: 'CBL', comGroup: '', comName: 'Cable Reels' },
  { comId: 'PKG', comGroup: '', comName: 'Packaging Materials' },
  { comId: 'PRJ', comGroup: '', comName: 'Project Materials' },
  { comId: 'LUB', comGroup: '', comName: 'Lubricants' },
  { comId: 'PRL', comGroup: '', comName: 'Paper Reels' },
  { comId: 'SODA', comGroup: '', comName: 'Soda Ash' },
]

export function CommodityDropdown({ value, onChange, placeholder = "Select commodity" }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredCommodities = COMMODITIES.filter(commodity =>
    commodity.comId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    commodity.comName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (commodity) => {
    onChange(commodity.comId)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span>
          {value ? (
            <span>
              <span className="font-medium">{value}</span>
              {COMMODITIES.find(c => c.comId === value)?.comName && (
                <span className="text-muted-foreground ml-2">
                  - {COMMODITIES.find(c => c.comId === value).comName}
                </span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-0 text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={searchInputRef}
              className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search commodities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filteredCommodities.length === 0 ? (
              <div className="py-6 text-center text-sm">No commodities found.</div>
            ) : (
              filteredCommodities.map((commodity) => (
                <div
                  key={commodity.comId}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === commodity.comId && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(commodity)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{commodity.comId}</span>
                    {commodity.comName && (
                      <span className="text-xs text-muted-foreground">{commodity.comName}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}