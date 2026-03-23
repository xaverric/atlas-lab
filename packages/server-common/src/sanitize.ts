/* eslint-disable no-control-regex */
const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /javascript:|data:|vbscript:/gi;
const NULL_BYTE_RE = /\x00/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

const stripTagsLoop = (str: string): string => {
  let prev = str;
  let result = str.replace(HTML_TAG_RE, '');
  while (result !== prev) {
    prev = result;
    result = result.replace(HTML_TAG_RE, '');
  }
  return result;
};

export const stripHtml = (input: string): string =>
  stripTagsLoop(
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
