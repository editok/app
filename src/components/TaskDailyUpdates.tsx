import { useState, useEffect, useCallback } from 'react';
import { Calendar, MessageSquare, Lock } from 'lucide-react';
import * as db from '../data/db';
import type { TaskUpdate } from '../data/db';
import { supabase } from '../contexts/AuthContext';

export default function TaskDailyUpdates({ taskId, isActive }: { taskId: string; isActive: boolean }) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editorNames, setEditorNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const rows = await db.fetchTaskUpdates(taskId);
    setUpdates(rows);
    const emails = Array.from(new Set(rows.map((r) => r.employee_email).filter(Boolean))) as string[];
    if (emails.length > 0) {
      const { data: employees } = await supabase!.from('employees').select('name, email').in('email', emails);
      const nameMap: Record<string, string> = {};
      (employees || []).forEach((e: { name: string; email: string | null }) => {
        if (e.email) nameMap[e.email.toLowerCase()] = e.name;
      });
      setEditorNames(nameMap);
    }
  }, [taskId]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel(`task-updates-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_updates', filter: `task_id=eq.${taskId}` }, () => { load(); })
      .subscribe();
    return () => { supabase?.removeChannel(ch); };
  }, [taskId, load]);

  if (!isActive) {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
        <Lock className="w-3 h-3" /> Daily updates locked until this task is active
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-primary-100 dark:border-primary-500/20 bg-primary-50/40 dark:bg-primary-500/5 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-primary-50/60 dark:hover:bg-primary-500/10 transition-colors">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-400">
          <Calendar className="w-3.5 h-3.5" /> Daily Updates {updates.length > 0 && <span className="text-primary-500">({updates.length})</span>}
        </span>
        <span className="text-xs text-primary-500">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {updates.length === 0 ? (
            <p className="text-xs text-ink-400 dark:text-ink-500 text-center py-2">No daily updates posted yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {updates.map((u) => (
                <div key={u.id} className="p-2.5 rounded-lg bg-white dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-primary-600 dark:text-primary-400">
                      <MessageSquare className="w-3 h-3" /> {editorNames[(u.employee_email || '').toLowerCase()] || u.employee_email || 'Editor'}
                    </span>
                    <span className="text-[10px] text-ink-400">{new Date(u.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-ink-700 dark:text-ink-200 whitespace-pre-wrap">{u.update_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
