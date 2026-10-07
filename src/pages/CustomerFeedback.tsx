import { useEffect, useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { CheckCircle2, MessageSquare, Star } from 'lucide-react';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import StarRating from '../components/ui/StarRating';
import * as db from '../data/db';
import { supabase, useAuth } from '../contexts/AuthContext';
import type { PageKey } from '../components/Layout';
import type { Project, ProjectRatingRequest, RatingQuestion, Task } from '../data/db';

interface Answer { rating: number; comment: string; }

export default function CustomerFeedback({ onNavigate, params }: { onNavigate: (p: PageKey) => void; params: Record<string, unknown> }) {
  const { user } = useAuth();
  const [request, setRequest] = useState<ProjectRatingRequest | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      const requestId = params.requestId as string | undefined;
      const projectId = params.projectId as string | undefined;
      let current = requestId ? await db.fetchRatingRequestsByCustomer(user.email || '').then((rows) => rows.find((r) => r.id === requestId) || null) : null;
      if (!current && projectId) current = await db.fetchRatingRequestByProject(projectId);
      if (!current) {
        const own = await db.fetchRatingRequestsByCustomer(user.email || '');
        current = own.find((r) => r.status === 'pending') || own[0] || null;
      }
      const [qs, ts, projectData] = await Promise.all([
        db.fetchRatingQuestions(),
        current ? db.fetchTasks(current.project_id) : Promise.resolve([]),
        current ? db.fetchProject(current.project_id) : Promise.resolve(null),
      ]);
      if (!active) return;
      setRequest(current);
      setProject(projectData);
      setQuestions(qs.filter((q) => q.status === 'active').sort((a, b) => a.sort_order - b.sort_order));
      setTasks(ts);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user, params.requestId, params.projectId]);

  const updateAnswer = (id: string, patch: Partial<Answer>) => {
    setAnswers((prev) => ({ ...prev, [id]: { rating: prev[id]?.rating || 0, comment: prev[id]?.comment || '', ...patch } }));
  };

  const submit = async () => {
    if (!request || !user?.email || !supabase) return;
    setError(null);
    const missing = questions.find((q) => !answers[q.id]?.rating || (q.comment_required && !answers[q.id]?.comment?.trim()));
    if (missing) {
      setError(`Please complete "${missing.question}" before submitting.`);
      return;
    }
    setSubmitting(true);
    const entries = questions.map((q) => {
      const task = q.target_type === 'TASK' ? tasks.find((t) => t.task_name.toLowerCase() === (q.target_task_name || '').toLowerCase()) : null;
      return {
        questionId: q.id,
        rating: answers[q.id].rating,
        comment: answers[q.id].comment,
        targetType: q.target_type,
        targetRole: q.target_type === 'ROLE' ? q.target_role : null,
        targetTaskName: q.target_type === 'TASK' ? q.target_task_name : null,
        targetEmployeeId: task?.assigned_to || null,
        targetTaskId: task?.id || null,
      };
    });
    const success = await db.submitRatings(request.id, request.project_id, user.email, entries);
    setSubmitting(false);
    if (!success) { setError('Your feedback could not be submitted. It may already have been submitted.'); return; }
    setSubmitted(true);
    const project = await db.fetchProject(request.project_id);
    await db.createNotification({
      type: 'rating',
      title: 'Customer feedback submitted',
      description: `A customer has submitted feedback for project "${project?.order_number || request.project_id}".`,
      target_role: 'admin',
      project_id: request.project_id,
      read: false,
    });
    if (project?.editor_email) {
      await db.createNotification({
        type: 'rating',
        title: 'New customer feedback',
        description: `A customer has submitted feedback for project "${project.order_number} - ${project.event_name}" that you worked on.`,
        target_role: 'editor',
        target_email: project.editor_email,
        project_id: request.project_id,
        read: false,
      });
    }
  };

  if (loading) return <FullPageSpinner />;

  if (submitted) return <div className="max-w-xl mx-auto py-12"><Card className="text-center"><CheckCircle2 className="w-16 h-16 text-success-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-ink-900 dark:text-white">Thank you for your feedback</h2><p className="text-sm text-ink-500 dark:text-ink-400 mt-2">Your experience helps us improve our service.</p><Button className="mt-6" variant="primary" onClick={() => onNavigate('customer-dashboard')}>Back to Dashboard</Button></Card></div>;

  if (!request) return <div className="max-w-xl mx-auto py-12"><Card className="text-center"><MessageSquare className="w-12 h-12 text-ink-300 mx-auto mb-3" /><h2 className="text-xl font-bold text-ink-900 dark:text-white">No feedback request found</h2><p className="text-sm text-ink-500 mt-2">There are no pending project reviews available for your account.</p><Button className="mt-6" variant="primary" onClick={() => onNavigate('customer-dashboard')}>Back to Dashboard</Button></Card></div>;
  if (request.status === 'submitted') return <div className="max-w-xl mx-auto py-12"><Card className="text-center"><CheckCircle2 className="w-12 h-12 text-success-500 mx-auto mb-3" /><h2 className="text-xl font-bold text-ink-900 dark:text-white">Feedback already submitted</h2><p className="text-sm text-ink-500 mt-2">Thank you for sharing your experience.</p><Button className="mt-6" variant="primary" onClick={() => onNavigate('customer-dashboard')}>Back to Dashboard</Button></Card></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {project && (
        <Card className="animate-slide-up border-primary-200 dark:border-primary-500/30">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">Project feedback</p>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white mt-1">{project.event_name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-ink-500 dark:text-ink-400">
                <span>{project.order_number}</span>
                <span>{project.category}</span>
                {project.editor_name && <span>Editor: {project.editor_name}</span>}
              </div>
            </div>
          </div>
        </Card>
      )}
      <div className="text-center"><div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center mx-auto mb-3"><Star className="w-6 h-6 text-primary-500" /></div><h2 className="text-2xl font-bold text-ink-900 dark:text-white">Share Your Experience</h2><p className="text-sm text-ink-500 dark:text-ink-400 mt-2">Tell us how we did. Your feedback helps us deliver better work.</p></div>
      {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
      <div className="space-y-4">
        {questions.map((q) => {
          const answer = answers[q.id] || { rating: 0, comment: '' };
          return <Card key={q.id} className="animate-slide-up"><h3 className="font-semibold text-ink-900 dark:text-white">{q.question}</h3>{q.description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{q.description}</p>}<div className="mt-4"><StarRating value={answer.rating} max={q.max_rating} onChange={(rating) => updateAnswer(q.id, { rating })} /></div>{q.comment_enabled && <textarea className="input mt-4" rows={3} value={answer.comment} onChange={(e) => updateAnswer(q.id, { comment: e.target.value })} placeholder={q.comment_required ? 'Your comment is required' : 'Add a comment (optional)'} />}</Card>;
        })}
      </div>
      <div className="flex justify-end"><Button variant="primary" onClick={submit} disabled={submitting || questions.length === 0}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Button></div>
    </div>
  );
}
