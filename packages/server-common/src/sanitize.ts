/* eslint-disable no-control-regex */
const SCRIPT_RE = /javascript:|data:|vbscript:/gi;
const NULL_BYTE_RE = /\x00/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

const stripTags = (str: string): string => {
  let out = '';
  let inTag = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '<') { inTag = true; continue; }
    if (str[i] === '>') { inTag = false; continue; }
    if (!inTag) out += str[i];
  }
  return out;
};

export const stripHtml = (input: string): string =>
  stripTags(
    input
      .replace(NULL_BYTE_RE, '')
      .replace(CONTROL_CHAR_RE, '')
  ).replace(SCRIPT_RE, '');

export const sanitizeString = (input: string): string =>
  input
    .replace(NULL_BYTE_RE, '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
