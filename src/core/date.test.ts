import { describe, it, expect } from 'vitest';
import { toISODate } from './date.js';

describe('toISODate', () => {
  it('formats by the local calendar day, not UTC', () => {
    // Build a date from local components and expect them back unchanged —
    // toISOString() could roll this to the previous/next day depending on TZ.
    const local = new Date(2026, 4, 30, 1, 0, 0); // 2026-05-30 01:00 local
    expect(toISODate(local)).toBe('2026-05-30');
  });

  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
