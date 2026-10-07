import { supabase } from '../contexts/AuthContext';

const STORAGE_KEY = 'chat-read-state';

function loadState(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function saveState(state: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getLastChatReadAt(projectId: string): string | null {
  const state = loadState();
  return state[projectId] || null;
}

export function markChatRead(projectId: string): void {
  const now = new Date().toISOString();
  const state = loadState();
  state[projectId] = now;
  saveState(state);
  if (supabase) {
    const userId = supabase.auth.getUser ? undefined : undefined;
    void userId;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.from('chat_reads')
        .upsert({ project_id: projectId, user_id: session.user.id, last_read_at: now }, { onConflict: 'project_id,user_id' })
        .then().catch((err: unknown) => console.error('markChatRead DB sync failed:', err));
    }).catch(() => {});
  }
}

export function countUnreadMessages(
  messages: { sender_id: string; is_internal: boolean; created_at: string }[],
  userId: string | undefined,
  projectId: string,
): number {
  const lastReadAt = getLastChatReadAt(projectId);
  return messages.filter((m) => {
    if (m.sender_id === userId || m.is_internal) return false;
    if (!lastReadAt) return true;
    return new Date(m.created_at).getTime() > new Date(lastReadAt).getTime();
  }).length;
}

export async function syncChatReadState(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('chat_reads')
      .select('project_id, last_read_at')
      .eq('user_id', userId);
    if (error || !data) return;
    const state = loadState();
    for (const row of data) {
      const existing = state[row.project_id];
      if (!existing || new Date(row.last_read_at).getTime() > new Date(existing).getTime()) {
        state[row.project_id] = row.last_read_at;
      }
    }
    saveState(state);
  } catch {
    // ignore — cache still works locally
  }
}
