import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import * as db from '../../data/db';

interface DailyUpdateModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  projectId?: string | null;
  employeeEmail?: string | null;
  onSubmitted?: () => void;
}

export default function DailyUpdateModal({ open, onClose, taskId, taskName, projectId, employeeEmail, onSubmitted }: DailyUpdateModalProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await db.createTaskUpdate({
        task_id: taskId,
        project_id: projectId || null,
        employee_email: employeeEmail || null,
        update_text: text.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setText('');
        onClose();
        onSubmitted?.();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update');
    }
    setSaving(false);
  };

  const handleClose = () => {
    setText('');
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Daily Update — ${taskName}`} size="md">
      {success ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-success-500 mb-3" />
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Update posted successfully!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Share what you worked on today for this task. This helps the admin track progress.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what you did today..."
            rows={5}
            className="w-full px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all bg-white dark:bg-ink-900 text-ink-900 dark:text-white resize-none"
            autoFocus
          />
          {error && (
            <p className="text-xs text-error-600 dark:text-error-400">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              onClick={handleSubmit}
              disabled={saving || !text.trim()}
            >
              {saving ? 'Posting...' : 'Post Update'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
