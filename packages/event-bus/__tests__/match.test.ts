import { describe, it, expect } from 'vitest';
import { matchPattern } from '../src/match.js';

describe('matchPattern', () => {
  it('wildcard * matches everything', () => {
    expect(matchPattern('*', 'foo.bar.baz')).toBe(true);
  });

  it('exact match', () => {
    expect(matchPattern('foo.bar', 'foo.bar')).toBe(true);
    expect(matchPattern('foo.bar', 'foo.baz')).toBe(false);
  });

  it('trailing wildcard matches any suffix', () => {
    expect(matchPattern('foo.*', 'foo.bar')).toBe(true);
    expect(matchPattern('foo.*', 'foo.bar.baz')).toBe(true);
  });

  it('middle wildcard matches single segment', () => {
    expect(matchPattern('foo.*.baz', 'foo.bar.baz')).toBe(true);
    expect(matchPattern('foo.*.baz', 'foo.bar.qux')).toBe(false);
  });

  it('no match when event is shorter', () => {
    expect(matchPattern('foo.bar.baz', 'foo.bar')).toBe(false);
  });

  it('no match when event is longer without wildcard', () => {
    expect(matchPattern('foo.bar', 'foo.bar.baz')).toBe(false);
  });
});
