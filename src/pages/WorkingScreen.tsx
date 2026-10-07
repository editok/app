import { useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Progress from '../components/ui/Progress';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { Download, Upload, FileText, Send, Clock, Calendar, CheckCircle2, Lock, AlertTriangle, Trash2, MessageSquare, X, ChevronDown } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth, supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import { parseSourceLinks } from '../data/db';
import { computeProgressFromTasks, getWorkflowStage } from '../utils/projectUtils';
import ProjectChat from '../components/ui/ProjectChat';
import { useActiveTask } from '../hooks/useActiveTask';
import { useNotifications } from '../contexts/NotificationContext';

export default function WorkingScreen({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const { user } = useAuth();
  const {
    project, task, allTasks, status, loading, uploadedFiles, submitted, error, setError,
    setStatus, setTask, setProject, setUploadedFiles, setSubmitted,
    handleStatusChange, handleMarkPartialCompleted, handleMarkFullyCompleted,
  } = useActiveTask(params.id as string, params.taskId as string);

  const [update, setUpdate] = useState('');
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [agreementRead, setAgreementRead] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const [openedDestinations, setOpenedDestinations] = useState<Set<string>>(new Set());
  const { markProjectMessagesRead } = useNotifications();
  const workStarted = status === 'in-progress' || status === 'partial-completed' || status === 'fully-completed' || submitted;

  const handleStartWork = async (): Promise<boolean> => {
    if (!task || !project || !user?.email) return false;
    setError(null);
    try {
      const [profile, freshTasks] = await Promise.all([db.fetchProfile(user.id), db.fetchTasks(project.id)]);
      const employee = profile ? { id: profile.id, name: profile.full_name || '', email: profile.email || '' } : null;
      const freshTask = freshTasks.find((candidate) => candidate.id === task.id);
      if (!employee || !freshTask) throw new Error('This task is no longer available.');
      if (freshTask.assigned_to && freshTask.assigned_to !== employee.id) throw new Error('This task is assigned to another editor.');
      // Safety net: check if editor already has an active task elsewhere
      if (!freshTask.assigned_to) {
        const myTasks = await db.fetchTasksByEmployee(employee.id);
        const activeTasks = myTasks.filter((t) =>
          t.id !== freshTask.id && ['assigned', 'in-progress', 'partial-completed', 'fully-completed', 'submitted'].includes(t.status)
        );
        if (activeTasks.length > 0) {
          throw new Error('You already have an active task. Please complete and get it approved before starting a new one.');
        }
      }
      const previousTask = freshTasks
        .filter((candidate) => candidate.sequence < freshTask.sequence)
        .sort((a, b) => b.sequence - a.sequence)[0];
      if (previousTask && previousTask.status !== 'approved') throw new Error('This stage is locked until the previous stage is approved.');
      await db.updateTask(freshTask.id, { assigned_to: employee.id, assigned_to_name: employee.name, status: 'in-progress' });
      if (project.status === 'approved' || project.status === 'assigned') {
        await db.transitionProjectStatus(project.id, 'in-progress');
      }
      const startedTask = { ...freshTask, assigned_to: employee.id, assigned_to_name: employee.name, status: 'in-progress' };
      setTask(startedTask);
      setStatus('in-progress');
      setProject({ ...project, status: 'in-progress', editor_id: project.editor_id || employee.id, editor_name: project.editor_name || employee.name });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start this task.');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!task || !project) return;
    const prevStatus = status;
    try {
      await db.updateTask(task.id, { status: 'submitted', submitted_at: new Date().toISOString() });
      await db.createNotification({
        type: 'task-complete',
        title: 'Task submitted for review',
        description: `"${task.task_name}" for ${project.event_name} has been submitted. Please review and approve.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      await db.sendStatusEmail({
        templateName: 'admin_task_review',
        recipient: 'support@editok.in',
        recipientName: 'EDITOK Admin',
        variables: {
          task_name: task.task_name || '',
          project_name: project.event_name || '',
          order_number: project.order_number || '',
          editor_name: task.assigned_to_name || user?.user_metadata?.full_name || user?.email || '',
          submitted_at: new Date().toLocaleString(),
        },
      });
      await db.createNotification({
        type: 'project',
        title: 'Your project has a new update',
        description: `Work on "${project.event_name}" has been submitted for quality check.`,
        target_role: 'customer',
        target_email: project.customer_email || null,
        read: false,
        project_id: project.id,
      });
      const updatedTasks = allTasks.map((t) => (t.id === task.id ? { ...t, status: 'submitted' as const } : t));
      const allDone = updatedTasks.length > 0 && updatedTasks.every((t) => t.status === 'submitted' || t.status === 'approved');
      if (allDone && project.status === 'in-progress') {
        await db.transitionProjectStatus(project.id, 'finished');
        setProject({ ...project, status: 'finished' });
      }
      setSubmitted(true);
      setStatus('submitted');
      setTask({ ...task, status: 'submitted' });
      setShowSubmitConfirm(false);
      onNavigate('my-works');
    } catch (err) {
      setStatus(prevStatus);
      setError(err instanceof Error ? err.message : 'Failed to submit work. Please try again.');
      setShowSubmitConfirm(false);
    }
  };

  const handleMarkFileUploaded = () => {
    if (fileUrl.trim()) setShowUploadConfirm(true);
  };

  const handleConfirmDestinationUpload = async (url: string, description?: string) => {
    if (!task) return;
    const existing = task.editor_uploads ? parseSourceLinks(task.editor_uploads) : [];
    const updatedLinks = JSON.stringify([...existing, { url, description: description || 'Uploaded via destination' }]);
    try {
      await db.updateTask(task.id, { editor_uploads: updatedLinks });
      setTask({ ...task, editor_uploads: updatedLinks });
      setUploadedFiles([...uploadedFiles, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm upload');
    }
  };

  const handleConfirmFileUpload = async () => {
    if (!task || !fileUrl.trim()) return;
    const url = fileUrl.trim();
    const existing = task.editor_uploads ? parseSourceLinks(task.editor_uploads) : [];
    const updatedLinks = JSON.stringify([...existing, { url, description: null }]);
    try {
      await db.updateTask(task.id, { editor_uploads: updatedLinks });
      setTask({ ...task, editor_uploads: updatedLinks });
      setUploadedFiles([...uploadedFiles, url]);
      setFileUrl('');
      setShowUploadConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save uploaded file');
    }
  };

  const handleRemoveUploadedFile = async (index: number) => {
    if (!task) return;
    const existing = task.editor_uploads ? parseSourceLinks(task.editor_uploads) : [];
    const updated = JSON.stringify(existing.filter((_, i) => i !== index));
    await db.updateTask(task.id, { editor_uploads: updated });
    setTask({ ...task, editor_uploads: updated });
    setUploadedFiles(uploadedFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  const handlePostUpdate = async () => {
    if (!update.trim() || !task) return;
    setUpdateSaving(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      await db.createTaskUpdate({
        task_id: task.id,
        project_id: project?.id || null,
        employee_email: user?.email || null,
        update_text: update.trim(),
      });
      setUpdate('');
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to post update');
    }
    setUpdateSaving(false);
  };

  if (loading) return <FullPageSpinner />;
  if (!project) return <div className="text-center py-20 text-ink-400">Project not found</div>;

  const canInteract = workStarted;

  const isTaskLocked = (t: typeof task): boolean => {
    if (!t) return false;
    return allTasks.filter((x) => x.sequence < t.sequence).some((x) => x.status !== 'approved');
  };
  const locked = isTaskLocked(task);
  const previousApprovedTask = task
    ? allTasks
        .filter((candidate) => candidate.sequence < task.sequence && candidate.status === 'approved')
        .sort((a, b) => b.sequence - a.sequence)[0]
    : undefined;
  const previousStageDownloads = parseSourceLinks(previousApprovedTask?.download_links);
  const previousStageUploads = parseSourceLinks(previousApprovedTask?.upload_links);
  const taskDownloads = parseSourceLinks(task?.download_links);
  const taskUploads = parseSourceLinks(task?.upload_links);
  const projectDownloads = parseSourceLinks(project.download_links);
  const projectUploads = parseSourceLinks(project.upload_links);
  const musicLinks = parseSourceLinks(project.music_links);
  const sourceLinks = parseSourceLinks(project.source_links);
  const referenceLinks = parseSourceLinks(project.reference_links);
  const effectiveDownloads = taskDownloads.length > 0 ? taskDownloads : projectDownloads;
  const effectiveUploads = taskUploads.length > 0 ? taskUploads : projectUploads;
  if (locked && task) {
    const prevTask = allTasks.filter((x) => x.sequence < task.sequence).find((x) => x.status !== 'approved');
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'My Works', onClick: () => onNavigate('my-works') }, { label: project.order_number }, { label: 'Locked' }]} />
        <Card className="animate-slide-up">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="w-12 h-12 text-ink-300 dark:text-ink-600 mb-4" />
            <p className="text-lg font-bold text-ink-800 dark:text-ink-100">This stage is locked</p>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-2 max-w-md">
              You need to complete "{prevTask?.task_name || 'a previous stage'}" before you can access "{task.task_name}". Previous stages must be approved by admin first.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => onNavigate('my-works')}>Back to My Works</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'My Works', onClick: () => onNavigate('my-works') }, { label: project.order_number }, { label: 'Working' }]} />

      {error && (
        <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400 animate-slide-down">
          {error}
        </div>
      )}

      <Card className="animate-slide-up">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{task?.task_name || project.event_name}</h2>
              <Badge status={task?.status || project.status} />
            </div>
            <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">{project.order_number}</p>
          </div>
          <div className="flex items-center gap-3">
            {!canInteract && !submitted && task?.status !== 'approved' && !locked && (
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => { setAgreementRead(false); setAgreementChecked(false); setShowCopyrightModal(true); }}>
                Start Work
              </Button>
            )}
            <div className="text-right">
              <p className="text-xs text-ink-400 dark:text-ink-500">{getWorkflowStage(project.status).label}</p>
            </div>
            <div className="w-32">
              <Progress value={computeProgressFromTasks(allTasks, project.status)} size="lg" color="primary" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 stagger">
        <div className="lg:col-span-2 space-y-6">
          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-3">Job Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
              {[
                { icon: <Clock className="w-4 h-4" />, label: 'Est. Hours', value: `${task?.estimated_hours || 8} hrs` },
                { icon: <Calendar className="w-4 h-4" />, label: 'Deadline', value: project.deadline || 'N/A' },
                { icon: <FileText className="w-4 h-4" />, label: 'Stage', value: task?.stage || 'N/A' },
                { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Task #', value: `${task?.sequence || 1} of ${allTasks.length}` },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                  <div className="flex items-center gap-1.5 text-ink-400 dark:text-ink-500 mb-1">{item.icon}<span className="text-xs">{item.label}</span></div>
                  <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-3">Task Instructions</h3>
            <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
              <p className="text-sm text-ink-700 dark:text-ink-200">{task?.description || 'No specific instructions provided for this task.'}</p>
              {project.editing_style && <p className="text-xs text-ink-500 mt-2">Editing style: {project.editing_style}</p>}
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
            <Card className="animate-slide-up border-primary-200 dark:border-primary-500/30 bg-primary-50/25 dark:bg-primary-500/5">
              <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-primary-500" /> Download Files
              </h3>
              <div className="space-y-3">
                {previousStageDownloads.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                      <span>{previousApprovedTask?.task_name || 'Previous Stage'} Files <span className="font-normal text-ink-400">(previous stage)</span></span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    {previousStageDownloads.map((link, i) => (
                      <a key={`previous-download-${i}`} href={canInteract ? link.url : undefined} target="_blank" rel="noopener noreferrer" className={canInteract ? '' : 'pointer-events-none'}>
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border border-primary-100 dark:border-primary-500/20 mb-1 ${canInteract ? 'hover:border-primary-300' : 'opacity-50'} ${!canInteract ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `File ${i + 1}`}</span>
                            <p className="text-xs text-ink-400 truncate max-w-[180px] sm:max-w-[280px]">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!canInteract}>Get</Button>
                        </div>
                      </a>
                    ))}
                  </details>
                )}
                {effectiveDownloads.length > 0 && !previousApprovedTask && (
                  <details open className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                      <span>Project Files <span className="font-normal text-ink-400">(admin-provided)</span></span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    {effectiveDownloads.map((link, i) => (
                      <a key={`project-download-${i}`} href={canInteract ? link.url : undefined} target="_blank" rel="noopener noreferrer" className={canInteract ? '' : 'pointer-events-none'}>
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border border-ink-100 dark:border-ink-800 mb-1 ${canInteract ? 'hover:border-primary-200' : 'opacity-50'} ${!canInteract ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `File ${i + 1}`}</span>
                            <p className="text-xs text-ink-400 truncate max-w-[180px] sm:max-w-[280px]">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!canInteract}>Get</Button>
                        </div>
                      </a>
                    ))}
                  </details>
                )}
                {sourceLinks.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                      <span>Source Files <span className="font-normal text-ink-400">(customer-provided)</span></span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    {sourceLinks.map((link, i) => (
                      <a key={`project-source-${i}`} href={canInteract ? link.url : undefined} target="_blank" rel="noopener noreferrer" className={canInteract ? '' : 'pointer-events-none'}>
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border border-ink-100 dark:border-ink-800 mb-1 ${canInteract ? 'hover:border-primary-200' : 'opacity-50'} ${!canInteract ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `Source ${i + 1}`}</span>
                            <p className="text-xs text-ink-400 truncate max-w-[180px] sm:max-w-[280px]">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!canInteract}>Get</Button>
                        </div>
                      </a>
                    ))}
                  </details>
                )}
                {previousStageDownloads.length === 0 && effectiveDownloads.length === 0 && sourceLinks.length === 0 && (
                  <p className="text-xs text-ink-400">No files available from the previous stage</p>
                )}
                {musicLinks.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                      <span>Music Tracks <span className="font-normal text-ink-400">(customer-provided)</span></span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    {musicLinks.map((link, i) => (
                      <a key={`music-${i}`} href={canInteract ? link.url : undefined} target="_blank" rel="noopener noreferrer" className={canInteract ? '' : 'pointer-events-none'}>
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border border-ink-100 dark:border-ink-800 ${canInteract ? 'hover:border-primary-200' : 'opacity-50'} ${!canInteract ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `Music Track ${i + 1}`}</span>
                            <p className="text-xs text-ink-400 truncate max-w-[180px] sm:max-w-[280px]">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!canInteract}>Open</Button>
                        </div>
                      </a>
                    ))}
                  </details>
                )}
                {referenceLinks.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                      <span>Reference Files <span className="font-normal text-ink-400">(customer-provided)</span></span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    {referenceLinks.map((link, i) => (
                      <a key={`reference-${i}`} href={canInteract ? link.url : undefined} target="_blank" rel="noopener noreferrer" className={canInteract ? '' : 'pointer-events-none'}>
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border border-ink-100 dark:border-ink-800 mb-1 ${canInteract ? 'hover:border-primary-200' : 'opacity-50'} ${!canInteract ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `Reference ${i + 1}`}</span>
                            <p className="text-xs text-ink-400 truncate max-w-[180px] sm:max-w-[280px]">{link.url}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!canInteract}>Get</Button>
                        </div>
                      </a>
                    ))}
                  </details>
                )}
              </div>
            </Card>
            <Card className="animate-slide-up border-success-200 dark:border-success-500/30 bg-success-50/25 dark:bg-success-500/5">
              <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-success-500" /> Upload Files
              </h3>

              {previousStageUploads.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                    Upload Destination ({previousApprovedTask?.task_name || 'Previous Stage'})
                  </p>
                  {previousStageUploads.map((link, i) => {
                    const alreadyConfirmed = uploadedFiles.includes(link.url);
                    return (
                      <div key={`previous-upload-${i}`} className="rounded-lg border border-success-100 dark:border-success-500/20 hover:border-success-300 mb-1 overflow-hidden">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenedDestinations((prev) => new Set(prev).add(link.url))}>
                          <div className="flex items-center justify-between p-2.5">
                            <div className="min-w-0">
                              <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `Upload ${i + 1}`}</span>
                              {link.description && <p className="text-xs text-ink-400 truncate max-w-[120px] sm:max-w-[200px]">{link.url}</p>}
                            </div>
                            <Button variant="ghost" size="sm" icon={<Upload className="w-3.5 h-3.5" />}>Open</Button>
                          </div>
                        </a>
                        {!submitted && task?.status !== 'approved' && canInteract && openedDestinations.has(link.url) && (
                          <div className="px-2.5 pb-2.5">
                            <Button variant={alreadyConfirmed ? 'outline' : 'success'} size="sm" className="w-full" icon={<CheckCircle2 className="w-3.5 h-3.5" />} disabled={alreadyConfirmed} onClick={() => handleConfirmDestinationUpload(link.url, link.description || undefined)}>
                              {alreadyConfirmed ? 'Uploaded' : 'Confirm Uploaded'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : effectiveUploads.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                    Upload Destination
                  </p>
                  {effectiveUploads.map((link, i) => {
                    const alreadyConfirmed = uploadedFiles.includes(link.url);
                    return (
                      <div key={`project-upload-${i}`} className="rounded-lg border border-success-100 dark:border-success-500/20 hover:border-success-300 mb-1 overflow-hidden">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenedDestinations((prev) => new Set(prev).add(link.url))}>
                          <div className="flex items-center justify-between p-2.5">
                            <div className="min-w-0">
                              <span className="text-sm text-ink-600 dark:text-ink-300">{link.description || `Upload ${i + 1}`}</span>
                              {link.description && <p className="text-xs text-ink-400 truncate max-w-[120px] sm:max-w-[200px]">{link.url}</p>}
                            </div>
                            <Button variant="ghost" size="sm" icon={<Upload className="w-3.5 h-3.5" />}>Open</Button>
                          </div>
                        </a>
                        {!submitted && task?.status !== 'approved' && canInteract && openedDestinations.has(link.url) && (
                          <div className="px-2.5 pb-2.5">
                            <Button variant={alreadyConfirmed ? 'outline' : 'success'} size="sm" className="w-full" icon={<CheckCircle2 className="w-3.5 h-3.5" />} disabled={alreadyConfirmed} onClick={() => handleConfirmDestinationUpload(link.url, link.description || undefined)}>
                              {alreadyConfirmed ? 'Uploaded' : 'Confirm Uploaded'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink-400 mb-3">No upload destination provided by admin for the previous stage</p>
              )}

              {effectiveUploads.length > 0 && (
                <div className="flex items-center gap-2 my-3 text-xs text-ink-400">
                  <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">File URL *</label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder={canInteract ? "https://drive.google.com/..." : "Click Start Work to enable upload"}
                  className="input"
                  disabled={!canInteract}
                />
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Uploaded Files ({uploadedFiles.length})</p>
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-success-50 dark:bg-success-500/10 border border-success-100 dark:border-success-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success-500 flex-shrink-0" />
                      <span className="text-xs text-ink-600 dark:text-ink-300 truncate flex-1 min-w-0">{f}</span>
                      <button type="button" onClick={() => handleRemoveUploadedFile(i)} className="p-1 rounded-md text-ink-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors" title="Remove uploaded file" aria-label={`Remove ${f}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!submitted && task?.status !== 'approved' && canInteract && (
                <Button variant="outline" size="sm" className="w-full" icon={<Upload className="w-3.5 h-3.5" />} onClick={handleMarkFileUploaded} disabled={!fileUrl.trim()}>
                  Mark File Uploaded
                </Button>
              )}
            </Card>
          </div>

          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-3">Daily Update</h3>
            {updateError && <div className="p-2.5 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400 mb-3">{updateError}</div>}
            {updateSuccess && <div className="p-2.5 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 mb-3">Update posted successfully!</div>}
            <textarea
              value={update}
              onChange={(e) => setUpdate(e.target.value)}
              placeholder={canInteract ? "What did you work on today?" : "Click Start Work to begin"}
              className="w-full p-3 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white"
              rows={3}
              disabled={!canInteract}
            />
            <div className="flex justify-end mt-3">
              <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handlePostUpdate} disabled={!update.trim() || updateSaving || !canInteract}>
                {updateSaving ? 'Posting...' : 'Post Update'}
              </Button>
            </div>
          </Card>

          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-3">All Tasks in This Project</h3>
            <div className="space-y-2">
              {allTasks.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${t.status === 'approved' ? 'bg-success-500 text-white' : t.status === 'in-progress' || t.status === 'partial-completed' ? 'bg-warning-100 text-warning-700' : t.status === 'fully-completed' ? 'bg-accent-100 text-accent-700' : t.status === 'submitted' ? 'bg-primary-100 text-primary-700' : t.status === 'assigned' ? 'bg-purple-100 text-purple-700' : 'bg-ink-100 dark:bg-ink-800 text-ink-500'}`}>
                      {t.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : t.sequence}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{t.task_name}</p>
                      {t.status !== 'pending' && t.status !== 'partial-completed' && (
                        <p className="text-xs text-ink-400 capitalize">{t.status.replace('-', ' ')}</p>
                      )}
                    </div>
                  </div>
                  {t.id === task?.id && <Badge status="in-progress">Current</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6 animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Work Status</h3>
            <div className="space-y-4">
              {!canInteract && !submitted && task?.status !== 'approved' && (
                <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 text-center">
                  <Lock className="w-5 h-5 text-warning-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-warning-700 dark:text-warning-400 mb-2">Read-only mode</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mb-3">Click "Start" and accept the copyright terms to begin working on this task.</p>
                  <Button variant="primary" size="sm" className="w-full" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => { setAgreementRead(false); setAgreementChecked(false); setShowCopyrightModal(true); }}>
                    Start Work
                  </Button>
                </div>
              )}

              {canInteract && !submitted && task?.status !== 'approved' && (
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Current Status</label>
                  <select
                    value={status === 'submitted' ? 'completed' : status === 'partial-completed' ? 'partial' : status === 'fully-completed' ? 'fully' : status === 'assigned' ? 'pending' : status}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'partial') { handleMarkPartialCompleted(); }
                      else if (v === 'fully') { handleMarkFullyCompleted(); }
                      else { handleStatusChange(v); }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white dark:bg-ink-900 text-ink-900 dark:text-white"
                    disabled={submitted || task?.status === 'approved'}
                  >
                    <option value="in-progress">Working</option>
                    <option value="partial">Partially Completed</option>
                    <option value="fully">Fully Completed</option>
                  </select>
                </div>
              )}

              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500 dark:text-ink-400">Est. Time</span>
                  <span className="font-semibold text-ink-700 dark:text-ink-200">{task?.estimated_hours || 8} hrs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500 dark:text-ink-400">Deadline</span>
                  <span className="font-semibold text-error-600">{project.deadline || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500 dark:text-ink-400">Task</span>
                  <span className="font-semibold text-ink-700 dark:text-ink-200">{task?.sequence || 1} of {allTasks.length}</span>
                </div>
              </div>

              {submitted ? (
                <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 text-center">
                  <CheckCircle2 className="w-6 h-6 text-primary-500 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-400">Submitted for approval</p>
                  <p className="text-xs text-ink-400 mt-1">Admin will review and approve your work.</p>
                </div>
              ) : canInteract && status === 'fully-completed' ? (
                <Button variant="success" className="w-full" size="lg" icon={<Send className="w-4 h-4" />} onClick={() => setShowSubmitConfirm(true)} disabled={uploadedFiles.length === 0}>
                  Submit Work
                </Button>
              ) : canInteract ? (
                <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-800 text-center">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Mark your work as "Fully Completed" above to enable submission.</p>
                </div>
              ) : null}
              <Button variant="outline" className="w-full" onClick={() => onNavigate('my-works')}>
                Save & Exit
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={showCopyrightModal} onClose={() => setShowCopyrightModal(false)} title="Copyright Agreement" size="lg">
        <div className="space-y-4">
          <div
            className="max-h-72 overflow-y-auto p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-800"
            onScroll={(event) => {
              const element = event.currentTarget;
              if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) setAgreementRead(true);
            }}
          >
            <div className="space-y-4 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
              <p>Before starting this project, please read and accept the copyright and confidentiality terms below.</p>
              <p>All photographs, videos, audio, designs, source files, project files, drafts, exports, and other materials supplied by the client or created for this project remain the property of the client. Your access is limited to completing the assigned work.</p>
              <p>Under the Copyright Act, 1957, the client retains the rights in the commissioned work unless a separate written agreement states otherwise. You must not copy, publish, sell, share, reuse, modify, or distribute any project material outside the assigned project.</p>
              <p>You must not use the client’s files, finished work, work-in-progress, names, faces, locations, or project details in a portfolio, showreel, advertisement, social media post, training material, or any public or private showcase without prior written permission from the client.</p>
              <p>Keep all client information and project materials confidential. Store downloads securely, do not share account access, and report any accidental disclosure or security issue immediately.</p>
              <p>When the project is complete or access is withdrawn, stop using the materials and retain no copies except where required by law. These obligations continue after the project ends.</p>
              <p>By accepting, you confirm that you have read these terms, understand them, and will follow them while working on this project.</p>
            </div>
          </div>
          <p className={`text-xs ${agreementRead ? 'text-success-600 dark:text-success-400' : 'text-ink-400 dark:text-ink-500'}`}>
            {agreementRead ? 'You have reached the end of the agreement.' : 'Scroll to the end of the agreement to enable acceptance.'}
          </p>
          <label className={`flex items-start gap-2.5 ${agreementRead ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input type="checkbox" checked={agreementChecked} disabled={!agreementRead} onChange={(event) => setAgreementChecked(event.target.checked)} className="w-4 h-4 mt-0.5 rounded border-ink-300 text-primary-600" />
            <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">I have read and accept all the terms above</span>
          </label>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCopyrightModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} disabled={!agreementRead || !agreementChecked} onClick={async () => {
              const started = await handleStartWork();
              if (started) setShowCopyrightModal(false);
            }}>Agree & Start</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showUploadConfirm} onClose={() => setShowUploadConfirm(false)} title="Confirm File Upload" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-100 dark:border-warning-500/20">
            <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Please confirm this file is uploaded</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">The file link will be saved to this task for admin review.</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">File to confirm</p>
            <p className="text-xs text-ink-600 dark:text-ink-300 break-all">{fileUrl}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowUploadConfirm(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleConfirmFileUpload}>Confirm</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)} title="Confirm Work Submission" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-100 dark:border-warning-500/20">
            <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Please confirm all work files are uploaded</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Once submitted, admin will review your work. Make sure all files are correctly uploaded before proceeding.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Uploaded Files ({uploadedFiles.length})</p>
            {uploadedFiles.length > 0 ? (
              <div className="space-y-1.5">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-500 flex-shrink-0" />
                    <span className="text-xs text-ink-600 dark:text-ink-300">{f}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-error-500">No files uploaded yet!</p>
            )}
          </div>

          {uploadedFiles.length === 0 && (
            <p className="text-sm text-error-600 font-medium">You must upload at least one file before submitting.</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleSubmit} disabled={uploadedFiles.length === 0}>
              Confirm & Submit
            </Button>
          </div>
        </div>
      </Modal>

      <button
        onClick={() => {
          setChatOpen(true);
          if (project) markProjectMessagesRead(project.id);
        }}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-glow transition-all active:scale-95 flex items-center justify-center"
        aria-label="Open project chat"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-ink-900 shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                <h3 className="font-semibold text-ink-900 dark:text-white text-sm">Project Discussion</h3>
                <span className="text-xs text-ink-400">{project.order_number}</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" aria-label="Close chat">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 min-h-0">
              <ProjectChat projectId={project.id} canUseInternal compact workStarted={workStarted} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
