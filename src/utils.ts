/**
 * Security & Sanitization utilities for MemeTinder
 */

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const clean = String(url).trim();
  if (clean.startsWith('https://') || clean.startsWith('http://') || clean.startsWith('/')) {
    return clean;
  }
  return '#';
}
