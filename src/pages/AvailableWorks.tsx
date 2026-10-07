import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { FolderKanban, Clock, ArrowRight, Lock, CheckCircle2, Users, Upload, MessageSquare, AlertTriangle } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import ProjectChat from '../components/ui/ProjectChat';
import type { Project, Employee, TaskTemplate, Task } from '../data/db';
import { useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import { getDeadlineInfo } from '../utils/projectUtils';

export default function AvailableWorks({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user, role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [lockedProjects, setLockedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approveTarget, setApproveTarget] = useState<Project | null>(null);
  const [assignTarget, setAssignTarget] = useState<Project | null>(null);
  const [approveForm, setApproveForm] = useState({ downloadLinks: '', uploadLinks: '', deadline: '' });
  const [assignEditorName, setAssignEditorName] = useState('');
  const [assignTemplateGroup, setAssignTemplateGroup] = useState('');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [assignTargetTasks, setAssignTargetTasks] = useState<number>(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [projectTasksMap, setProjectTasksMap] = useState<Record<string, Task[]>>({});
  const [chatTarget, setChatTarget] = useState<Project | null>(null);
  const [pickWarning, setPickWarning] = useState<{ title: string; message: string; canViewMyWorks?: boolean } | null>(null);
  const [picking, setPicking] = useState(false);

  const ACTIVE_TASK_STATUSES = ['assigned', 'in-progress', 'partial-completed', 'fully-completed', 'submitted'];

  const handlePickTask = async (project: Project, taskId: string) => {
    if (role !== 'editor' || !user?.id) {
      onNavigate('working-screen', { id: project.id, taskId });
      return;
    }
    setPicking(true);
    try {
      const profile = await db.fetchProfile(user.id);
      if (!profile) {
        setPickWarning({
          title: 'Unable to pick task',
          message: 'We could not verify your editor profile. Please try again.',
        });
        setPicking(false);
        return;
      }

      // Check 1: Does this editor already have an active task anywhere?
      const myTasks = await db.fetchTasksByEmployee(profile.id);
      const activeTasks = myTasks.filter((t) => ACTIVE_TASK_STATUSES.includes(t.status));
      if (activeTasks.length > 0) {
        const activeTask = activeTasks[0];
        const projectName = activeTask.project?.event_name || activeTask.task_name || 'your current task';
        setPickWarning({
          title: 'You already have an active task',
          message: `You are currently working on "${activeTask.task_name}" for "${projectName}". Please complete and get it approved before picking a new task.`,
          canViewMyWorks: true,
        });
        setPicking(false);
        return;
      }

      // Check 2: Is the task still available (not picked by someone else)?
      const freshTasks = await db.fetchTasks(project.id);
      const freshTask = freshTasks.find((t) => t.id === taskId);
      if (!freshTask || freshTask.assigned_to || freshTask.status !== 'pending') {
        setPickWarning({
          title: 'Task no longer available',
          message: 'This task was just picked by another editor. Please try a different task or check back later.',
        });
        setPicking(false);
        return;
      }

      // Check 3: Are all previous stages approved?
      const sorted = [...freshTasks].sort((a, b) => a.sequence - b.sequence);
      const taskIndex = sorted.findIndex((t) => t.id === taskId);
      const previousLocked = sorted.slice(0, taskIndex).some((t) => t.status !== 'approved');
      if (previousLocked) {
        setPickWarning({
          title: 'Previous stage not approved',
          message: 'This stage is locked until the previous stage is approved by admin.',
        });
        setPicking(false);
        return;
      }

      // All checks passed — navigate to working screen
      onNavigate('working-screen', { id: project.id, taskId });
    } catch (err) {
      setPickWarning({
        title: 'Something went wrong',
        message: err instanceof Error ? err.message : 'Failed to pick this task. Please try again.',
      });
    }
    setPicking(false);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [allProjects, allEmployees, allTemplates] = await Promise.all([db.fetchProjects(), db.fetchEmployees(), db.fetchTaskTemplates()]);
        if (!active) return;
        setEmployees(allEmployees);
        setTemplates(allTemplates);
        const candidateProjects = allProjects.filter((p) =>
          (role === 'admin' ? p.status === 'created' || p.status === 'approved' : ['approved', 'assigned', 'in-progress'].includes(p.status))
        );
        const projectIds = candidateProjects.map((p) => p.id);
        const tasksPerProject = await Promise.all(projectIds.map((id) => db.fetchTasks(id)));
        if (!active) return;

        const myEmpId = await (async () => {
          if (role !== 'editor' || !user?.id) return null;
          const profile = await db.fetchProfile(user.id);
          return profile?.id ?? null;
        })();

        const locked = new Set<string>();
        const available: Project[] = [];
        candidateProjects.forEach((proj, i) => {
          if (role === 'admin') {
            available.push(proj);
            return;
          }
          const tasks = tasksPerProject[i];
          const hasMyTask = myEmpId ? tasks.some((t) => t.assigned_to === myEmpId) : false;
          const sorted = [...tasks].sort((a, b) => a.sequence - b.sequence);
          const hasPickable = sorted.some((t, idx) => {
            if (t.assigned_to || t.status !== 'pending') return false;
            return sorted.slice(0, idx).every((prev) => prev.status === 'approved');
          });
          const firstTask = sorted[0];
          const firstTaskActive = Boolean(firstTask && ['in-progress', 'partial-completed', 'fully-completed', 'submitted'].includes(firstTask.status));
          if (hasPickable || hasMyTask || firstTaskActive) {
            available.push(proj);
            if (firstTaskActive && !hasMyTask) locked.add(proj.id);
          } else {
            locked.add(proj.id);
          }
        });
        setProjects(available);
        setLockedProjects(locked);
        const taskMap: Record<string, Task[]> = {};
        candidateProjects.forEach((proj, i) => { taskMap[proj.id] = tasksPerProject[i] || []; });
        setProjectTasksMap(taskMap);
      } catch (err) {
        console.error('AvailableWorks load error:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [role, user?.email]);

  const refreshList = async () => {
    const allProjects = await db.fetchProjects();
    const candidateProjects = allProjects.filter((p) =>
      (role === 'admin' ? p.status === 'created' || p.status === 'approved' : ['approved', 'assigned', 'in-progress'].includes(p.status))
    );
    setProjects(candidateProjects);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    if (!approveForm.uploadLinks.trim()) {
      setActionError('Upload links are required before approving a project.');
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      const dl = approveForm.downloadLinks.trim();
      await db.transitionProjectStatus(approveTarget.id, 'approved');
      const deadlineValue = approveForm.deadline.trim() || approveTarget.deadline || null;
      await db.updateProject(approveTarget.id, { download_links: dl || null, upload_links: approveForm.uploadLinks.trim(), deadline: deadlineValue });
      await db.createNotification({
        type: 'project',
        title: 'Project approved',
        description: `Your project "${approveTarget.event_name}" (${approveTarget.order_number}) has been approved. Editors will be assigned soon.`,
        target_role: 'customer',
        target_email: approveTarget.customer_email || null,
        read: false,
        project_id: approveTarget.id,
      });
      await db.sendStatusEmail({
        templateName: 'project_approved',
        recipient: approveTarget.customer_email,
        recipientName: approveTarget.customer_name,
        variables: {
          customer_name: approveTarget.customer_name || 'there',
          project_name: approveTarget.event_name || '',
          order_number: approveTarget.order_number || '',
        },
      });
      await db.createNotification({
        type: 'new-order',
        title: 'New project ready for assignment',
        description: `"${approveTarget.event_name}" (${approveTarget.order_number}) is approved and ready for editor assignment.`,
        target_role: 'editor',
        read: false,
        project_id: approveTarget.id,
      });
      await db.createNotification({
        type: 'project',
        title: 'Project status changed to approved',
        description: `${approveTarget.event_name} (${approveTarget.order_number}) status changed from created to approved.`,
        target_role: 'admin',
        read: false,
        project_id: approveTarget.id,
      });
      setApproveTarget(null);
      setApproveForm({ downloadLinks: '', uploadLinks: '', deadline: '' });
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve project');
    }
    setProcessing(false);
  };

  const templateGroups = templates.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
    const g = t.group_name || 'Ungrouped';
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});
  Object.keys(templateGroups).forEach((g) => templateGroups[g].sort((a, b) => a.sort_order - b.sort_order));

  const handleAssignEditor = async () => {
    if (!assignTarget || !assignEditorName) return;
    const emp = employees.find((e) => e.name === assignEditorName);
    if (!emp) return;
    const groupKeys = Object.keys(templateGroups);
    if (groupKeys.length > 0 && !assignTemplateGroup) return;
    setProcessing(true);
    setActionError(null);
    try {
      await db.transitionProjectStatus(assignTarget.id, 'assigned');
      await db.updateProject(assignTarget.id, { editor_id: emp.id, editor_name: emp.name });
      if (assignTargetTasks === 0 && assignTemplateGroup) {
        const groupTemplates = templateGroups[assignTemplateGroup];
        if (groupTemplates && groupTemplates.length > 0) {
          let seq = 1;
          for (const t of groupTemplates) {
            const shouldAssign = seq === 1;
            await db.createTask({
              project_id: assignTarget.id,
              template_id: t.id,
              task_name: t.task,
              description: t.description,
              stage: t.stage,
              priority: t.priority.toLowerCase(),
              estimated_hours: t.estimated_hours,
              assigned_to: shouldAssign ? emp.id : null,
              assigned_to_name: shouldAssign ? emp.name : null,
              group_name: assignTemplateGroup,
              sequence: seq++,
              status: shouldAssign ? 'assigned' : 'pending',
            });
          }
        }
      } else if (assignTargetTasks > 0) {
        const existingTasks = await db.fetchTasks(assignTarget.id);
        const firstPending = existingTasks.find((t) => !t.assigned_to && (t.status === 'pending' || t.status === 'assigned'));
        if (firstPending) {
          await db.updateTask(firstPending.id, { assigned_to: emp.id, assigned_to_name: emp.name, status: 'assigned' });
        }
      }
      await db.createNotification({
        type: 'project',
        title: 'Editor assigned to project',
        description: `You have been assigned to "${assignTarget.event_name}" (${assignTarget.order_number}).`,
        target_role: 'editor',
        target_email: emp.email || null,
        read: false,
        project_id: assignTarget.id,
      });
      await db.sendStatusEmail({
        templateName: 'task_assigned',
        recipient: emp.email,
        recipientName: emp.name,
        variables: {
          editor_name: emp.name || 'there',
          task_name: assignTemplateGroup || 'Project tasks',
          project_name: assignTarget.event_name || '',
          order_number: assignTarget.order_number || '',
          priority: assignTarget.priority || '',
          estimated_hours: '',
          download_links: approveForm.downloadLinks || assignTarget.download_links || '',
        },
      });
      setAssignTarget(null);
      setAssignEditorName('');
      setAssignTemplateGroup('');
      setAssignTargetTasks(0);
      await refreshList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign editor');
    }
    setProcessing(false);
  };

  const projectColumns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event Name', sortable: true },
    { key: 'category', label: 'Category', render: (r) => <Badge status={r.category?.includes('Video') ? 'in-progress' : 'assigned'}>{r.category}</Badge> },
    { key: 'deadline', label: 'Task / Due', sortable: true, render: (r) => {
      const nextTask = (projectTasksMap[r.id] || []).slice().sort((a, b) => a.sequence - b.sequence).find((task) => task.status !== 'approved');
      const deadline = getDeadlineInfo(r.deadline, r.status);
      return (
        <div>
          <p className="font-medium text-ink-800 dark:text-ink-100">{nextTask?.task_name || 'No task assigned'}</p>
          <p className={`text-xs mt-0.5 ${deadline.color}`}>{deadline.label}</p>
        </div>
      );
    } },
  ];

  const projectActions = (row: Project) => {
    if (lockedProjects.has(row.id)) {
      return <span className="text-xs text-ink-400 font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Assigned to another editor</span>;
    }
    if (role === 'admin') {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.status === 'created' && (
            <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => { setApproveTarget(row); setApproveForm({ downloadLinks: '', uploadLinks: '' }); setActionError(null); }}>Approve</Button>
          )}
          {row.status === 'approved' && !row.editor_name && (
            <Button variant="primary" size="sm" icon={<Users className="w-3.5 h-3.5" />} onClick={async () => { setAssignTarget(row); setAssignEditorName(''); setAssignTemplateGroup(''); setActionError(null); const t = await db.fetchTasks(row.id); setAssignTargetTasks(t.length); }}>Assign Editor</Button>
          )}
          {row.status === 'approved' && row.editor_name && (
            <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: row.id })}>Open</Button>
          )}
        </div>
      );
    }
    const myEmpId = employees.find((e) => e.email === user?.email)?.id;
    const tasks = projectTasksMap[row.id] || [];
    const myTask = tasks.find((t) => t.assigned_to === myEmpId);
    const firstAvailableTask = [...tasks]
      .sort((a, b) => a.sequence - b.sequence)
      .find((task, index, sorted) => !task.assigned_to && task.status === 'pending' && sorted.slice(0, index).every((previous) => previous.status === 'approved'));
    const openTask = myTask || firstAvailableTask;
    const isPicking = picking && openTask?.id === openTask?.id;
    return (
      <div className="flex items-center gap-1">
        <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => openTask && handlePickTask(row, openTask.id)} disabled={isPicking}>{isPicking ? 'Checking...' : 'Open'}</Button>
        <Button variant="outline" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => setChatTarget(row)}>Chat</Button>
      </div>
    );
  };

  if (loading) return <FullPageSpinner />;

  const createdCount = projects.filter((p) => p.status === 'created').length;
  const approvedCount = projects.filter((p) => p.status === 'approved').length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate(role === 'admin' ? 'admin-dashboard' : 'employee-dashboard') }, { label: role === 'admin' ? 'New Orders' : 'Available Works' }]} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><FolderKanban className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{projects.length}</p><p className="text-xs text-ink-400">{role === 'admin' ? 'Total Orders' : 'Available Projects'}</p></div></div></Card>
        {role === 'admin' ? (
          <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{createdCount}</p><p className="text-xs text-ink-400">Awaiting Approval</p></div></div></Card>
        ) : (
          <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{projects.filter(p => p.priority === 'high').length}</p><p className="text-xs text-ink-400">High Priority</p></div></div></Card>
        )}
        <Card className="p-4 col-span-2 md:col-span-1"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-success-50 text-success-600 flex items-center justify-center"><FolderKanban className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{role === 'admin' ? approvedCount : projects.filter(p => p.status === 'approved').length}</p><p className="text-xs text-ink-400">{role === 'admin' ? 'Ready to Assign' : 'Ready to Start'}</p></div></div></Card>
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">{role === 'admin' ? 'New Orders to Process' : 'Available Projects'}</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{role === 'admin' ? 'Approve created orders, then assign editors to begin work' : 'Open a project and start work when you are ready'}</p>
        </div>
        <div className="px-5 pb-5">
          {projects.length === 0 ? (
            <div className="text-center py-10 text-ink-400 dark:text-ink-500">
              <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects available right now</p>
            </div>
          ) : (
            <DataTable columns={projectColumns} data={projects} actions={projectActions} pageSize={8} />
          )}
        </div>
      </Card>

      {/* Approve Project Modal */}
      <Modal open={!!approveTarget} onClose={() => { setApproveTarget(null); setApproveForm({ downloadLinks: '', uploadLinks: '', deadline: '' }); setActionError(null); }} title="Approve Project" size="md">
        {approveTarget && (
          <div className="space-y-4">
            {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{approveTarget.event_name}</p>
              <p className="text-xs text-ink-400 mt-1">{approveTarget.order_number} · {approveTarget.category}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Deadline</label>
              <input type="date" className="input" value={approveForm.deadline} onChange={(e) => setApproveForm({ ...approveForm, deadline: e.target.value })} />
              <p className="text-xs text-ink-400 mt-1.5">Set or adjust the delivery deadline. {approveTarget.deadline && <span>Current: {new Date(approveTarget.deadline).toLocaleDateString()}.</span>}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Download Link(s)</label>
              <textarea className="input" rows={3} value={approveForm.downloadLinks} onChange={(e) => setApproveForm({ ...approveForm, downloadLinks: e.target.value })} placeholder="Paste links for editors to download source files. One link per line." />
              <p className="text-xs text-ink-400 mt-1.5">These links will be available to editors on the first-stage task.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Upload Link(s) *</label>
              <textarea className="input" rows={3} value={approveForm.uploadLinks} onChange={(e) => setApproveForm({ ...approveForm, uploadLinks: e.target.value })} placeholder="Paste Google Drive / Dropbox links for raw files. One link per line." />
              <p className="text-xs text-ink-400 mt-1.5">These links will be saved to the project and shared with the assigned editor.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setApproveTarget(null); setApproveForm({ downloadLinks: '', uploadLinks: '', deadline: '' }); setActionError(null); }}>Cancel</Button>
              <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleApprove} disabled={processing || !approveForm.uploadLinks.trim()}>{processing ? 'Approving...' : 'Approve & Save Links'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Editor Modal */}
      <Modal open={!!assignTarget} onClose={() => { setAssignTarget(null); setAssignEditorName(''); setAssignTemplateGroup(''); setAssignTargetTasks(0); setActionError(null); }} title="Assign Editor" size="md">
        {assignTarget && (
          <div className="space-y-4">
            {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{assignTarget.event_name}</p>
              <p className="text-xs text-ink-400 mt-1">{assignTarget.order_number} · {assignTarget.category}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Select Editor</label>
              <select className="input" value={assignEditorName} onChange={(e) => setAssignEditorName(e.target.value)}>
                <option value="">Choose an editor...</option>
                {employees.map((e) => <option key={e.id} value={e.name}>{e.name} ({e.skills.join(', ')})</option>)}
              </select>
            </div>
            {assignTargetTasks === 0 && Object.keys(templateGroups).length > 0 && (
              <div className="space-y-2 animate-slide-up">
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Add Tasks from Template</label>
                <select className="input" value={assignTemplateGroup} onChange={(e) => setAssignTemplateGroup(e.target.value)}>
                  <option value="">Choose a task template group...</option>
                  {Object.keys(templateGroups).map((g) => (
                    <option key={g} value={g}>{g} ({templateGroups[g].length} stages)</option>
                  ))}
                </select>
                {assignTemplateGroup && templateGroups[assignTemplateGroup] && (
                  <div className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30">
                    <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Stages to be created & assigned:</p>
                    <div className="space-y-1.5">
                      {templateGroups[assignTemplateGroup].map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-ink-700 dark:text-ink-200 font-medium">{t.task}</span>
                          {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold">First</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-ink-400 mt-2">The first stage is assigned to {assignEditorName || 'the editor'} immediately; later stages stay pending until approved.</p>
                  </div>
                )}
              </div>
            )}
            {assignTargetTasks === 0 && Object.keys(templateGroups).length === 0 && (
              <p className="text-xs text-ink-400">No task templates found. You can add tasks manually after assigning.</p>
            )}
            {assignTargetTasks > 0 && (
              <p className="text-sm text-ink-600 dark:text-ink-300">This project already has {assignTargetTasks} task{assignTargetTasks !== 1 ? 's' : ''}. The first unassigned task will be assigned to this editor.</p>
            )}
            <p className="text-sm text-ink-600 dark:text-ink-300">Assigning an editor will set the project to "Assigned" status and notify the editor.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setAssignTarget(null); setAssignEditorName(''); setAssignTemplateGroup(''); setAssignTargetTasks(0); setActionError(null); }}>Cancel</Button>
              <Button variant="primary" size="sm" icon={<Users className="w-3.5 h-3.5" />} onClick={handleAssignEditor} disabled={processing || !assignEditorName || (assignTargetTasks === 0 && Object.keys(templateGroups).length > 0 && !assignTemplateGroup)}>{processing ? 'Assigning...' : 'Assign & Notify'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!chatTarget} onClose={() => setChatTarget(null)} title={chatTarget ? `Chat: ${chatTarget.order_number}` : ''} size="md">
        {chatTarget && <ProjectChat projectId={chatTarget.id} canUseInternal={true} />}
      </Modal>

      {/* Pick Warning Modal */}
      <Modal open={!!pickWarning} onClose={() => setPickWarning(null)} title="Cannot Pick Task" size="sm">
        {pickWarning && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-ink-800 dark:text-ink-100">{pickWarning.title}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{pickWarning.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              {pickWarning.canViewMyWorks && (
                <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => { setPickWarning(null); onNavigate('my-works'); }}>Go to My Works</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setPickWarning(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
