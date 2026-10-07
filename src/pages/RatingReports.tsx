import { useEffect, useMemo, useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import { Download, FileText, Star, TrendingDown, TrendingUp } from 'lucide-react';
import * as db from '../data/db';
import type { ProjectRating, RatingQuestion, Employee } from '../data/db';
import { computeEmployeeStats, computeQuestionStats, formatRating } from '../utils/ratingStats';

export default function RatingReports() {
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, q, e] = await Promise.all([db.fetchAllRatings(), db.fetchRatingQuestions(), db.fetchEmployees()]);
      if (!active) return;
      setRatings(r); setQuestions(q); setEmployees(e); setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const employeeStats = useMemo(() => computeEmployeeStats(ratings), [ratings]);
  const questionStats = useMemo(() => computeQuestionStats(ratings, questions), [ratings, questions]);
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const rankedEmployees = Array.from(employeeStats.values()).sort((a, b) => b.average - a.average);
  const areas = questionStats.filter((q) => q.count > 0);

  const exportCsv = () => {
    const rows = [['Question', 'Target Type', 'Rating', 'Comment', 'Employee', 'Date'], ...ratings.map((r) => [
      questions.find((q) => q.id === r.question_id)?.question || '', r.target_type, String(r.rating), r.comment || '',
      r.target_employee_id ? employeeName(r.target_employee_id) : '', new Date(r.created_at).toISOString(),
    ])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = 'rating-report.csv'; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-500 dark:text-ink-400">Compare employee performance and service areas from individual rating records.</p>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-ink-200 dark:border-ink-700 text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800"><Download className="w-4 h-4" /> Export CSV</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-success-500" /> Employee Performance</h3><div className="space-y-3">{rankedEmployees.map((s) => <div key={s.employeeId} className="flex items-center justify-between"><span className="text-sm text-ink-700 dark:text-ink-200">{employeeName(s.employeeId)}</span><div className="flex items-center gap-2"><StarRating value={s.average} readOnly size={14} /><b className="text-sm">{formatRating(s.average)}</b></div></div>)}{rankedEmployees.length === 0 && <p className="text-sm text-ink-400">No employee data yet.</p>}</div></Card>
        <Card><h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-error-500" /> Areas for Improvement</h3><div className="space-y-3">{areas.sort((a, b) => a.average - b.average).slice(0, 8).map((s) => <div key={s.questionId} className="flex items-center justify-between"><span className="text-sm text-ink-700 dark:text-ink-200">{s.question}</span><span className="text-sm font-bold">{formatRating(s.average)}</span></div>)}{areas.length === 0 && <p className="text-sm text-ink-400">No rating data yet.</p>}</div></Card>
      </div>
      <Card><h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary-500" /> Question Report</h3><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-ink-100 dark:border-ink-800">{['Question', 'Target', 'Responses', 'Average'].map((h) => <th key={h} className="text-left text-xs uppercase tracking-wider text-ink-500 py-3 px-3">{h}</th>)}</tr></thead><tbody>{questionStats.map((s) => <tr key={s.questionId} className="border-b border-ink-50 dark:border-ink-800/50"><td className="py-3 px-3 text-sm font-medium">{s.question}</td><td className="py-3 px-3 text-sm text-ink-500">{s.target_type}</td><td className="py-3 px-3 text-sm text-ink-500">{s.count}</td><td className="py-3 px-3"><span className="flex items-center gap-2 text-sm font-semibold">{s.count ? <StarRating value={s.average} readOnly size={13} /> : null}{s.count ? formatRating(s.average) : '—'}</span></td></tr>)}</tbody></table></div></Card>
    </div>
  );
}
