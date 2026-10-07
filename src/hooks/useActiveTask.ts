import { useState, useEffect, useRef } from 'react';
import { supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import { readCache, writeCache } from '../data/queryCache';
import type { Project, Task } from '../data/db';
import { parseSourceLinks } from '../data/db';

export interface ActiveTaskState {
  project: Project | null;
  task: Task | null;
  allTasks: Task[];
  status: string;
  loading: boolean;
  uploadedFiles: string[];
  submitted: boolean;
  error: string | null;
  setError: (e: string | null) => void;
}

export interface ActiveTaskActions {
  setStatus: (s: string) => void;
  setTask: (t: Task | null) => void;
  setProject: (p: Project | null) => void;
  setUploadedFiles: (f: string[]) => void;
  setSubmitted: (v: boolean) => void;
  handleStatusChange: (newStatus: string) => Promise<void>;
  handleMarkPartialCompleted: () => Promise<void>;
  handleMarkFullyCompleted: () => Promise<void>;
}

function syncUploads(t: Task | null): string[] {
  if (t?.editor_uploads) {
    return parseSourceLinks(t.editor_uploads).map((u) => u.url);
  }
  return [];
}

export function useActiveTask(projectId: string | undefined, taskId: string | undefined): ActiveTaskState & ActiveTaskActions {
  const tasksCacheKey = projectId ? `tasks:project:${projectId}` : null;
  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>(() => tasksCacheKey ? readCache<Task[]>(tasksCacheKey)?.data ?? [] : []);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef('pending');

  useEffect(() => {
    if (!projectId || !supabase) return;
    let active = true;
    setLoading(true);

    const cachedTasks = tasksCacheKey ? readCache<Task[]>(tasksCacheKey) : null;

    Promise.all([
      db.fetchProject(projectId),
      cachedTasks && !cachedTasks.stale ? Promise.resolve(cachedTasks.data) : db.fetchTasks(projectId),
    ]).then(([p, tasks]) => {
      if (!active) return;
      setProject(p);
      setAllTasks(tasks);
      if (tasksCacheKey) writeCache(tasksCacheKey, tasks);
      const currentTask = taskId ? tasks.find((t) => t.id === taskId) : db.getCurrentTask(tasks);
      setTask(currentTask || null);
      const s = currentTask?.status || 'pending';
      setStatus(s);
      prevStatusRef.current = s;
      setSubmitted(currentTask?.status === 'submitted');
      setUploadedFiles(syncUploads(currentTask));
    }).catch((err) => {
      console.error('useActiveTask load failed:', err);
      if (active) setError(err instanceof Error ? err.message : 'Failed to load task data');
    }).finally(() => {
      if (active) setLoading(false);
    });

    const projChannel = supabase.channel(`ws-proj-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload) => {
        if (active) setProject(payload.new as Project);
      })
      .subscribe();

    const taskChannel = supabase.channel(`ws-tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        if (!active) return;
        db.fetchTasks(projectId).then((tasks) => {
          if (!active) return;
          if (tasksCacheKey) writeCache(tasksCacheKey, tasks);
          setAllTasks(tasks);
          const currentTask = taskId ? tasks.find((t) => t.id === taskId) : db.getCurrentTask(tasks);
          setTask(currentTask || null);
          const s = currentTask?.status || 'pending';
          setStatus(s);
          prevStatusRef.current = s;
          setSubmitted(currentTask?.status === 'submitted');
          setUploadedFiles(syncUploads(currentTask));
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(projChannel);
      supabase?.removeChannel(taskChannel);
    };
  }, [projectId, taskId]);

  const revertStatus = () => {
    setStatus(prevStatusRef.current);
    setSubmitted(prevStatusRef.current === 'submitted');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task || newStatus === 'partial' || newStatus === 'fully' || newStatus === 'completed') return;
    prevStatusRef.current = status;
    const dbStatus = newStatus === 'in-progress' ? 'in-progress' : 'pending';
    setStatus(newStatus);
    try {
      await db.updateTask(task.id, { status: dbStatus });
      if (newStatus === 'in-progress' && project && (project.status === 'assigned' || project.status === 'approved')) {
        await db.transitionProjectStatus(project.id, 'in-progress');
        setProject({ ...project, status: 'in-progress' });
      }
      setTask({ ...task, status: dbStatus });
      prevStatusRef.current = newStatus;
    } catch (err) {
      revertStatus();
      setError(err instanceof Error ? err.message : 'Failed to update task status');
    }
  };

  const handleMarkPartialCompleted = async () => {
    if (!task) return;
    prevStatusRef.current = status;
    setStatus('partial-completed');
    try {
      await db.updateTask(task.id, { status: 'partial-completed' });
      setTask({ ...task, status: 'partial-completed' });
      prevStatusRef.current = 'partial-completed';
    } catch (err) {
      revertStatus();
      setError(err instanceof Error ? err.message : 'Failed to mark task as partially completed');
    }
  };

  const handleMarkFullyCompleted = async () => {
    if (!task) return;
    prevStatusRef.current = status;
    setStatus('fully-completed');
    try {
      await db.updateTask(task.id, { status: 'fully-completed' });
      setTask({ ...task, status: 'fully-completed' });
      prevStatusRef.current = 'fully-completed';
    } catch (err) {
      revertStatus();
      setError(err instanceof Error ? err.message : 'Failed to mark task as fully completed');
    }
  };

  return {
    project, task, allTasks, status, loading, uploadedFiles, submitted, error, setError,
    setStatus, setTask, setProject, setUploadedFiles, setSubmitted,
    handleStatusChange, handleMarkPartialCompleted, handleMarkFullyCompleted,
  };
}
