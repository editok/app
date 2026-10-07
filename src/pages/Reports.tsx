import { useState, useEffect, useCallback, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import { BarChart, LineChart, DonutChart } from '../components/ui/Charts';
import Button from '../components/ui/Button';
import { FileText, IndianRupee, FolderKanban, Users, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';
import type { Project, Payment, Employee, Correction } from '../data/db';

interface ChartPoint { label: string; value: number }
interface BarPoint { label: string; value: number }
interface DonutSlice { label: string; value: number; color: string }

const donutColors = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#06b6d4', '#eab308'];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);

  const loadData = useCallback(async (silent = false) => {
    if (!supabase) return;
    if (!silent) setLoading(true);
    try {
      const [projRes, payRes, empRes, corrRes] = await Promise.all([
        supabase.from('projects').select('id, order_number, event_name, customer_name, customer_email, category, status, amount, progress, editor_name, editor_id, created_at, deadline').limit(500),
        supabase.from('payments').select('id, project_id, amount, status, paid_at, created_at, transaction_id, payment_method').limit(500),
        supabase.from('employees').select('id, name, email, status, rating, projects, created_at').limit(500),
        supabase.from('corrections').select('id, number, project_id, status, priority, created_at, customer, customer_email, editor').limit(500),
      ]);
      setProjects(projRes.data || []);
      setPayments(payRes.data || []);
      setEmployees(empRes.data || []);
      setCorrections(corrRes.data || []);
    } catch (err) {
      console.error('Reports load failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (!supabase) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedLoad = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => loadData(true), 500); };
    const channel = supabase
      .channel('reports-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
  }, [loadData]);

  const totalRevenue = payments
    .filter((p) => p.status === 'paid' || p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalProjects = projects.length;
  const activeCustomers = new Set(projects.map((p) => p.customer_email).filter(Boolean)).size;
  const openCorrections = corrections.filter((c) => c.status === 'pending' || c.status === 'in-progress').length;

  const revenueData: ChartPoint[] = useMemo(() => {
    const months: Record<string, number> = {};
    payments.filter((p) => p.status === 'paid' || p.status === 'completed').forEach((p) => {
      const d = new Date(p.paid_at || p.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      months[key] = (months[key] || 0) + Number(p.amount || 0);
    });
    const ordered = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ordered.map((m) => ({ label: m, value: months[m] || 0 })).filter((_, i) => i < 12);
  }, [payments]);

  const monthlyOrders: ChartPoint[] = useMemo(() => {
    const months: Record<string, number> = {};
    projects.forEach((p) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      months[key] = (months[key] || 0) + 1;
    });
    const ordered = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ordered.map((m) => ({ label: m, value: months[m] || 0 }));
  }, [projects]);

  const employeePerformance: BarPoint[] = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((p) => {
      if (p.editor_name) counts[p.editor_name] = (counts[p.editor_name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [projects]);

  const categoryData: DonutSlice[] = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value], i) => ({
      label,
      value,
      color: donutColors[i % donutColors.length],
    }));
  }, [projects]);

  const monthlyBreakdown = useMemo(() => {
    const months: Record<string, { orders: number; revenue: number; completed: number; corrections: number }> = {};
    projects.forEach((p) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      if (!months[key]) months[key] = { orders: 0, revenue: 0, completed: 0, corrections: 0 };
      months[key].orders++;
      months[key].revenue += Number(p.amount || 0);
      if (p.status === 'completed') months[key].completed++;
    });
    corrections.forEach((c) => {
      const d = new Date(c.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      if (!months[key]) months[key] = { orders: 0, revenue: 0, completed: 0, corrections: 0 };
      months[key].corrections++;
    });
    const ordered = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ordered
      .map((m) => ({ label: m, ...(months[m] || { orders: 0, revenue: 0, completed: 0, corrections: 0 }) }))
      .filter((m) => m.orders > 0 || m.revenue > 0)
      .slice(0, 6);
  }, [projects, corrections]);

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-ink-900 dark:text-white">Reports & Analytics</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Comprehensive overview of business performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => { const h = ['Month,Orders,Revenue,Completed,Corrections']; const rows = monthlyBreakdown.map((m) => [m.label, m.orders, m.revenue, m.completed, m.corrections].join(',')); const blob = new Blob([...h, ...rows].join('\n'), { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reports.csv'; a.click(); URL.revokeObjectURL(url); }}>Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: <IndianRupee className="w-5 h-5" />, color: 'success' },
          { label: 'Total Projects', value: String(totalProjects), icon: <FolderKanban className="w-5 h-5" />, color: 'primary' },
          { label: 'Active Customers', value: String(activeCustomers), icon: <Users className="w-5 h-5" />, color: 'warning' },
          { label: 'Open Corrections', value: String(openCorrections), icon: <AlertCircle className="w-5 h-5" />, color: 'error' },
        ].map((s) => (
          <Card key={s.label} hover className="animate-slide-up hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500 dark:text-ink-400 font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-ink-900 dark:text-white mt-1">{s.value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color === 'success' ? 'bg-success-50 text-success-600' : s.color === 'primary' ? 'bg-primary-50 text-primary-600' : s.color === 'warning' ? 'bg-warning-50 text-warning-600' : 'bg-error-50 text-error-600'}`}>
                {s.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Revenue Report</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Monthly revenue throughout the year</p>
          <LineChart data={revenueData} height={240} color="#22c55e" />
        </Card>
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Projects Report</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Monthly order volume</p>
          <LineChart data={monthlyOrders} height={240} />
        </Card>
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Employee Performance</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Top performing editors by project count</p>
          <BarChart data={employeePerformance} height={240} />
        </Card>
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Category Distribution</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Projects by category</p>
          <div className="pt-4">
            <DonutChart data={categoryData} size={160} />
          </div>
        </Card>
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900 dark:text-white">Monthly Breakdown</h3>
          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => { const h = ['Month,Orders,Revenue,Completed,Corrections']; const rows = monthlyBreakdown.map((m) => [m.label, m.orders, m.revenue, m.completed, m.corrections].join(',')); const blob = new Blob([...h, ...rows].join('\n'), { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'monthly-breakdown.csv'; a.click(); URL.revokeObjectURL(url); }}>Download</Button>
        </div>
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800">
                {['Month', 'Orders', 'Revenue', 'Completed', 'Corrections'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider py-3 px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-ink-400">No data yet</td></tr>
              ) : monthlyBreakdown.map((m) => (
                <tr key={m.label} className="border-b border-ink-50 dark:border-ink-800/50 hover:bg-primary-50/30 transition-colors">
                  <td className="py-3 px-3 text-sm font-medium text-ink-700 dark:text-ink-200">{m.label} {new Date().getFullYear()}</td>
                  <td className="py-3 px-3 text-sm text-ink-600 dark:text-ink-300">{m.orders}</td>
                  <td className="py-3 px-3 text-sm font-semibold text-ink-700 dark:text-ink-200">₹{m.revenue.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3 text-sm text-ink-600 dark:text-ink-300">{m.completed}</td>
                  <td className="py-3 px-3 text-sm text-ink-600 dark:text-ink-300">{m.corrections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
