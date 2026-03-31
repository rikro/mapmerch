import { randomUUID } from 'crypto';
import { Draft, GeoJSONPolygon, StyleName } from '../types.js';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const store = new Map<string, Draft>();

export function saveDraft(
  sessionToken: string,
  polygon: GeoJSONPolygon,
  style: StyleName,
  svg: string,
): Draft {
  const draft: Draft = {
    id: randomUUID(),
    sessionToken,
    polygon,
    style,
    svg,
    createdAt: new Date(),
  };
  store.set(draft.id, draft);
  return draft;
}

export function getDraft(draftId: string, sessionToken: string): Draft | null {
  const draft = store.get(draftId);
  if (!draft) return null;
  if (draft.sessionToken !== sessionToken) return null;
  if (Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS) {
    store.delete(draftId);
    return null;
  }
  return draft;
}

export function clearExpiredDrafts(): void {
  const now = Date.now();
  for (const [id, draft] of store) {
    if (now - draft.createdAt.getTime() > DRAFT_TTL_MS) {
      store.delete(id);
    }
  }
}
