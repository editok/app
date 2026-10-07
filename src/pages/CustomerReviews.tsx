import { useEffect, useState, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import { Search, Star, Eye } from 'lucide-react';
import * as db from '../data/db';
import type { PageKey } from '../components/Layout';
import type { ProjectRating, RatingQuestion, Project, Employee } from '../data/db';
import { formatRating } from '../utils/ratingStats';

export default function CustomerReviews({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [filterRating, setFilterRating] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [r, q, p, emps] = await Promise.all([db.fetchAllRatings(), db.fetchRatingQuestions(), db.fetchProjects(), db.fetchEmployees()]);
      if (!active) return;
      setRatings(r);
      setQuestions(q);
      setProjects(p);
      setEmployees(emps);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const employeeName = (id: string | null) => (id ? employees.find((e) => e.id === id)?.name || 'Unknown' : '—');

  const filtered = useMemo(() => {
    return ratings.filter((r) => {
      if (filterTarget && r.target_type !== filterTarget) return false;
      if (filterRating && Math.round(r.rating) !== parseInt(filterRating)) return false;
      if (search) {
        const proj = projectMap.get(r.project_id);
        const q = questionMap.get(r.question_id);
        const text = `${proj?.event_name || proj?.order_number || ''} ${r.customer_email || ''} ${q?.question || ''} ${r.comment || ''} ${employeeName(r.target_employee_id)}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [ratings, search, filterTarget, filterRating, questionMap, projectMap]);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <Card className="animate-slide-up">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input placeholder="Search by project, customer, question, comment..." className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)}>
            <option value="">All Target Types</option>
            <option value="SYSTEM">System</option>
            <option value="ROLE">Role</option>
            <option value="TASK">Task</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="PROJECT">Project</option>
          </select>
          <select className="input w-auto" value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} Star</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {filtered.map((r) => {
            const proj = projectMap.get(r.project_id);
            const q = questionMap.get(r.question_id);
            return (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-colors">
                <Star className="w-4 h-4 text-warning-400 fill-warning-400 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{q?.question || 'Unknown Question'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium">{r.target_type}</span>
                    <button
                      onClick={() => onNavigate('project-details', { id: r.project_id })}
                      className="text-xs text-ink-400 hover:text-primary-500 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> {proj?.event_name || proj?.order_number || r.project_id.slice(0, 8)}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating value={r.rating} readOnly size={14} />
                    <span className="text-xs font-bold text-ink-700 dark:text-ink-200">{formatRating(r.rating)}</span>
                  </div>
                  {r.comment && <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 italic">"{r.comment}"</p>}
                  <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-ink-400">
                    <span>{r.customer_email}</span>
                    {r.target_employee_id && <span>Employee: {employeeName(r.target_employee_id)}</span>}
                    {r.target_task_name && <span>Task: {r.target_task_name}</span>}
                    {r.target_role && <span>Role: {r.target_role}</span>}
                    <span>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No reviews found matching your filters.</p>}
        </div>
      </Card>
    </div>
  );
}
