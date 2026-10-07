import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import { readCache, writeCache, invalidatePattern } from '../data/queryCache';
import type { Task, Project, TimeLog } from '../data/db';

interface TaskWithProject extends Task {
  project?: Project;
}

export function useTasks(projectId: string | undefined) {
  const cacheKey = projectId ? `tasks:project:${projectId}` : null;
  const [tasks, setTasks] = useState<Task[]>(() => cacheKey ? readCache<Task[]>(cacheKey)?.data ?? [] : []);
  const [loading, setLoading] = useState(() => !cacheKey || !readCache(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!projectId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    const cached = readCache<Task[]>(cacheKey!);
    if (cached) {
      setTasks(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    db.fetchTasks(projectId)
      .then((data) => {
        if (!active) return;
        writeCache(cacheKey!, data);
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load tasks');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        if (!active) return;
        db.fetchTasks(projectId).then((t) => {
          if (active) {
            writeCache(cacheKey!, t);
            setTasks(t);
          }
        }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Failed to refresh tasks'); });
      })
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, refreshKey]);

  return { tasks, loading, error, refresh };
}

export function useTasksByEmployee(employeeId: string | undefined) {
  const cacheKey = employeeId ? `tasks:employee:${employeeId}` : null;
  const [tasks, setTasks] = useState<TaskWithProject[]>(() => cacheKey ? readCache<TaskWithProject[]>(cacheKey)?.data ?? [] : []);
  const [loading, setLoading] = useState(() => !cacheKey || !readCache(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    const cached = readCache<TaskWithProject[]>(cacheKey!);
    if (cached) {
      setTasks(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    db.fetchTasksByEmployee(employeeId)
      .then((data) => {
        if (!active) return;
        writeCache(cacheKey!, data);
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`emp-tasks-${employeeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${employeeId}` }, () => {
        if (!active) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          db.fetchTasksByEmployee(employeeId)
            .then((t) => {
              if (active) {
                writeCache(cacheKey!, t);
                setTasks(t);
              }
            })
            .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Failed to refresh tasks'); });
        }, 500);
      })
      .subscribe();

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      supabase?.removeChannel(channel);
    };
  }, [employeeId]);

  return { tasks, loading, error };
}

export function useUnassignedTasks() {
  const cacheKey = 'tasks:unassigned';
  const [tasks, setTasks] = useState<(Task & { project?: Project })[]>(() => readCache<(Task & { project?: Project })[]>(cacheKey)?.data ?? []);
  const [loading, setLoading] = useState(() => !readCache(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    const cached = readCache<(Task & { project?: Project })[]>(cacheKey);
    if (cached) {
      setTasks(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    db.fetchUnassignedTasks()
      .then((data) => {
        if (!active) return;
        writeCache(cacheKey, data);
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load tasks');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('unassigned-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'assigned_to=is.null' }, () => {
        if (!active) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          db.fetchUnassignedTasks()
            .then((t) => {
              if (active) {
                writeCache(cacheKey, t);
                setTasks(t);
              }
            })
            .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Failed to refresh tasks'); });
        }, 500);
      })
      .subscribe();

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return { tasks, loading, refresh };
}

export function useTimeLogs(taskId: string | undefined) {
  const cacheKey = taskId ? `time_logs:${taskId}` : null;
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(() => cacheKey ? readCache<TimeLog[]>(cacheKey)?.data ?? [] : []);
  const [loading, setLoading] = useState(() => !cacheKey || !readCache(cacheKey));

  useEffect(() => {
    if (!taskId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    const cached = readCache<TimeLog[]>(cacheKey!);
    if (cached) {
      setTimeLogs(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    db.fetchTimeLogs(taskId)
      .then((data) => {
        if (!active) return;
        writeCache(cacheKey!, data);
        setTimeLogs(data);
      })
      .catch((err: unknown) => console.error('Failed to load time logs:', err))
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`time-logs-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_logs', filter: `task_id=eq.${taskId}` }, () => {
        if (!active) return;
        db.fetchTimeLogs(taskId).then((l) => {
          if (active) {
            writeCache(cacheKey!, l);
            setTimeLogs(l);
          }
        }).catch((err: unknown) => console.error('Failed to refresh time logs:', err));
      })
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(channel);
    };
  }, [taskId]);

  return { timeLogs, loading };
}
