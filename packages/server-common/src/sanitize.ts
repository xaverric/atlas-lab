const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /javascript:|data:|vbscript:/gi;

export const stripHtml = (input: string): string =>
  input.replace(HTML_TAG_RE, '').replace(SCRIPT_RE, '');

export const sanitizeString = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
