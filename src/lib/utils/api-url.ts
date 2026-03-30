function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizePath(path: string): string {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function shouldUseRelative(baseUrl?: string): boolean {
  if (!baseUrl) return true;
  if (typeof window === 'undefined') return false;
  try {
    const parsed = new URL(baseUrl, window.location.origin);
    return parsed.host !== window.location.host;
  } catch {
    return false;
  }
}

function buildUrl(path: string, baseUrl?: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = normalizePath(path);

  if (!normalizedBase || shouldUseRelative(normalizedBase)) return normalizedPath || '';
  return `${normalizedBase}${normalizedPath}`;
}

export function getApiUrl(path: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_HTTP_SERVER_ENDPOINT ||
    '';
  return buildUrl(path, baseUrl);
}

export function getReportsApiUrl(path: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_REPORTS_API_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_HTTP_SERVER_ENDPOINT ||
    '';
  return buildUrl(path, baseUrl);
}
