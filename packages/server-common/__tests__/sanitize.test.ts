import { describe, it, expect } from 'vitest';
import { stripHtml, sanitizeString } from '../src/sanitize.js';

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<b>bold</b>')).toBe('bold');
  });

  it('preserves plain text', () => {
    expect(stripHtml('hello world')).toBe('hello world');
  });

  it('handles nested tags', () => {
    expect(stripHtml('<div><span>nested</span></div>')).toBe('nested');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('strips script tags', () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('removes javascript: protocol strings', () => {
    const result = stripHtml('javascript:alert(1)');
    expect(result).not.toContain('javascript:');
  });

  it('removes data: protocol strings', () => {
    const result = stripHtml('data:text/html,<h1>xss</h1>');
    expect(result).not.toContain('data:');
  });

  it('strips null bytes', () => {
    expect(stripHtml('he\x00llo')).toBe('hello');
  });

  it('strips control characters', () => {
    expect(stripHtml('he\x01llo')).toBe('hello');
  });

  it('handles XSS img onerror vector', () => {
    const result = stripHtml('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});

describe('sanitizeString', () => {
  it('escapes HTML entities', () => {
    expect(sanitizeString('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(sanitizeString('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(sanitizeString('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeString("it's")).toBe("it&#x27;s");
  });

  it('strips null bytes', () => {
    expect(sanitizeString('he\x00llo')).toBe('hello');
  });

  it('strips control characters', () => {
    expect(sanitizeString('a\x01b')).toBe('ab');
  });
});
