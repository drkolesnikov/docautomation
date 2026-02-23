import { describe, it, expect } from 'vitest';
import { buildPrompt, DOC_TYPE_CONFIG, DocTypeKey } from '../../prompts/index';
import type { Example } from '../../examples/types';

describe('DOC_TYPE_CONFIG', () => {
  const keys: DocTypeKey[] = ['pervichniy', 'povtorniy', 'vk', 'msek'];

  it('has entries for all four document types', () => {
    for (const key of keys) {
      expect(DOC_TYPE_CONFIG[key]).toBeDefined();
    }
  });

  it('has correct maxOutputTokens values', () => {
    expect(DOC_TYPE_CONFIG.pervichniy.maxOutputTokens).toBe(6000);
    expect(DOC_TYPE_CONFIG.povtorniy.maxOutputTokens).toBe(3000);
    expect(DOC_TYPE_CONFIG.vk.maxOutputTokens).toBe(4000);
    expect(DOC_TYPE_CONFIG.msek.maxOutputTokens).toBe(8000);
  });

  it('has a non-empty label for each doc type', () => {
    for (const key of keys) {
      expect(DOC_TYPE_CONFIG[key].label.length).toBeGreaterThan(0);
    }
  });

  it('has a non-empty sections string for each doc type', () => {
    for (const key of keys) {
      expect(DOC_TYPE_CONFIG[key].sections.length).toBeGreaterThan(0);
    }
  });
});

describe('buildPrompt', () => {
  const examples: Example[] = [
    { id: 'ex1', input: 'Жалобы пациента...', output: 'Первичный осмотр:\n...', tokenEstimate: 50, metadata: {} },
    { id: 'ex2', input: 'Другие жалобы...', output: 'Повторный осмотр:\n...', tokenEstimate: 50, metadata: {} },
  ];

  it('returns a non-empty string', () => {
    expect(buildPrompt('pervichniy', []).length).toBeGreaterThan(0);
  });

  it('includes the sections for the given doc type', () => {
    const result = buildPrompt('pervichniy', []);
    expect(result).toContain(DOC_TYPE_CONFIG.pervichniy.sections);
  });

  it('does not include example blocks when examples array is empty', () => {
    const result = buildPrompt('pervichniy', []);
    expect(result).not.toContain('### Пример');
  });

  it('includes numbered example headers when examples are provided', () => {
    const result = buildPrompt('pervichniy', examples);
    expect(result).toContain('### Пример 1');
    expect(result).toContain('### Пример 2');
  });

  it('includes example input and output in the prompt', () => {
    const result = buildPrompt('pervichniy', examples);
    expect(result).toContain(examples[0].input);
    expect(result).toContain(examples[0].output);
    expect(result).toContain(examples[1].input);
    expect(result).toContain(examples[1].output);
  });

  it('labels example input as "Заметки врача:" and output as "Готовый документ:"', () => {
    const result = buildPrompt('pervichniy', examples);
    expect(result).toContain('Заметки врача:');
    expect(result).toContain('Готовый документ:');
  });

  it('works for all four doc types without throwing', () => {
    const keys: DocTypeKey[] = ['pervichniy', 'povtorniy', 'vk', 'msek'];
    for (const key of keys) {
      expect(() => buildPrompt(key, [])).not.toThrow();
    }
  });

  it('uses different sections for different doc types', () => {
    const pervichniy = buildPrompt('pervichniy', []);
    const msek = buildPrompt('msek', []);
    expect(pervichniy).not.toBe(msek);
  });
});
