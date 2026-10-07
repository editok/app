import { useEffect, useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import { Star, MessageSquare, TrendingUp, Users, BarChart3, Award, Clock } from 'lucide-react';
import * as db from '../data/db';
import type { PageKey } from '../components/Layout';
import type { ProjectRating, RatingQuestion, Employee } from '../data/db';
import { computeQuestionStats, computeEmployeeStats, average, formatRating } from '../utils/ratingStats';

export default function RatingDashboard({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [r, q, emps] = await Promise.all([db.fetchAllRatings(), db.fetchRatingQuestions(), db.fetchEmployees()]);
      if (!active) return;
      setRatings(r);
      setQuestions(q);
      setEmployees(emps);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <FullPageSpinner />;

  const activeQuestions = questions.filter((q) => q.status === 'active');
  const questionStats = computeQuestionStats(ratings, activeQuestions);
  const employeeStats = computeEmployeeStats(ratings);

  const allValues = ratings.map((r) => r.rating);
  const avgRating = average(allValues);
  const ratedProjects = new Set(ratings.map((r) => r.project_id)).size;
  const systemRatings = ratings.filter((r) => r.target_type === 'SYSTEM');
  const systemAvg = average(systemRatings.map((r) => r.rating));
  const employeeRatings = ratings.filter((r) => r.target_type !== 'SYSTEM' && r.target_employee_id);
  const employeeAvg = average(employeeRatings.map((r) => r.rating));
  const totalComments = ratings.filter((r) => r.comment && r.comment.trim()).length;

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const topEmployees = Array.from(employeeStats.values())
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);
  const lowAreas = questionStats
    .filter((s) => s.count > 0)
    .sort((a, b) => a.average - b.average)
    .slice(0, 5);

  const recentRatings = [...ratings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const employeeNameById = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Reviews" value={ratings.length} icon={<Star className="w-5 h-5" />} color="primary" />
        <StatCard label="Avg Customer Rating" value={formatRating(avgRating)} icon={<TrendingUp className="w-5 h-5" />} color="success" />
        <StatCard label="Rated Projects" value={ratedProjects} icon={<BarChart3 className="w-5 h-5" />} color="warning" />
        <StatCard label="Total Comments" value={totalComments} icon={<MessageSquare className="w-5 h-5" />} color="purple" />
      </div>

      <Card className="animate-slide-up">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-500" /> Recent Feedback
        </h3>
        <div className="space-y-2">
          {recentRatings.map((r) => {
            const q = activeQuestions.find((aq) => aq.id === r.question_id);
            return (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-colors">
                <Star className="w-4 h-4 text-warning-400 fill-warning-400 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{q?.question || 'Feedback'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium">{r.target_type}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating value={r.rating} readOnly size={14} />
                    <span className="text-xs font-bold text-ink-700 dark:text-ink-200">{formatRating(r.rating)}</span>
                  </div>
                  {r.comment && <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 italic">"{r.comment}"</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
                    <span>{r.customer_email}</span>
                    {r.target_employee_id && <span>Employee: {employeeNameById(r.target_employee_id)}</span>}
                    <span>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {recentRatings.length === 0 && <p className="text-sm text-ink-400 text-center py-4">No feedback received yet.</p>}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-500" /> System Performance
          </h3>
          <div className="space-y-3">
            {questionStats.filter((s) => s.target_type === 'SYSTEM' && s.count > 0).map((s) => (
              <div key={s.questionId} className="flex items-center justify-between">
                <span className="text-sm text-ink-600 dark:text-ink-300">{s.question}</span>
                <div className="flex items-center gap-2">
                  <StarRating value={s.average} readOnly size={16} />
                  <span className="text-sm font-bold text-ink-700 dark:text-ink-200 w-12 text-right">{formatRating(s.average)}</span>
                </div>
              </div>
            ))}
            {questionStats.filter((s) => s.target_type === 'SYSTEM' && s.count > 0).length === 0 && (
              <p className="text-sm text-ink-400">No system ratings yet.</p>
            )}
          </div>
        </Card>

        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-500" /> Top Employees
          </h3>
          <div className="space-y-3">
            {topEmployees.map((e) => (
              <button
                key={e.employeeId}
                onClick={() => onNavigate('employee-ratings', { id: e.employeeId })}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{employeeName(e.employeeId)}</span>
                <div className="flex items-center gap-2">
                  <StarRating value={e.average} readOnly size={14} />
                  <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(e.average)}</span>
                </div>
              </button>
            ))}
            {topEmployees.length === 0 && <p className="text-sm text-ink-400">No employee ratings yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-error-500" /> Lowest Rated Areas
          </h3>
          <div className="space-y-3">
            {lowAreas.map((s) => (
              <div key={s.questionId} className="flex items-center justify-between">
                <span className="text-sm text-ink-600 dark:text-ink-300">{s.question}</span>
                <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(s.average)}</span>
              </div>
            ))}
            {lowAreas.length === 0 && <p className="text-sm text-ink-400">No ratings yet.</p>}
          </div>
        </Card>

        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" /> Rating Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <span className="text-sm text-ink-600 dark:text-ink-300">System Ratings</span>
              <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(systemAvg)} ({systemRatings.length})</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <span className="text-sm text-ink-600 dark:text-ink-300">Employee Ratings</span>
              <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(employeeAvg)} ({employeeRatings.length})</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
