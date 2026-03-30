export type FuelStopOverlay = {
  id: string
  name: string
  center: [number, number] | null
  polygon: [number, number][]
  radiusMeters: number
}

const isFinitePair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))

const normalizePair = (value: unknown): [number, number] | null => {
  if (isFinitePair(value)) {
    return [Number(value[0]), Number(value[1])]
  }

  if (typeof value === 'object' && value !== null) {
    const lng = Number((value as any).lng ?? (value as any).lon ?? (value as any).longitude)
    const lat = Number((value as any).lat ?? (value as any).latitude)
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat]
    }
  }

  return null
}

const parseCoordinateString = (value: string): [number, number][] => {
  const trimmed = value.trim()
  if (!trimmed) return []

  return trimmed
    .split(/\s+/)
    .map((part) => part.split(',').slice(0, 2).map(Number))
    .filter((pair): pair is [number, number] => isFinitePair(pair))
}

export const parseCoordinateCollection = (value: unknown): [number, number][] => {
  if (!value) return []

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      return parseCoordinateCollection(JSON.parse(trimmed))
    } catch {
      return parseCoordinateString(trimmed)
    }
  }

  if (Array.isArray(value)) {
    if (value.every((item) => isFinitePair(item) || (Array.isArray(item) && item.length >= 2))) {
      return value
        .map((item) => normalizePair(item))
        .filter((pair): pair is [number, number] => Boolean(pair))
    }

    return value
      .flatMap((item) => parseCoordinateCollection(item))
      .filter((pair): pair is [number, number] => Boolean(pair))
  }

  if (typeof value === 'object' && value !== null) {
    const pair = normalizePair(value)
    if (pair) return [pair]

    const nested =
      (value as any).coordinates ??
      (value as any).geometry?.coordinates ??
      (value as any).location ??
      (value as any).value

    return parseCoordinateCollection(nested)
  }

  return []
}

const averageCenter = (points: [number, number][]): [number, number] | null => {
  if (!points.length) return null
  const [lngSum, latSum] = points.reduce(
    (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
    [0, 0]
  )
  return [lngSum / points.length, latSum / points.length]
}

export const mapFuelStopToOverlay = (fuelStop: any): FuelStopOverlay | null => {
  const geozonePolygon = parseCoordinateCollection(fuelStop?.geozone_coordinates)
  const fallbackPolygon = parseCoordinateCollection(fuelStop?.coordinates)
  const polygon = geozonePolygon.length ? geozonePolygon : fallbackPolygon

  const locationPoint =
    parseCoordinateCollection(fuelStop?.location_coordinates)[0] ||
    parseCoordinateCollection(fuelStop?.coords)[0] ||
    null

  const center = locationPoint || averageCenter(polygon)

  if (!center && polygon.length === 0) return null

  return {
    id: String(fuelStop?.id ?? fuelStop?.name ?? Math.random()),
    name: String(
      fuelStop?.geozone_name ||
        fuelStop?.name ||
        fuelStop?.name2 ||
        'Fuel Stop'
    ),
    center,
    polygon,
    radiusMeters: Number(fuelStop?.radius) || 100,
  }
}
