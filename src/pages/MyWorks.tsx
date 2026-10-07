import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import ProjectChat from '../components/ui/ProjectChat';
import { FolderOpen, Send, CheckCircle2, Clock, AlertCircle, Lock, MessageCircle, X, MessageSquarePlus } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Task, Project } from '../data/db';
import { useTasksByEmployee } from '../hooks/useTasks';
import DailyUpdateModal from '../components/ui/DailyUpdateModal';

interface TaskWithProject extends Task {
  project?: Project;
}

export default function MyWorks({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const { tasks, loading } = useTasksByEmployee(employeeId);
  const [projectTasksMap, setProjectTasksMap] = useState<Record<string, Task[]>>({});
  const [chatProject, setChatProject] = useState<{ id: string; name: string } | null>(null);
  const [updateModalTask, setUpdateModalTask] = useState<TaskWithProject | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    db.fetchProfile(user.id).then((profile) => {
      if (profile) setEmployeeId(profile.id);
    });
  }, [user?.id]);

  useEffect(() => {
    if (tasks.length === 0) return;
    let active = true;
    const projectIds = Array.from(new Set(tasks.map((t) => t.project_id)));
    Promise.all(projectIds.map((id) => db.fetchTasks(id))).then((results) => {
      if (!active) return;
      const map: Record<string, Task[]> = {};
      projectIds.forEach((id, i) => { map[id] = results[i]; });
      setProjectTasksMap(map);
    });
    return () => { active = false; };
  }, [tasks]);

  const isTaskLocked = (task: TaskWithProject): boolean => {
    const projectTasks = projectTasksMap[task.project_id] || [];
    return projectTasks.filter((t) => t.sequence < task.sequence).some((t) => t.status !== 'approved');
  };

  const activeTasks = tasks.filter((t) => t.status !== 'approved');

  const getDeadlineDisplay = (deadline?: string | null): { label: string; className: string } => {
    if (!deadline) return { label: 'No deadline', className: 'text-ink-400 dark:text-ink-500' };
    const deadlineDate = new Date(`${deadline}T23:59:59`);
    const daysRemaining = Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000);
    if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)}d overdue`, className: 'text-error-600 dark:text-error-400' };
    if (daysRemaining === 0) return { label: 'Due today', className: 'text-error-600 dark:text-error-400' };
    if (daysRemaining === 1) return { label: 'Due tomorrow', className: 'text-warning-600 dark:text-warning-400' };
    return { label: `${daysRemaining}d remaining`, className: 'text-ink-600 dark:text-ink-300' };
  };

  const handleSubmitTask = async (task: TaskWithProject) => {
    await db.updateTask(task.id, { status: 'submitted', submitted_at: new Date().toISOString() });
    if (task.project) {
      await db.createNotification({
        type: 'task-complete',
        title: 'Task submitted for review',
        description: `${task.assigned_to_name} submitted "${task.task_name}" for ${task.project?.event_name}. Please review and approve.`,
        target_role: 'admin',
        read: false,
      });
      await db.sendStatusEmail({
        templateName: 'admin_task_review',
        recipient: 'support@editok.in',
        recipientName: 'EDITOK Admin',
        variables: {
          task_name: task.task_name || '',
          project_name: task.project?.event_name || '',
          order_number: task.project?.order_number || '',
          editor_name: task.assigned_to_name || '',
          submitted_at: new Date().toLocaleString(),
        },
      });
      await db.createNotification({
        type: 'project',
        title: 'Your project has a new update',
        description: `Work on "${task.project?.event_name}" has been submitted for quality check.`,
        target_role: 'customer',
        target_email: task.project?.customer_email || null,
        read: false,
      });
    }
  };

  const columns: Column<TaskWithProject>[] = [
    { key: 'order_number', label: 'Project', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.project?.order_number || '—'}</span> },
    { key: 'task_name', label: 'Task', sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-ink-800 dark:text-ink-100">{r.task_name}</p>
        <p className="text-xs text-ink-400 dark:text-ink-500">{r.project?.event_name || ''}</p>
      </div>
    ) },
    { key: 'stage', label: 'Stage', render: (r) => <span className="text-ink-600 dark:text-ink-300">{r.stage || '—'}</span> },
    { key: 'deadline', label: 'Due', render: (r) => {
      const deadline = getDeadlineDisplay(r.project?.deadline);
      return (
        <div>
          <p className={`text-sm font-semibold ${deadline.className}`}>{deadline.label}</p>
          {r.project?.deadline && <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{r.project.deadline}</p>}
        </div>
      );
    } },
  ];

  const actions = (row: TaskWithProject) => {
    if (isTaskLocked(row)) {
      return <span className="text-xs text-ink-400 font-medium flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Locked</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" icon={<MessageCircle className="w-3.5 h-3.5" />} onClick={() => setChatProject({ id: row.project_id, name: row.project?.event_name || row.project?.order_number || 'Project' })}>Chat</Button>
        <Button variant="ghost" size="sm" icon={<FolderOpen className="w-3.5 h-3.5" />} onClick={() => onNavigate('working-screen', { id: row.project_id, taskId: row.id })}>Open</Button>
        {(row.status === 'in-progress' || row.status === 'partial-completed' || row.status === 'fully-completed') && (
          <Button variant="ghost" size="sm" icon={<MessageSquarePlus className="w-3.5 h-3.5" />} onClick={() => setUpdateModalTask(row)}>Update</Button>
        )}
        {(row.status === 'in-progress' || row.status === 'partial-completed' || row.status === 'fully-completed') && (
          <Button variant="success" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => onNavigate('working-screen', { id: row.project_id, taskId: row.id })}>Submit</Button>
        )}
        {row.status === 'submitted' && (
          <span className="text-xs text-primary-600 font-medium flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Awaiting approval</span>
        )}

      </div>
    );
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate('employee-dashboard') }, { label: 'My Works' }]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><FolderOpen className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{activeTasks.length}</p><p className="text-xs text-ink-400">Active Tasks</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-warning-50 text-warning-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{activeTasks.filter(t => t.status === 'in-progress' || t.status === 'partial-completed' || t.status === 'fully-completed').length}</p><p className="text-xs text-ink-400">Working</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><Send className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{activeTasks.filter(t => t.status === 'submitted').length}</p><p className="text-xs text-ink-400">Submitted</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-500 flex items-center justify-center"><AlertCircle className="w-5 h-5" /></div><div><p className="text-2xl font-bold text-ink-900 dark:text-white">{activeTasks.filter(t => t.status === 'pending' || t.status === 'assigned').length}</p><p className="text-xs text-ink-400">Not Started</p></div></div></Card>
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">My Assigned Tasks</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Complete tasks one by one. Admin will approve each before you proceed.</p>
        </div>
        <div className="px-5 pb-5">
          {activeTasks.length === 0 ? (
            <div className="text-center py-10 text-ink-400 dark:text-ink-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active tasks. Pick a project from Available Works!</p>
              <Button variant="primary" size="sm" className="mt-3" onClick={() => onNavigate('available-works')}>Browse Available Works</Button>
            </div>
          ) : (
            <DataTable columns={columns} data={activeTasks} actions={actions} pageSize={8} searchPlaceholder="Search my tasks..." />
          )}
        </div>
      </Card>

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success-500" /> Completed Tasks
          </h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Tasks approved by admin, grouped by order.</p>
        </div>
        <div className="px-5 pb-5">
          {(() => {
            const completed = tasks.filter((task) => task.status === 'approved');
            if (completed.length === 0) {
              return <p className="text-center py-8 text-sm text-ink-400 dark:text-ink-500">No completed tasks yet.</p>;
            }
            const groups = completed.reduce<Record<string, TaskWithProject[]>>((acc, task) => {
              const key = task.project?.order_number || 'Unknown';
              (acc[key] ||= []).push(task);
              return acc;
            }, {});
            const sortedKeys = Object.keys(groups).sort();
            return (
              <div className="space-y-4">
                {sortedKeys.map((orderNumber) => {
                  const groupTasks = groups[orderNumber].sort((a, b) => a.sequence - b.sequence);
                  const projectName = groupTasks[0]?.project?.event_name || '';
                  return (
                    <div key={orderNumber} className="rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-ink-50/70 dark:bg-ink-800/50 border-b border-ink-100 dark:border-ink-800 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 text-xs font-bold flex-shrink-0">{orderNumber}</span>
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate min-w-0">{projectName}</p>
                        <span className="ml-auto text-xs text-ink-400 dark:text-ink-500">{groupTasks.length} task{groupTasks.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-ink-100 dark:divide-ink-800">
                        {groupTasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="w-7 h-7 rounded-lg bg-success-50 dark:bg-success-500/15 text-success-600 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{task.task_name}</p>
                              <p className="text-xs text-ink-400 dark:text-ink-500">{task.stage || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-medium text-success-600 dark:text-success-400">Approved</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Card>

      {updateModalTask && (
        <DailyUpdateModal
          open={!!updateModalTask}
          onClose={() => setUpdateModalTask(null)}
          taskId={updateModalTask.id}
          taskName={updateModalTask.task_name}
          projectId={updateModalTask.project_id}
          employeeEmail={user?.email || null}
          onSubmitted={() => setUpdateModalTask(null)}
        />
      )}

      {/* Inline Chat Popup */}
      <Modal open={!!chatProject} onClose={() => setChatProject(null)} title={chatProject?.name || 'Project Chat'} size="lg">
        {chatProject && (
          <div className="h-[60vh]">
            <ProjectChat projectId={chatProject.id} compact />
          </div>
        )}
      </Modal>
    </div>
  );
}
