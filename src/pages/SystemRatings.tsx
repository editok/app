import { useEffect, useState, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import { BarChart3, Star, TrendingUp, MessageSquare } from 'lucide-react';
import * as db from '../data/db';
import type { ProjectRating, RatingQuestion } from '../data/db';
import { computeQuestionStats, average, formatRating } from '../utils/ratingStats';

export default function SystemRatings() {
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [questions, setQuestions] = useState<RatingQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [r, q] = await Promise.all([db.fetchAllRatings(), db.fetchRatingQuestions()]);
      if (!active) return;
      setRatings(r);
      setQuestions(q);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const systemRatings = useMemo(() => ratings.filter((r) => r.target_type === 'SYSTEM'), [ratings]);
  const systemQuestions = useMemo(() => questions.filter((q) => q.target_type === 'SYSTEM' && q.status === 'active'), [questions]);
  const stats = useMemo(() => computeQuestionStats(systemRatings, systemQuestions), [systemRatings, systemQuestions]);

  const overallAvg = average(systemRatings.map((r) => r.rating));
  const totalComments = systemRatings.filter((r) => r.comment && r.comment.trim()).length;
  const ratedProjects = new Set(systemRatings.map((r) => r.project_id)).size;

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="System Ratings" value={systemRatings.length} icon={<Star className="w-5 h-5" />} color="primary" />
        <StatCard label="Average Score" value={formatRating(overallAvg)} icon={<TrendingUp className="w-5 h-5" />} color="success" />
        <StatCard label="Rated Projects" value={ratedProjects} icon={<BarChart3 className="w-5 h-5" />} color="warning" />
        <StatCard label="Comments" value={totalComments} icon={<MessageSquare className="w-5 h-5" />} color="purple" />
      </div>

      <Card className="animate-slide-up">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary-500" /> System Performance Breakdown
        </h3>
        <div className="space-y-4">
          {stats.map((s) => (
            <div key={s.questionId} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{s.question}</span>
                <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{s.count > 0 ? formatRating(s.average) : '—'} ({s.count})</span>
              </div>
              {s.count > 0 && (
                <div className="w-full h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all" style={{ width: `${(s.average / 5) * 100}%` }} />
                </div>
              )}
            </div>
          ))}
          {stats.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No system rating questions configured.</p>}
        </div>
      </Card>

      <Card className="animate-slide-up">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Recent Comments</h3>
        <div className="space-y-2">
          {systemRatings.filter((r) => r.comment && r.comment.trim()).slice(0, 10).map((r) => {
            const q = systemQuestions.find((sq) => sq.id === r.question_id);
            return (
              <div key={r.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">{q?.question || 'System'}</span>
                  <StarRating value={r.rating} readOnly size={12} />
                </div>
                <p className="text-sm text-ink-500 dark:text-ink-400 italic">"{r.comment}"</p>
              </div>
            );
          })}
          {systemRatings.filter((r) => r.comment && r.comment.trim()).length === 0 && <p className="text-sm text-ink-400 text-center py-4">No comments yet.</p>}
        </div>
      </Card>
    </div>
  );
}
