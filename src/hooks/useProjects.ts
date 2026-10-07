import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import { invalidateProjects, invalidateTasks } from './useData';
import { readCache, writeCache, invalidatePattern } from '../data/queryCache';
import type { Project } from '../data/db';

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useProjects(customerEmail?: string): UseProjectsResult {
  const cacheKey = customerEmail ? `projects:customer:${customerEmail}` : 'projects:all';
  const [projects, setProjects] = useState<Project[]>(() => readCache<Project[]>(cacheKey)?.data ?? []);
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

    const cached = readCache<Project[]>(cacheKey);
    if (cached) {
      setProjects(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    const fetcher = customerEmail
      ? db.fetchProjectsByCustomer(customerEmail)
      : db.fetchProjects();

    fetcher
      .then((data) => {
        if (!active) return;
        writeCache(cacheKey, data);
        setProjects(data);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load projects');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    let taskDebounce: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (!active) return;
        invalidateProjects();
        if (payload.eventType === 'INSERT') {
          const newProject = payload.new as Project;
          if (!customerEmail || newProject.customer_email === customerEmail) {
            setProjects((prev) => {
              if (prev.some((p) => p.id === newProject.id)) return prev;
              const updated = [newProject, ...prev];
              writeCache(cacheKey, updated);
              return updated;
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Project;
          setProjects((prev) => {
            const next = prev.map((p) => (p.id === updated.id ? updated : p));
            writeCache(cacheKey, next);
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setProjects((prev) => {
            const next = prev.filter((p) => p.id !== deleted.id);
            writeCache(cacheKey, next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        if (!active) return;
        invalidateTasks();
        clearTimeout(taskDebounce);
        taskDebounce = setTimeout(() => {
          const refetch = customerEmail
            ? db.fetchProjectsByCustomer(customerEmail)
            : db.fetchProjects();
          refetch.then((data) => {
            if (active) {
              writeCache(cacheKey, data);
              setProjects(data);
            }
          }).catch(() => {});
        }, 500);
      })
      .subscribe();

    return () => {
      active = false;
      clearTimeout(taskDebounce);
      supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerEmail, refreshKey]);

  return { projects, loading, error, refresh };
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    db.fetchProject(id)
      .then((p) => {
        if (active) {
          setProject(p);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`project-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` }, (payload) => {
        if (active) setProject(payload.new as Project);
      })
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(channel);
    };
  }, [id]);

  return { project, loading, error };
}
