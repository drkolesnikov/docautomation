import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../../utils/tokenEstimator';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns Math.ceil(length / 2.5) for a short string', () => {
    // 'hello' has length 5 → ceil(5/2.5) = 2
    expect(estimateTokens('hello')).toBe(2);
  });

  it('rounds up fractional results', () => {
    // length 1 → ceil(1/2.5) = ceil(0.4) = 1
    expect(estimateTokens('x')).toBe(1);
    // length 2 → ceil(2/2.5) = ceil(0.8) = 1
    expect(estimateTokens('ab')).toBe(1);
    // length 3 → ceil(3/2.5) = ceil(1.2) = 2
    expect(estimateTokens('abc')).toBe(2);
  });

  it('returns exact value when length is a multiple of 2.5', () => {
    // length 250 → ceil(250/2.5) = 100
    expect(estimateTokens('x'.repeat(250))).toBe(100);
    // length 500 → 200
    expect(estimateTokens('x'.repeat(500))).toBe(200);
  });

  it('handles longer strings correctly', () => {
    const text = 'a'.repeat(1000);
    expect(estimateTokens(text)).toBe(400);
  });
});
