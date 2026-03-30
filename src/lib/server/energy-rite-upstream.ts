function normalizeBaseUrl(baseUrl?: string | null): string {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function getEnergyRiteReportsBaseUrl(): string {
  const baseUrl =
    process.env.ENERGY_RITE_REPORTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_REPORTS_API_URL ||
    (process.env.NEXT_PUBLIC_API_HOST && process.env.NEXT_PUBLIC_API_PORT
      ? `http://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}`
      : '') ||
    'http://138.197.183.168:4000';

  return normalizeBaseUrl(baseUrl);
}

export function buildEnergyRiteReportsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getEnergyRiteReportsBaseUrl()}${normalizedPath}`;
}
