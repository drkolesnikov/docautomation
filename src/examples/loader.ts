import type { DocTypeKey } from '../providers/types';
import type { Example } from './types';

const loaders: Record<DocTypeKey, () => Promise<unknown>> = {
  pervichniy: () => import('./pervichniy-osmotr/examples.json'),
  povtorniy: () => import('./povtorniy-osmotr/examples.json'),
  vk: () => import('./vrachebnaya-komissiya/examples.json'),
  msek: () => import('./msek/examples.json'),
};

export async function loadExamples(docType: DocTypeKey): Promise<Example[]> {
  try {
    const module = await loaders[docType]() as { default: Example[] };
    return module.default;
  } catch {
    return [];
  }
}
