import { useEffect, useState, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import Badge from '../components/ui/Badge';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { Search, Star, Award, TrendingUp } from 'lucide-react';
import * as db from '../data/db';
import type { PageKey } from '../components/Layout';
import type { ProjectRating, Employee, Project } from '../data/db';
import { computeEmployeeStats, formatRating } from '../utils/ratingStats';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeeRatings({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const { user, role } = useAuth();
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const isEditor = role === 'editor';
  const myEmployee = useMemo(() => employees.find((e) => e.email?.toLowerCase() === user?.email?.toLowerCase()) || null, [employees, user]);
  const selectedId = isEditor ? (myEmployee?.id || null) : ((params.id as string) || null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const emps = await db.fetchEmployees();
      if (!active) return;
      setEmployees(emps);
      const me = emps.find((e) => e.email?.toLowerCase() === user?.email?.toLowerCase()) || null;
      if (isEditor && me) {
        const [myRatings, p] = await Promise.all([db.fetchRatingsByEmployee(me.id), db.fetchProjects()]);
        if (!active) return;
        setRatings(myRatings);
        setProjects(p);
        setLoading(false);
        return;
      }
      const [allRatings, p] = await Promise.all([db.fetchAllRatings(), db.fetchProjects()]);
      if (!active) return;
      setRatings(allRatings);
      setProjects(p);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const employeeStats = useMemo(() => computeEmployeeStats(ratings), [ratings]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  }, [employees, search]);

  const selectedEmployee = selectedId ? employees.find((e) => e.id === selectedId) : null;
  const selectedStats = selectedId ? employeeStats.get(selectedId) : null;
  const selectedRatings = selectedId ? ratings.filter((r) => r.target_employee_id === selectedId) : [];

  const byProject = useMemo(() => {
    const map = new Map<string, ProjectRating[]>();
    for (const r of selectedRatings) {
      const arr = map.get(r.project_id) || [];
      arr.push(r);
      map.set(r.project_id, arr);
    }
    return map;
  }, [selectedRatings]);

  if (loading) return <FullPageSpinner />;

  if (isEditor) {
    if (!myEmployee) {
      return (
        <div className="max-w-xl mx-auto py-12">
          <Card className="text-center">
            <Star className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink-900 dark:text-white">No ratings profile found</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">Your editor profile hasn't been linked to a ratings account yet. Please contact an admin.</p>
          </Card>
        </div>
      );
    }
    const myStats = employeeStats.get(myEmployee.id);
    const myRatings = ratings.filter((r) => r.target_employee_id === myEmployee.id);
    const myByProject = new Map<string, ProjectRating[]>();
    for (const r of myRatings) {
      const arr = myByProject.get(r.project_id) || [];
      arr.push(r);
      myByProject.set(r.project_id, arr);
    }
    const myTaskBreakdown = myStats ? Array.from(myStats.byTask.entries()).sort((a, b) => b[1].average - a[1].average) : [];
    return (
      <div className="space-y-6">
        <Card className="animate-slide-up">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {myEmployee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-ink-900 dark:text-white">{myEmployee.name}</h2>
                <Badge status={myEmployee.status} />
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-ink-500 dark:text-ink-400">
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-warning-400 fill-warning-400" /> {myStats ? formatRating(myStats.average) : 'No ratings'}</span>
                <span>{myStats?.count || 0} ratings</span>
                <span>{myByProject.size} rated projects</span>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-500" /> Task Performance
            </h3>
            <div className="space-y-3">
              {myTaskBreakdown.map(([task, stat]) => (
                <div key={task} className="flex items-center justify-between">
                  <span className="text-sm text-ink-600 dark:text-ink-300">{task}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={stat.average} readOnly size={14} />
                    <span className="text-sm font-bold text-ink-700 dark:text-ink-200 w-12 text-right">{formatRating(stat.average)}</span>
                  </div>
                </div>
              ))}
              {myTaskBreakdown.length === 0 && <p className="text-sm text-ink-400">No task ratings yet. Ratings will appear here after customers submit feedback.</p>}
            </div>
          </Card>
          <Card className="lg:col-span-2 animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" /> Project Rating History
            </h3>
            <div className="space-y-4">
              {Array.from(myByProject.entries()).map(([projectId, rs]) => {
                const proj = projectMap.get(projectId);
                const projAvg = rs.reduce((a, r) => a + r.rating, 0) / rs.length;
                return (
                  <div key={projectId} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => onNavigate('project-details', { id: projectId })} className="text-sm font-semibold text-ink-800 dark:text-ink-100 hover:text-primary-500">
                        {proj?.event_name || proj?.order_number || projectId.slice(0, 8)}
                      </button>
                      <div className="flex items-center gap-2">
                        <StarRating value={projAvg} readOnly size={14} />
                        <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(projAvg)}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {rs.map((r) => (
                        <div key={r.id} className="flex items-start gap-2 text-xs">
                          <StarRating value={r.rating} readOnly size={12} />
                          <span className="font-medium text-ink-600 dark:text-ink-300">{r.target_task_name || r.target_role || 'General'}</span>
                          {r.comment && <span className="text-ink-400 italic flex-1 min-w-0">"{r.comment}"</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {myByProject.size === 0 && <p className="text-sm text-ink-400">No project ratings yet. Customer feedback will appear here once submitted.</p>}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedEmployee && selectedStats) {
    const taskBreakdown = Array.from(selectedStats.byTask.entries()).sort((a, b) => b[1].average - a[1].average);
    return (
      <div className="space-y-6">
        {!isEditor && <Breadcrumbs items={[{ label: 'Employee Ratings', onClick: () => onNavigate('employee-ratings') }, { label: selectedEmployee.name }]} />}

        <Card className="animate-slide-up">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {selectedEmployee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-ink-900 dark:text-white">{selectedEmployee.name}</h2>
                <Badge status={selectedEmployee.status} />
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-ink-500 dark:text-ink-400">
                <span className="flex items-center gap-1"><Star className="w-4 h-4 text-warning-400 fill-warning-400" /> {formatRating(selectedStats.average)}</span>
                <span>{selectedStats.count} ratings</span>
                <span>{byProject.size} rated projects</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-500" /> Task Performance
            </h3>
            <div className="space-y-3">
              {taskBreakdown.map(([task, stat]) => (
                <div key={task} className="flex items-center justify-between">
                  <span className="text-sm text-ink-600 dark:text-ink-300">{task}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={stat.average} readOnly size={14} />
                    <span className="text-sm font-bold text-ink-700 dark:text-ink-200 w-12 text-right">{formatRating(stat.average)}</span>
                  </div>
                </div>
              ))}
              {taskBreakdown.length === 0 && <p className="text-sm text-ink-400">No task ratings yet.</p>}
            </div>
          </Card>

          <Card className="lg:col-span-2 animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" /> Project Rating History
            </h3>
            <div className="space-y-4">
              {Array.from(byProject.entries()).map(([projectId, rs]) => {
                const proj = projectMap.get(projectId);
                const projAvg = rs.reduce((a, r) => a + r.rating, 0) / rs.length;
                return (
                  <div key={projectId} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => onNavigate('project-details', { id: projectId })} className="text-sm font-semibold text-ink-800 dark:text-ink-100 hover:text-primary-500">
                        {proj?.event_name || proj?.order_number || projectId.slice(0, 8)}
                      </button>
                      <div className="flex items-center gap-2">
                        <StarRating value={projAvg} readOnly size={14} />
                        <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(projAvg)}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {rs.map((r) => (
                        <div key={r.id} className="flex items-start gap-2 text-xs">
                          <StarRating value={r.rating} readOnly size={12} />
                          <span className="font-medium text-ink-600 dark:text-ink-300">{r.target_task_name || r.target_role || 'General'}</span>
                          {r.comment && <span className="text-ink-400 italic flex-1 min-w-0">"{r.comment}"</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {byProject.size === 0 && <p className="text-sm text-ink-400">No project ratings yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="animate-slide-up">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input placeholder="Search employees..." className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2">
          {filteredEmployees.map((emp) => {
            const stat = employeeStats.get(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => onNavigate('employee-ratings', { id: emp.id })}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                  {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{emp.name}</p>
                  <p className="text-xs text-ink-400">{stat ? `${stat.count} ratings` : 'No ratings yet'}</p>
                </div>
                {stat && (
                  <div className="flex items-center gap-2">
                    <StarRating value={stat.average} readOnly size={14} />
                    <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{formatRating(stat.average)}</span>
                  </div>
                )}
              </button>
            );
          })}
          {filteredEmployees.length === 0 && <p className="text-sm text-ink-400 text-center py-8">No employees found.</p>}
        </div>
      </Card>
    </div>
  );
}
