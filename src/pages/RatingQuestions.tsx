import { useEffect, useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Star } from 'lucide-react';
import * as db from '../data/db';
import type { RatingQuestion, RatingTargetType } from '../data/db';

const TARGET_TYPES: RatingTargetType[] = ['SYSTEM', 'ROLE', 'TASK', 'EMPLOYEE', 'PROJECT'];

const emptyForm = {
  question: '', description: '', rating_type: 'star', max_rating: 5,
  comment_enabled: true, comment_required: false,
  target_type: 'SYSTEM' as RatingTargetType, target_role: '', target_task_name: '',
  status: 'active', sort_order: 100,
};

export default function RatingQuestions() {
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RatingQuestion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const q = await db.fetchRatingQuestions();
    setQuestions(q);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: questions.length + 1 });
    setModalOpen(true);
  };

  const openEdit = (q: RatingQuestion) => {
    setEditing(q);
    setForm({
      question: q.question, description: q.description || '', rating_type: q.rating_type,
      max_rating: q.max_rating, comment_enabled: q.comment_enabled, comment_required: q.comment_required,
      target_type: q.target_type, target_role: q.target_role || '', target_task_name: q.target_task_name || '',
      status: q.status, sort_order: q.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim()) return;
    setSaving(true);
    const payload = {
      question: form.question,
      description: form.description || null,
      rating_type: form.rating_type,
      max_rating: form.max_rating,
      comment_enabled: form.comment_enabled,
      comment_required: form.comment_required,
      target_type: form.target_type,
      target_role: form.target_type === 'ROLE' ? form.target_role : null,
      target_task_name: form.target_type === 'TASK' ? form.target_task_name : null,
      status: form.status,
      sort_order: form.sort_order,
    };
    try {
      if (editing) {
        await db.updateRatingQuestion(editing.id, payload);
      } else {
        await db.createRatingQuestion(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      console.error('Save rating question error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: RatingQuestion) => {
    if (!confirm(`Delete "${q.question}"? This action cannot be undone.`)) return;
    try {
      await db.deleteRatingQuestion(q.id);
      await load();
    } catch (err) {
      console.error('Delete rating question error:', err);
    }
  };

  const moveOrder = async (q: RatingQuestion, dir: -1 | 1) => {
    const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await db.updateRatingQuestion(q.id, { sort_order: other.sort_order });
    await db.updateRatingQuestion(other.id, { sort_order: q.sort_order });
    await load();
  };

  const toggleStatus = async (q: RatingQuestion) => {
    await db.updateRatingQuestion(q.id, { status: q.status === 'active' ? 'inactive' : 'active' });
    await load();
  };

  const update = (key: string, val: string | number | boolean) => setForm((f) => ({ ...f, [key]: val }));

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500 dark:text-ink-400">Create and manage the rating questions customers see on the feedback form.</p>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>Add Question</Button>
      </div>

      <Card className="animate-slide-up">
        <div className="space-y-2">
          {[...questions].sort((a, b) => a.sort_order - b.sort_order).map((q, i, arr) => (
            <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-colors">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOrder(q, -1)} disabled={i === 0} className="text-ink-400 hover:text-primary-500 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveOrder(q, 1)} disabled={i === arr.length - 1} className="text-ink-400 hover:text-primary-500 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{q.question}</span>
                  <Badge status={q.status}>{q.status}</Badge>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium">{q.target_type}</span>
                </div>
                {q.description && <p className="text-xs text-ink-400 mt-0.5">{q.description}</p>}
                {q.target_type === 'ROLE' && q.target_role && <p className="text-xs text-ink-400 mt-0.5">Role: {q.target_role}</p>}
                {q.target_type === 'TASK' && q.target_task_name && <p className="text-xs text-ink-400 mt-0.5">Task: {q.target_task_name}</p>}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => toggleStatus(q)}>{q.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(q)}>Edit</Button>
                <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(q)}>Delete</Button>
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No rating questions yet. Click "Add Question" to create one.</p>}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Question' : 'Add Rating Question'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !form.question.trim()}>{saving ? 'Saving...' : 'Save Question'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Question Title *</label>
            <input className="input" value={form.question} onChange={(e) => update('question', e.target.value)} placeholder="e.g. Color Correction" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Description / Helper Text</label>
            <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="e.g. How satisfied are you with the color correction?" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Target Type</label>
            <select className="input" value={form.target_type} onChange={(e) => update('target_type', e.target.value)}>
              {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Max Rating</label>
            <input type="number" className="input" value={form.max_rating} onChange={(e) => update('max_rating', parseInt(e.target.value) || 5)} min={1} max={10} />
          </div>
          {form.target_type === 'ROLE' && (
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Target Role</label>
              <input className="input" value={form.target_role} onChange={(e) => update('target_role', e.target.value)} placeholder="e.g. Customer Relation Officer" />
            </div>
          )}
          {form.target_type === 'TASK' && (
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Target Task Name</label>
              <input className="input" value={form.target_task_name} onChange={(e) => update('target_task_name', e.target.value)} placeholder="e.g. Color Correction (must match task name)" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Comment</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                <input type="checkbox" checked={form.comment_enabled} onChange={(e) => update('comment_enabled', e.target.checked)} className="rounded" /> Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                <input type="checkbox" checked={form.comment_required} onChange={(e) => update('comment_required', e.target.checked)} className="rounded" /> Required
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Status</label>
            <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
