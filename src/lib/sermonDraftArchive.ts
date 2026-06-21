export interface ArchivedSermonSection {
  id: string;
  type: string;
  title: string;
  content: string;
}

export interface ArchivedSermonDraft {
  id: string;
  churchId: string;
  title: string;
  sections: ArchivedSermonSection[];
  createdAt: string;
  updatedAt: string;
  source: 'ai' | 'manual';
}

const MAX_DRAFTS = 24;

function storageKey(churchId: string): string {
  return `grace-sermon-drafts:${churchId}`;
}

function readAll(churchId: string): ArchivedSermonDraft[] {
  try {
    const raw = localStorage.getItem(storageKey(churchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedSermonDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(churchId: string, drafts: ArchivedSermonDraft[]): void {
  localStorage.setItem(storageKey(churchId), JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
}

export function listSermonDrafts(churchId: string): ArchivedSermonDraft[] {
  return readAll(churchId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function saveSermonDraft(
  churchId: string,
  input: {
    title: string;
    sections: ArchivedSermonSection[];
    source: ArchivedSermonDraft['source'];
  },
): ArchivedSermonDraft {
  const now = new Date().toISOString();
  const draft: ArchivedSermonDraft = {
    id: `draft-${Date.now()}`,
    churchId,
    title: input.title.trim() || 'Untitled sermon',
    sections: input.sections,
    createdAt: now,
    updatedAt: now,
    source: input.source,
  };
  const existing = readAll(churchId);
  writeAll(churchId, [draft, ...existing]);
  return draft;
}

export function deleteSermonDraft(churchId: string, draftId: string): void {
  writeAll(
    churchId,
    readAll(churchId).filter(draft => draft.id !== draftId),
  );
}

export function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
