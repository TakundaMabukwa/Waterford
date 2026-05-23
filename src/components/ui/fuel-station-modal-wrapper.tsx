"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { FuelStopForm } from "@/components/ui/fuel-stop-modal"

interface FuelStationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function FuelStationModal({ open, onOpenChange, onSaved }: FuelStationModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[95vw] h-[95vh] bg-white shadow-xl border border-gray-200 rounded-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <DialogPrimitive.Title className="sr-only">Fuel Station Modal</DialogPrimitive.Title>
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2">
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
          <FuelStopForm
            title="New Fuel Station"
            showBackButton={false}
            backLabel="Back"
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false)
              onSaved()
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
