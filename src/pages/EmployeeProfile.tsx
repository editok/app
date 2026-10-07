import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { BarChart } from '../components/ui/Charts';
import { Mail, Star, Award, TrendingUp, Briefcase, Calendar, Phone } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import { supabase } from '../contexts/AuthContext';
import type { Employee, ProjectRating } from '../data/db';

export default function EmployeeProfile({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase!
        .from('employees')
        .select('id, name, email, phone, skills, applications, experience, rating, projects, status, joined, created_at')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      const emp = data as Employee | null;
      setEmployee(emp);
      if (emp) {
        const employeeRatings = await db.fetchRatingsByEmployee(emp.id);
        if (!active) return;
        setRatings(employeeRatings);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [params.id]);

  if (loading) return <FullPageSpinner />;
  if (!employee) return <div className="text-center py-20 text-ink-400">Employee not found</div>;

  const performance = (() => {
    const byMonth = new Map<string, { total: number; count: number }>();
    ratings.forEach((rating) => {
      const label = new Date(rating.created_at).toLocaleDateString('en-US', { month: 'short' });
      const current = byMonth.get(label) || { total: 0, count: 0 };
      byMonth.set(label, { total: current.total + rating.rating, count: current.count + 1 });
    });
    return Array.from(byMonth.entries()).slice(-6).map(([label, value]) => ({ label, value: Number((value.total / value.count).toFixed(1)) }));
  })();

  const ratingBreakdown = (() => {
    const byTarget = new Map<string, { total: number; count: number }>();
    ratings.forEach((rating) => {
      const current = byTarget.get(rating.target_type) || { total: 0, count: 0 };
      byTarget.set(rating.target_type, { total: current.total + rating.rating, count: current.count + 1 });
    });
    return Array.from(byTarget.entries()).map(([label, value]) => ({ label, value: Number((value.total / value.count).toFixed(1)) }));
  })();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Employees', onClick: () => onNavigate('employees') }, { label: employee.name }]} />

      <Card className="animate-slide-up relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-violet-500/10" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="w-full min-w-0 text-center sm:flex-1 sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{employee.name}</h2>
              <Badge status={employee.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-500 dark:text-ink-400 sm:justify-start">
              {employee.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {employee.email}</span>}
              {employee.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {employee.phone}</span>}
              {employee.experience && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {employee.experience}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(employee.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 sm:justify-start">
              <Star className="w-4 h-4 text-warning-400 fill-warning-400" />
              <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{(employee.rating ?? 0).toFixed(1)}</span>
              <span className="text-xs text-ink-400">· {employee.projects} projects completed</span>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto" variant="primary" size="sm" icon={<Briefcase className="w-3.5 h-3.5" />} onClick={() => onNavigate('available-works')}>Assign Work</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Projects Completed" value={employee.projects} icon={<Award className="w-5 h-5" />} color="primary" />
        <StatCard label="Avg Delivery" value="—" icon={<TrendingUp className="w-5 h-5" />} color="success" />
        <StatCard label="On-time Rate" value="—" icon={<Calendar className="w-5 h-5" />} color="warning" />
        <StatCard label="Corrections" value="—" icon={<Award className="w-5 h-5" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="lg:col-span-2 animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            Performance Over Time
          </h3>
          {performance.length > 0 ? <BarChart data={performance} height={220} /> : <p className="text-sm text-ink-400 py-12 text-center">No rating history yet.</p>}
        </Card>

        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Skills & Tools</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {employee.skills.map((s) => <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium">{s}</span>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Applications</p>
              <div className="flex flex-wrap gap-2">
                {employee.applications.map((a) => <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-success-50 dark:bg-success-500/15 text-success-600 dark:text-success-400 font-medium">{a}</span>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Ratings Breakdown</p>
              <div className="space-y-2">
                {ratingBreakdown.map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-ink-600 dark:text-ink-300">{r.label}</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-warning-400 fill-warning-400" />
                      <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{r.value}</span>
                    </div>
                  </div>
                ))}
                {ratingBreakdown.length === 0 && <p className="text-sm text-ink-400">No rating breakdown yet.</p>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
