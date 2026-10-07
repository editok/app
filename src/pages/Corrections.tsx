import { useEffect, useMemo, useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import type { ReactNode } from 'react';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { AlertCircle, Eye, CheckCircle2, MessageSquare, Clock, FolderOpen, Mic, Film, Share2 } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth, supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Correction, Project } from '../data/db';
import ShareLinkModal from '../components/ShareLinkModal';

function getCorrectionItems(correction: Correction) {
  return [...correction.photo_marks, ...correction.video_timestamps, ...correction.voice_notes];
}

function isResolved(correction: Correction) {
  const items = getCorrectionItems(correction);
  return correction.status === 'completed' || (items.length > 0 && items.every((item) => item.resolved));
}

export default function Corrections({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { role, user } = useAuth();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const loadCorrections = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (role === 'customer' && user?.email) {
        const data = await db.fetchCorrectionsByCustomer(user.email);
        setCorrections(data.filter((c) => c.status !== 'draft'));
      } else if (role === 'editor' && user?.email) {
        const employees = await db.fetchEmployees();
        const emp = employees.find((e) => e.email === user.email);
        if (emp) {
          const data = await db.fetchCorrectionsForEditor(emp.id);
          setCorrections(data.filter((c) => c.status !== 'draft'));
        } else {
          setCorrections([]);
        }
      } else {
        const data = await db.fetchCorrections();
        setCorrections(data.filter((c) => c.status !== 'draft'));
      }
    } catch (err) {
      console.error('loadCorrections error:', err);
      setCorrections([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!role || ((role === 'customer' || role === 'editor') && !user?.email)) return;
    loadCorrections();
    if (!supabase) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('corrections-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadCorrections(true), 500);
      })
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
  }, [role, user?.email]);

  const groupedByOrder = useMemo(() => {
    const groups: Record<string, Correction[]> = {};
    corrections.forEach((correction) => {
      const orderNumber = correction.order_id || correction.project_id;
      if (!groups[orderNumber]) groups[orderNumber] = [];
      groups[orderNumber].push(correction);
    });
    return Object.entries(groups)
      .map(([orderNumber, orderCorrections]) => ({ orderNumber, corrections: orderCorrections }))
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
  }, [corrections]);

  const totals = useMemo(() => {
    const resolved = corrections.filter(isResolved).length;
    return {
      pending: corrections.length - resolved,
      resolved,
      total: corrections.length,
    };
  }, [corrections]);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate(role === 'admin' ? 'admin-dashboard' : role === 'editor' ? 'employee-dashboard' : 'customer-dashboard') }, { label: 'Corrections' }]} />

      <Card className="animate-slide-up border-primary-200 dark:border-primary-500/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h3 className="font-semibold text-ink-800 dark:text-ink-100">Correction Summary</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Orders are grouped below for a quick status overview. Open an order to review page-by-page corrections.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <SummaryCard icon={<AlertCircle className="w-5 h-5" />} value={totals.pending} label="Pending" tone="error" />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5" />} value={totals.resolved} label="Resolved" tone="success" />
        <SummaryCard icon={<MessageSquare className="w-5 h-5" />} value={totals.total} label="Total Corrections" tone="primary" />
        <SummaryCard icon={<FolderOpen className="w-5 h-5" />} value={groupedByOrder.length} label="Orders" tone="warning" />
      </div>

      <div className="space-y-3">
        {groupedByOrder.length === 0 ? (
          <Card className="text-center py-12">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-ink-300 dark:text-ink-600" />
            <p className="text-sm text-ink-400 dark:text-ink-500">No corrections yet. They will appear here when customers submit feedback.</p>
          </Card>
        ) : (
          groupedByOrder.map(({ orderNumber, corrections: orderCorrections }) => {
            const resolvedCount = orderCorrections.filter(isResolved).length;
            const pendingCount = orderCorrections.length - resolvedCount;
            const projectId = orderCorrections[0].project_id;
            const photoMarks = orderCorrections.reduce((count, correction) => count + correction.photo_marks.length, 0);
            const videoComments = orderCorrections.reduce((count, correction) => count + correction.video_timestamps.length, 0);
            const voiceNotes = orderCorrections.reduce((count, correction) => count + correction.voice_notes.length, 0);
            const orderStatus = pendingCount === 0 ? 'completed' : resolvedCount > 0 ? 'in-progress' : 'correction';

            return (
              <Card key={orderNumber} className="animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-mono text-sm font-bold text-ink-800 dark:text-ink-100">{orderNumber}</h3>
                        <Badge status={orderStatus}>{pendingCount === 0 ? 'Resolved' : pendingCount === orderCorrections.length ? 'Needs attention' : 'In progress'}</Badge>
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">{orderCorrections.length} correction{orderCorrections.length !== 1 ? 's' : ''} · {pendingCount} pending · {resolvedCount} resolved</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {role !== 'editor' && (
                      <Button variant="primary" size="sm" icon={<Share2 className="w-3.5 h-3.5" />} onClick={async () => { const p = await db.fetchProject(projectId); if (p) { setShareProject(p); setShowShareModal(true); } }}>Create Link</Button>
                    )}
                    <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('review-screen', { id: projectId })}>View</Button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-ink-100 dark:border-ink-800 flex items-center gap-2 flex-wrap">
                  {photoMarks > 0 && <SummaryChip icon={<MessageSquare className="w-3.5 h-3.5" />} value={photoMarks} label="page marks" tone="error" />}
                  {videoComments > 0 && <SummaryChip icon={<Film className="w-3.5 h-3.5" />} value={videoComments} label="video comments" tone="primary" />}
                  {voiceNotes > 0 && <SummaryChip icon={<Mic className="w-3.5 h-3.5" />} value={voiceNotes} label="voice notes" tone="warning" />}
                  <span className="ml-auto text-xs text-ink-400 dark:text-ink-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Updated {new Date(orderCorrections[0].updated_at).toLocaleDateString()}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ShareLinkModal open={showShareModal} project={shareProject} onClose={() => setShowShareModal(false)} onProjectUpdated={setShareProject} />
    </div>
  );
}

function SummaryCard({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: 'error' | 'success' | 'primary' | 'warning' }) {
  const styles = {
    error: 'bg-error-50 text-error-600',
    success: 'bg-success-50 text-success-600',
    primary: 'bg-primary-50 text-primary-600',
    warning: 'bg-warning-50 text-warning-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles[tone]}`}>{icon}</div>
        <div><p className="text-2xl font-bold text-ink-900 dark:text-white">{value}</p><p className="text-xs text-ink-400">{label}</p></div>
      </div>
    </Card>
  );
}

function SummaryChip({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: 'error' | 'primary' | 'warning' }) {
  const styles = {
    error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400',
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${styles[tone]}`}>{icon}{value} {label}</span>;
}
