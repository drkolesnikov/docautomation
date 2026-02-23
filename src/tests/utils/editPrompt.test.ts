import { describe, it, expect } from 'vitest';
import {
  buildFragmentEditMessage,
  buildDocumentEditMessage,
  EDIT_SYSTEM_PROMPT,
} from '../../utils/editPrompt';

describe('buildFragmentEditMessage', () => {
  const doc = 'Пациент жалуется на головную боль.';
  const fragment = 'головную боль';
  const instruction = 'Уточни характер боли';

  it('includes the full document', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain(doc);
  });

  it('includes the fragment', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain(fragment);
  });

  it('includes the instruction', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain(instruction);
  });

  it('labels the fragment section', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain('Фрагмент:');
  });

  it('labels the instruction section', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain('Инструкция:');
  });

  it('tells the LLM to return only the rewritten fragment', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain('Верни только переписанный фрагмент.');
  });

  it('labels the full document as context-only', () => {
    const result = buildFragmentEditMessage(doc, fragment, instruction);
    expect(result).toContain('только для контекста');
  });
});

describe('buildDocumentEditMessage', () => {
  const doc = 'Диагноз: F20.0. Лечение: галоперидол.';
  const instruction = 'Добавь дату следующего визита';

  it('includes the full document', () => {
    const result = buildDocumentEditMessage(doc, instruction);
    expect(result).toContain(doc);
  });

  it('includes the instruction', () => {
    const result = buildDocumentEditMessage(doc, instruction);
    expect(result).toContain(instruction);
  });

  it('labels the instruction section', () => {
    const result = buildDocumentEditMessage(doc, instruction);
    expect(result).toContain('Инструкция:');
  });

  it('tells the LLM to return the entire revised document', () => {
    const result = buildDocumentEditMessage(doc, instruction);
    expect(result).toContain('Верни только переработанный документ целиком.');
  });

  it('does not include a separate fragment field', () => {
    const result = buildDocumentEditMessage(doc, instruction);
    expect(result).not.toContain('Фрагмент:');
  });
});

describe('EDIT_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof EDIT_SYSTEM_PROMPT).toBe('string');
    expect(EDIT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('instructs to return only the rewritten text (no preamble)', () => {
    expect(EDIT_SYSTEM_PROMPT).toContain('ТОЛЬКО');
  });
});
