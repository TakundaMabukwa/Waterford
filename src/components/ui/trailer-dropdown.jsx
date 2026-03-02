"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TrailerDropdown({ 
  value, 
  onChange, 
  trailers = [], 
  placeholder = "Select trailer"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const cleanValue = (value) => {
    if (value === null || value === undefined) return ''
    const text = String(value).trim()
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return ''
    return text
  }

  const getTrailerReg = (trailer) => cleanValue(trailer.registration_number)
  const getTrailerLabel = (trailer) => {
    const reg = getTrailerReg(trailer)
    const make = cleanValue(trailer.make)
    const model = cleanValue(trailer.model)
    const type = cleanValue(trailer.vehicle_type)
    const title = [make, model].filter(Boolean).join(' ')
    if (reg && title && type) return `${reg} - ${title} (${type})`
    if (reg && title) return `${reg} - ${title}`
    if (reg && type) return `${reg} (${type})`
    if (title && type) return `${title} (${type})`
    if (reg) return reg
    if (title) return title
    if (type) return `Trailer (${type})`
    return `Trailer #${trailer.id}`
  }

  const cleanTrailers = trailers.filter((trailer) => {
    const reg = getTrailerReg(trailer)
    const make = cleanValue(trailer.make)
    const model = cleanValue(trailer.model)
    return Boolean(reg || make || model)
  })

  const filteredTrailers = trailers.filter(trailer =>
    getTrailerReg(trailer).toLowerCase().includes(searchTerm.toLowerCase()) ||
    cleanValue(trailer.make).toLowerCase().includes(searchTerm.toLowerCase()) ||
    cleanValue(trailer.model).toLowerCase().includes(searchTerm.toLowerCase()) ||
    cleanValue(trailer.vehicle_type).toLowerCase().includes(searchTerm.toLowerCase())
  ).filter((trailer) => cleanTrailers.some((candidate) => candidate.id === trailer.id))

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

  const handleSelect = (trailer) => {
    onChange(trailer.id.toString())
    setIsOpen(false)
    setSearchTerm('')
  }

  const selectedTrailer = cleanTrailers.find(t => t.id.toString() === value)
  const displayValue = selectedTrailer ? getTrailerLabel(selectedTrailer) : ''

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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-0 text-popover-foreground shadow-md max-h-80">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={searchInputRef}
              className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search trailers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filteredTrailers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No trailers match your search.' : 'No trailers found.'}
              </div>
            ) : (
              filteredTrailers.map((trailer) => (
                <div
                  key={trailer.id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === trailer.id.toString() && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(trailer)}
                >
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span>{getTrailerLabel(trailer)}</span>
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
