import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../contexts/AuthContext';
import { fetchProjectMessages, ProjectMessage } from '../data/db';
import { readCache, writeCache } from '../data/queryCache';

export function useMessages(projectId: string | null | undefined): {
  messages: ProjectMessage[];
  loading: boolean;
  refresh: () => Promise<void>;
  addMessage: (message: ProjectMessage) => void;
} {
  const cacheKey = projectId ? `messages:project:${projectId}` : null;
  const [messages, setMessages] = useState<ProjectMessage[]>(() => cacheKey ? readCache<ProjectMessage[]>(cacheKey)?.data ?? [] : []);
  const [loading, setLoading] = useState(() => !cacheKey || !readCache(cacheKey));

  const addMessage = useCallback((message: ProjectMessage) => {
    setMessages((current) => {
      if (current.some((existing) => existing.id === message.id)) return current;
      return [...current, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchProjectMessages(projectId);
      writeCache(`messages:project:${projectId}`, data);
      setMessages(data);
    } catch (err) {
      console.error('useMessages fetch error:', err);
      setMessages([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (cacheKey) {
      const cached = readCache<ProjectMessage[]>(cacheKey);
      if (cached) {
        setMessages(cached.data);
        setLoading(cached.stale);
      }
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!projectId || !supabase) return;
    let active = true;

    const channel = supabase
      .channel(`project-messages-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` },
        () => {
          if (active) refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` },
        () => {
          if (active) refresh();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(channel);
    };
  }, [projectId, refresh]);

  return { messages, loading, refresh, addMessage };
}
