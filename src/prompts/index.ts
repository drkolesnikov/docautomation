import { BASE_INSTRUCTION } from './base-instruction';
import { PERVICHNIY_SECTIONS } from './pervichniy-osmotr';
import { POVTORNIY_SECTIONS } from './povtorniy-osmotr';
import { VK_SECTIONS } from './vrachebnaya-komissiya';
import { MSEK_SECTIONS } from './msek';
import type { Example } from '../examples/types';

export type DocTypeKey = 'pervichniy' | 'povtorniy' | 'vk' | 'msek';

export interface DocTypeConfig {
  label: string;
  sections: string;
  maxOutputTokens: number;
}

export const DOC_TYPE_CONFIG: Record<DocTypeKey, DocTypeConfig> = {
  pervichniy: {
    label: 'Первичный осмотр',
    sections: PERVICHNIY_SECTIONS,
    maxOutputTokens: 3000,
  },
  povtorniy: {
    label: 'Повторный осмотр',
    sections: POVTORNIY_SECTIONS,
    maxOutputTokens: 1500,
  },
  vk: {
    label: 'Врачебная комиссия (ВК)',
    sections: VK_SECTIONS,
    maxOutputTokens: 2500,
  },
  msek: {
    label: 'МСЭК',
    sections: MSEK_SECTIONS,
    maxOutputTokens: 5000,
  },
};

export function buildPrompt(docType: DocTypeKey, examples: Example[]): string {
  const config = DOC_TYPE_CONFIG[docType];

  const parts: string[] = [
    BASE_INSTRUCTION,
    config.sections,
  ];

  if (examples.length > 0) {
    parts.push(
      ...examples.map(
        (ex, i) =>
          `### Пример ${i + 1}\nЗаметки врача:\n${ex.input}\n\nГотовый документ:\n${ex.output}`
      )
    );
  }

  return parts.join('\n\n');
}
