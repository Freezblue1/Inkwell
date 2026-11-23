/**
 * Links on the whiteboard: tidy a pasted address and, for services that allow
 * it, work out an embeddable preview (Google Maps, YouTube, Vimeo, Spotify).
 */

export type LinkProvider = 'maps' | 'youtube' | 'vimeo' | 'spotify';

export interface LinkInfo {
  url: string;
  host: string;
  provider: LinkProvider | null;
  /** iframe address for a live preview, or null if the site can't be embedded. */
  embedUrl: string | null;
}

/** "example.com/x" → "https://example.com/x"; null if it isn't a web address. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const plus = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));

function mapsEmbed(u: URL): string | null {
  const path = u.pathname;
  let q = u.searchParams.get('q') ?? u.searchParams.get('query');
  let z: string | null = null;
  const at = /@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/.exec(path);
  if (at) z = String(Math.round(Number(at[3])));
  const place = /\/maps\/(?:place|search)\/([^/@]+)/.exec(path);
  if (!q && place) q = plus(place[1]);
  if (!q && at) q = `${at[1]},${at[2]}`;
  const ll = u.searchParams.get('ll');
  if (!q && ll) q = ll;
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}${z ? `&z=${z}` : ''}&output=embed`;
}

export function linkInfo(raw: string): LinkInfo | null {
  const url = normalizeUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  let provider: LinkProvider | null = null;
  let embedUrl: string | null = null;

  if ((/(^|\.)google\.[a-z.]+$/.test(host) && u.pathname.startsWith('/maps')) || /^maps\.google\.[a-z.]+$/.test(host)) {
    provider = 'maps';
    embedUrl = mapsEmbed(u);
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    provider = 'youtube';
    const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : u.searchParams.get('v') ?? /\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname)?.[1];
    if (id && /^[\w-]{6,}$/.test(id)) embedUrl = `https://www.youtube-nocookie.com/embed/${id}`;
  } else if (host === 'vimeo.com') {
    provider = 'vimeo';
    const id = /^\/(\d+)/.exec(u.pathname)?.[1];
    if (id) embedUrl = `https://player.vimeo.com/video/${id}`;
  } else if (host === 'open.spotify.com') {
    provider = 'spotify';
    const m = /^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(u.pathname);
    if (m) embedUrl = `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
  }
  return { url, host, provider, embedUrl };
}

export const PROVIDER_LABELS: Record<LinkProvider, string> = { maps: 'Google Maps', youtube: 'YouTube', vimeo: 'Vimeo', spotify: 'Spotify' };
