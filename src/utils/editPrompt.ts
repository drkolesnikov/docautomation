/**
 * Prompt building for canvas edit requests (fragment and whole-document).
 */

export const EDIT_SYSTEM_PROMPT = `Ты — опытный врач-психиатр, редактирующий готовый медицинский документ.
Возвращай ТОЛЬКО переписанный текст — без пояснений, без заголовков, без вводных фраз.
Соблюдай стандартную психиатрическую терминологию, принятую в РФ.
Сохраняй стиль и структуру оригинала, если инструкция не требует иного.
Не добавляй клинических данных, которых нет в исходном тексте.`;

/**
 * Build the user message for a fragment edit request.
 * The LLM receives the full document for context and must return
 * ONLY the replacement for the selected fragment.
 */
export function buildFragmentEditMessage(
  fullDocument: string,
  fragment: string,
  instruction: string
): string {
  return `Полный документ (только для контекста):
---
${fullDocument}
---

Перепиши следующий фрагмент согласно инструкции.

Фрагмент:
${fragment}

Инструкция: ${instruction}

Верни только переписанный фрагмент.`;
}

/**
 * Build the user message for a whole-document edit request.
 * The LLM must return the entire revised document.
 */
export function buildDocumentEditMessage(
  fullDocument: string,
  instruction: string
): string {
  return `Перепиши весь документ согласно инструкции.

Документ:
---
${fullDocument}
---

Инструкция: ${instruction}

Верни только переработанный документ целиком.`;
}
