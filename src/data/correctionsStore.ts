import { corrections as seedCorrections, Correction, PhotoMark, VideoTimestamp, VoiceNoteItem } from './mockData';

let store: Correction[] = [...seedCorrections];
const listeners = new Set<() => void>();

export function getCorrections(): Correction[] {
  return store;
}

export function addCorrection(entry: {
  customer: string;
  orderId?: string;
  eventName?: string;
  editor?: string;
  photoMarks: PhotoMark[];
  videoTimestamps: VideoTimestamp[];
  voiceNotes: VoiceNoteItem[];
}): void {
  const id = `c-${Date.now()}`;
  const num = `COR-${String(store.length + 1).padStart(3, '0')}`;
  const total = entry.photoMarks.length + entry.videoTimestamps.length + entry.voiceNotes.length;
  const summary = entry.photoMarks.length > 0
    ? entry.photoMarks[0].comment
    : entry.videoTimestamps.length > 0
      ? entry.videoTimestamps[0].comment
      : 'Voice note feedback';

  const correction: Correction = {
    id,
    number: num,
    customer: entry.customer,
    orderId: entry.orderId,
    eventName: entry.eventName,
    comment: summary,
    priority: total > 3 ? 'High' : total > 1 ? 'Medium' : 'Low',
    editor: entry.editor || 'Unassigned',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'pending',
    attachments: 0,
    photoMarks: entry.photoMarks,
    videoTimestamps: entry.videoTimestamps,
    voiceNotes: entry.voiceNotes,
  };

  store = [correction, ...store];
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
