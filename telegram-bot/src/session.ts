import type { DocTypeKey } from '../../src/prompts/index.js';

type UserSession = {
  docType: DocTypeKey;
};

const store = new Map<number, UserSession>();

export function getDocType(userId: number): DocTypeKey {
  return store.get(userId)?.docType ?? 'pervichniy';
}

export function setDocType(userId: number, docType: DocTypeKey): void {
  store.set(userId, { docType });
}
