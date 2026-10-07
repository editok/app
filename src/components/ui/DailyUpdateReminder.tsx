import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as db from '../../data/db';
import type { Task } from '../../data/db';
import DailyUpdateModal from './DailyUpdateModal';
import { CalendarClock, X, MessageSquarePlus } from 'lucide-react';

const DISMISS_KEY_PREFIX = 'editok-daily-update-dismissed-';
const REMINDER_INTERVAL = 2 * 60 * 60 * 1000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDismissedDate(userEmail: string): string | null {
  return localStorage.getItem(DISMISS_KEY_PREFIX + userEmail);
}

function setDismissedDate(userEmail: string, date: string) {
  localStorage.setItem(DISMISS_KEY_PREFIX + userEmail, date);
}

function getDismissedTimestamp(userEmail: string): number | null {
  const ts = localStorage.getItem(DISMISS_KEY_PREFIX + userEmail + '-ts');
  return ts ? parseInt(ts, 10) : null;
}

function setDismissedTimestamp(userEmail: string, ts: number) {
  localStorage.setItem(DISMISS_KEY_PREFIX + userEmail + '-ts', String(ts));
}

export default function DailyUpdateReminder() {
  const { user, role } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchActiveTask = async (): Promise<void> => {
    if (!user?.email || role !== 'editor') return;
    try {
      const profile = await db.fetchProfile(user.id);
      if (!profile) return;
      const allTasks = await db.fetchTasksByEmployee(profile.id);
      const inProgressTasks = allTasks.filter(
        (t) => t.status === 'in-progress' || t.status === 'partial-completed' || t.status === 'fully-completed'
      );
      if (inProgressTasks.length === 0) return;

      const today = todayKey();
      const taskIds = inProgressTasks.map((t) => t.id);
      const updates = await db.fetchTaskUpdatesByTaskIds(taskIds);
      const todayUpdates = updates.filter((u) => u.created_at && u.created_at.slice(0, 10) === today);

      if (todayUpdates.length === 0) {
        setActiveTask(inProgressTasks[0]);
        setShowReminder(true);
      }
    } catch {
      // silently ignore — don't block the editor
    }
  };

  const checkShouldRemind = async () => {
    if (!user?.email || role !== 'editor') return;

    const today = todayKey();
    const dismissedDate = getDismissedDate(user.email);
    const dismissedTs = getDismissedTimestamp(user.email);

    if (dismissedDate === today) {
      if (dismissedTs && Date.now() - dismissedTs >= REMINDER_INTERVAL) {
        await fetchActiveTask();
      }
      return;
    }

    await fetchActiveTask();
  };

  useEffect(() => {
    if (!user?.email || role !== 'editor') return;

    const initialDelay = setTimeout(() => { checkShouldRemind(); }, 3000);
    checkTimerRef.current = setInterval(() => { checkShouldRemind(); }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialDelay);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [user?.email, role]);

  const handleUpdateNow = () => {
    setShowReminder(false);
    setShowModal(true);
  };

  const handleLater = () => {
    setShowReminder(false);
    if (user?.email) {
      setDismissedDate(user.email, todayKey());
      setDismissedTimestamp(user.email, Date.now());
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (user?.email) {
      setDismissedDate(user.email, todayKey());
      setDismissedTimestamp(user.email, Date.now());
    }
  };

  if (!showReminder && !showModal) return null;

  return (
    <>
      {showReminder && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[90] w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm animate-slide-up">
          <div className="glass rounded-2xl shadow-float border border-primary-200 dark:border-primary-500/30 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Daily Update Reminder</p>
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                  You haven't posted a daily update today. Let the admin know your progress.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleUpdateNow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" /> Update Now
                  </button>
                  <button
                    onClick={handleLater}
                    className="px-3 py-1.5 rounded-lg text-ink-500 dark:text-ink-400 text-xs font-semibold hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
              <button onClick={handleLater} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && activeTask && (
        <DailyUpdateModal
          open={showModal}
          onClose={handleModalClose}
          taskId={activeTask.id}
          taskName={activeTask.task_name}
          projectId={activeTask.project_id}
          employeeEmail={user?.email || null}
          onSubmitted={handleModalClose}
        />
      )}
    </>
  );
}
