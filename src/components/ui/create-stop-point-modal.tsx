"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LocationAutocomplete } from "@/components/ui/location-autocomplete"
import { MapPin, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface CreateStopPointModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateStopPointModal({ open, onOpenChange, onCreated }: CreateStopPointModalProps) {
  const supabase = createClient()
  const [name, setName] = useState("")
  const [name2, setName2] = useState("")
  const [location, setLocation] = useState("")
  const [locationSelection, setLocationSelection] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !location.trim()) return
    setSaving(true)

    try {
      let coordinates: number[][] = []
      if (locationSelection?.coordinates) {
        const [lng, lat] = locationSelection.coordinates
        const radius = 0.005
        coordinates = [
          [lng - radius, lat - radius],
          [lng + radius, lat - radius],
          [lng + radius, lat + radius],
          [lng - radius, lat + radius],
          [lng - radius, lat - radius],
        ]
      } else {
        const res = await fetch(`/api/location-lookup?q=${encodeURIComponent(location)}`)
        const data = await res.json()
        const first = Array.isArray(data?.results) ? data.results[0] : null
        if (first?.coordinates?.length >= 2) {
          const [lng, lat] = first.coordinates
          const radius = 0.005
          coordinates = [
            [lng - radius, lat - radius],
            [lng + radius, lat - radius],
            [lng + radius, lat + radius],
            [lng - radius, lat + radius],
            [lng - radius, lat - radius],
          ]
        }
      }

      if (coordinates.length === 0) {
        console.error("Could not determine coordinates")
        setSaving(false)
        return
      }

      const { error } = await supabase.from("stop_points").insert({
        name: name.trim(),
        name2: name2.trim() || null,
        coordinates: JSON.stringify(coordinates),
      })

      if (error) {
        console.error("Error creating stop point:", error)
        return
      }

      setName("")
      setName2("")
      setLocation("")
      setLocationSelection(null)
      onOpenChange(false)
      onCreated()
    } catch (err) {
      console.error("Error creating stop point:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Create Stop Point
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stop-name">Stop Name</Label>
            <Input
              id="stop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rustenburg Depot"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stop-name2">Alternative Name (optional)</Label>
            <Input
              id="stop-name2"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder="e.g. Waterfall Depot"
            />
          </div>

          <div className="space-y-2">
            <LocationAutocomplete
              label="Location"
              value={location}
              onChange={(value) => {
                setLocation(value)
                const stillMatches = locationSelection &&
                  (locationSelection.address === value || locationSelection.name === value)
                if (!stillMatches) setLocationSelection(null)
              }}
              onSelect={(suggestion) => {
                const coords = suggestion?.coordinates
                if (coords && coords.length >= 2) {
                  setLocationSelection(suggestion)
                }
                const displayValue =
                  suggestion?.type === "place" && suggestion?.name
                    ? suggestion.name
                    : (suggestion.address || suggestion.name || "")
                setLocation(displayValue)
              }}
              placeholder="Search for location"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !location.trim() || saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create Stop Point"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
