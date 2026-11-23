import { describe, expect, it } from 'vitest';
import { linkInfo, normalizeUrl } from './linkEmbed';

describe('whiteboard links', () => {
  it('tidies addresses and rejects things that are not web links', () => {
    expect(normalizeUrl('example.com/page')).toBe('https://example.com/page');
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com/');
    expect(normalizeUrl('hello world')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('notaurl')).toBeNull();
  });

  it('previews Google Maps places, coordinates and searches', () => {
    const place = linkInfo('https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z/data=!3m1');
    expect(place?.provider).toBe('maps');
    expect(place?.embedUrl).toBe('https://maps.google.com/maps?q=Eiffel%20Tower&z=17&output=embed');
    expect(linkInfo('https://www.google.com/maps/@51.5007,-0.1246,15z')?.embedUrl).toBe('https://maps.google.com/maps?q=51.5007%2C-0.1246&z=15&output=embed');
    expect(linkInfo('https://maps.google.com/?q=Kyoto')?.embedUrl).toBe('https://maps.google.com/maps?q=Kyoto&output=embed');
    expect(linkInfo('https://www.google.fr/maps/search/caf%C3%A9+paris')?.embedUrl).toContain('q=caf%C3%A9%20paris');
    // Short share links can't be read without visiting them: shown as a link card.
    expect(linkInfo('https://maps.app.goo.gl/abc123')?.embedUrl).toBeNull();
  });

  it('previews YouTube, Vimeo and Spotify', () => {
    expect(linkInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(linkInfo('https://youtu.be/dQw4w9WgXcQ')?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(linkInfo('https://vimeo.com/76979871')?.embedUrl).toBe('https://player.vimeo.com/video/76979871');
    expect(linkInfo('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')?.embedUrl).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
  });

  it('keeps other sites as plain link cards', () => {
    expect(linkInfo('https://en.wikipedia.org/wiki/Lighthouse')).toEqual({ url: 'https://en.wikipedia.org/wiki/Lighthouse', host: 'en.wikipedia.org', provider: null, embedUrl: null });
  });
});
