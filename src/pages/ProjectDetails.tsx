import { useState, useEffect, useRef } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { VerticalTimeline } from '../components/ui/Timeline';
import { Download, Upload, FileText, History, AlertCircle, Clock, Users, Star, Flag, Calendar, Eye, Plus, Check, X, MessageSquare, CheckCircle2, LayoutTemplate, Pencil, Link, ArrowRight, Lock, Loader2, Film, Image as ImageIcon, Share2, Undo2, DollarSign, Receipt, SplitSquareHorizontal, Send, FileCheck2, Save, UserMinus } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import * as db from '../data/db';
import type { Project, Task, Employee, TaskTemplate, Correction, ReviewFile, Payment, PaymentSplit, Invoice, ProjectPayment, InvoiceRevision, InvoiceType } from '../data/db';
import { parseSourceLinks } from '../data/db';
import TaskDailyUpdates from '../components/TaskDailyUpdates';
import ShareLinkModal from '../components/ShareLinkModal';
import ProjectChat from '../components/ui/ProjectChat';

export default function ProjectDetails({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const { role, user } = useAuth();
  const { markProjectMessagesRead } = useNotifications();
  const [tab, setTab] = useState('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [reviewFiles, setReviewFiles] = useState<ReviewFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showUploadReview, setShowUploadReview] = useState(false);
  const [newTask, setNewTask] = useState({ taskName: '', description: '', stage: '', assignedTo: '', estimatedHours: 8, priority: 'medium', groupName: '' });
  const [groupMode, setGroupMode] = useState(false);
  const [groupTasks, setGroupTasks] = useState<string[]>(['']);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [templateMode, setTemplateMode] = useState(false);
  const [selectedTemplateGroup, setSelectedTemplateGroup] = useState('');
  const [showEditTask, setShowEditTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editAssignTo, setEditAssignTo] = useState('');
  const [showEditTaskLinks, setShowEditTaskLinks] = useState(false);
  const [showApproveTaskModal, setShowApproveTaskModal] = useState(false);
  const [approvingTask, setApprovingTask] = useState<Task | null>(null);
  const [approveTaskDownloadLinks, setApproveTaskDownloadLinks] = useState('');
  const [approveTaskUploadLinks, setApproveTaskUploadLinks] = useState('');
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [editDownloadLinks, setEditDownloadLinks] = useState('');
  const [editUploadLinks, setEditUploadLinks] = useState('');
  const [outputLink, setOutputLink] = useState('');
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [reviewLinkUrl, setReviewLinkUrl] = useState('');
  const [reviewFileName, setReviewFileName] = useState('');
  const [reviewFileType, setReviewFileType] = useState('video');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reviewInputMode, setReviewInputMode] = useState<'file' | 'link'>('file');
  const [finalTaskUploadProgress, setFinalTaskUploadProgress] = useState<number | null>(null);
  const [finalTaskUploading, setFinalTaskUploading] = useState(false);
  const [finalTaskFile, setFinalTaskFile] = useState<File | null>(null);
  const finalTaskFileInputRef = useRef<HTMLInputElement>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [showAssignEditor, setShowAssignEditor] = useState(false);
  const [assignEditorName, setAssignEditorName] = useState('');
  const [assignTemplateGroup, setAssignTemplateGroup] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState('');
  const [uploadLinks, setUploadLinks] = useState('');
  const [approveDeadline, setApproveDeadline] = useState('');
  const [approving, setApproving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [autofillUpload, setAutofillUpload] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceType, setInvoiceType] = useState<'estimate' | 'final'>('estimate');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showProjectSplitModal, setShowProjectSplitModal] = useState(false);
  const [projectSplitLabels, setProjectSplitLabels] = useState<string[]>(['A', 'B']);
  const [projectSplitNames, setProjectSplitNames] = useState<string[]>(['', '']);
  const [projectSplitAmounts, setProjectSplitAmounts] = useState<string[]>(['', '']);
  const [projectSplitPhotos, setProjectSplitPhotos] = useState<string[]>(['', '']);
  const [projectSplitCategories, setProjectSplitCategories] = useState<string[]>(['', '']);
  const [projectSplitSubcategories, setProjectSplitSubcategories] = useState<string[]>(['', '']);
  const [projectSplitPriorities, setProjectSplitPriorities] = useState<string[]>(['medium', 'medium']);
  const [projectSplitDeadlines, setProjectSplitDeadlines] = useState<string[]>(['', '']);
  const [projectSplitAlbumSizes, setProjectSplitAlbumSizes] = useState<string[]>(['', '']);
  const [projectSplitDurations, setProjectSplitDurations] = useState<string[]>(['', '']);
  const [projectSplitEditStyles, setProjectSplitEditStyles] = useState<string[]>(['', '']);
  const [projectSplitLayoutDesigns, setProjectSplitLayoutDesigns] = useState<string[]>(['', '']);
  const [projectSplitThemes, setProjectSplitThemes] = useState<string[]>(['', '']);
  const [splittingProject, setSplittingProject] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingSplits, setSavingSplits] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [projectPayments, setProjectPayments] = useState<ProjectPayment[]>([]);
  const [invoiceRevisions, setInvoiceRevisions] = useState<InvoiceRevision[]>([]);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);
  const [showFinanceHistory, setShowFinanceHistory] = useState(false);
  const [addPaymentForm, setAddPaymentForm] = useState({ amount: '', paymentMethod: 'UPI', paymentType: 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
  const [editInvoiceForm, setEditInvoiceForm] = useState({ amount: '', reason: '' });
  const [financeSaving, setFinanceSaving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ event_name: '', theme: '', deadline: '', duration: '', album_size: '', editing_style: '', layout_design: '', photos: '', notes: '' });
  const [savingEditProject, setSavingEditProject] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeOutputLink, setCloseOutputLink] = useState('');
  const [closing, setClosing] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokingTask, setRevokingTask] = useState<Task | null>(null);
  const [revokeMode, setRevokeMode] = useState<'unassigned' | 'reassign'>('unassigned');
  const [revokeAssignTo, setRevokeAssignTo] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const myEmpId = employees.find((e) => e.email === user?.email)?.id;
  const handleShareWithClient = () => setShowShareModal(true);

  useEffect(() => {
    const id = String(params.id ?? params.projectId ?? '').trim();
    if (!id || !supabase) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.allSettled([
      db.fetchProject(id),
      db.fetchTasks(id),
      db.fetchEmployees(),
      db.fetchTaskTemplates(),
      db.fetchCorrectionsByProject(id),
      db.fetchReviewFiles(id),
    ]).then(async ([projectResult, tasksResult, employeesResult, templatesResult, correctionsResult, reviewFilesResult]) => {
      if (!active) return;
      if (projectResult.status === 'rejected') {
        throw projectResult.reason;
      }
      const p = projectResult.value;
      if (!p) {
        setLoadError('This project could not be found.');
        setLoading(false);
        return;
      }
      const t = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
      const emps = employeesResult.status === 'fulfilled' ? employeesResult.value : [];
      const tmpls = templatesResult.status === 'fulfilled' ? templatesResult.value : [];
      const corrs = correctionsResult.status === 'fulfilled' ? correctionsResult.value : [];
      const rf = reviewFilesResult.status === 'fulfilled' ? reviewFilesResult.value : [];

      const financeResults = await Promise.allSettled([
        db.fetchPayment(p.id),
        db.fetchPaymentSplits(p.id),
        db.fetchInvoice(p.id),
        db.fetchProjectPayments(p.id),
      ]);
      if (active) {
        const pay = financeResults[0].status === 'fulfilled' ? financeResults[0].value : null;
        const sp = financeResults[1].status === 'fulfilled' ? financeResults[1].value : [];
        const inv = financeResults[2].status === 'fulfilled' ? financeResults[2].value : null;
        const pp = financeResults[3].status === 'fulfilled' ? financeResults[3].value : [];
        setPayment(pay);
        setSplits(sp);
        const sa: Record<string, string> = {};
        sp.forEach((s) => { if (s.task_id) sa[s.task_id] = String(s.amount); });
        setSplitAmounts(sa);
        setInvoice(inv);
        setProjectPayments(pp);
        if (inv) {
          db.fetchInvoiceRevisions(inv.id).then((revs) => { if (active) setInvoiceRevisions(revs); }).catch(() => {});
        }
      }

      // Editor access control: only allow if they have a task in this project or there are unassigned tasks they can pick up.
      if (role === 'editor' && user?.email) {
        const emp = emps.find((e) => e.email === user.email);
        if (emp) {
          const hasMyTask = t.some((task) => task.assigned_to === emp.id);
          const hasUnassigned = t.some((task) => !task.assigned_to && task.status === 'pending');
          if (!hasMyTask && !hasUnassigned) {
            setAccessDenied(true);
            setProject(p);
            setTasks(t);
            setLoading(false);
            return;
          }
        }
      }
      // Customer access control: only allow if the project belongs to them.
      if (role === 'customer' && user?.email && p.customer_email !== user.email) {
        setAccessDenied(true);
        setProject(p);
        setLoading(false);
        return;
      }
      setAccessDenied(false);
      setProject(p);
      setTasks(t);
      setEmployees(emps);
      setTemplates(tmpls);
      setCorrections(corrs);
      setReviewFiles(rf);
      markProjectMessagesRead(p.id);
      const groups = Array.from(new Set(t.map((tk) => tk.group_name).filter((g): g is string => !!g)));
      setExistingGroups(groups);
      setLoading(false);
    }).catch((err) => { if (active) { setLoadError(err instanceof Error ? err.message : 'Failed to load project data'); setLoading(false); } });

    // Real-time: project updates
    const projChannel = supabase.channel(`pd-project-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` }, (payload) => {
        if (active) setProject(payload.new as Project);
      })
      .subscribe();

    // Real-time: task changes for this project
    const taskChannel = supabase.channel(`pd-tasks-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${id}` }, () => {
        if (!active) return;
        db.fetchTasks(id).then((t) => setTasks(t));
      })
      .subscribe();

    // Real-time: review files
    const rfChannel = supabase.channel(`pd-rf-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_files', filter: `project_id=eq.${id}` }, () => {
        if (!active) return;
        db.fetchReviewFiles(id).then((rf) => setReviewFiles(rf));
      })
      .subscribe();

    // Real-time: corrections
    const corrChannel = supabase.channel(`pd-corr-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections', filter: `project_id=eq.${id}` }, () => {
        if (!active) return;
        db.fetchCorrectionsByProject(id).then((c) => setCorrections(c));
      })
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(projChannel);
      supabase?.removeChannel(taskChannel);
      supabase?.removeChannel(rfChannel);
      supabase?.removeChannel(corrChannel);
    };
  }, [params.id]);

  const refreshTasks = async () => {
    if (!project) return;
    const t = await db.fetchTasks(project.id);
    setTasks(t);
    const progress = db.computeProgress(t);
    await db.updateProject(project.id, { progress });
    setProject({ ...project, progress });
  };

  const handleRejectProject = async () => {
    if (!project) return;
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejection.');
      return;
    }
    setRejecting(true);
    setActionError(null);
    try {
      await db.transitionProjectStatus(project.id, 'rejected');
      await db.updateProject(project.id, { rejected_reason: rejectReason.trim() });
      await db.createNotification({
        type: 'project',
        title: 'Project rejected',
        description: `Your project "${project.event_name}" was rejected. Reason: ${rejectReason.trim()}. Please edit and resubmit.`,
        target_role: 'customer',
        target_email: project.customer_email || null,
        read: false,
        project_id: project.id,
      });
      setProject({ ...project, status: 'rejected', rejected_reason: rejectReason.trim() });
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject project');
    }
    setRejecting(false);
  };

  const handleOpenEditProject = () => {
    if (!project) return;
    setEditProjectForm({
      event_name: project.event_name || '',
      theme: project.theme || '',
      deadline: project.deadline || '',
      duration: project.duration || '',
      album_size: project.album_size || '',
      editing_style: project.editing_style || '',
      layout_design: project.layout_design || '',
      photos: project.photos ? String(project.photos) : '',
      notes: project.notes || '',
    });
    setShowEditProjectModal(true);
  };

  const handleSaveEditProject = async () => {
    if (!project) return;
    setSavingEditProject(true);
    setActionError(null);
    try {
      const updates: Partial<Project> = {
        event_name: editProjectForm.event_name,
        theme: editProjectForm.theme,
        deadline: editProjectForm.deadline || null,
        duration: editProjectForm.duration || null,
        album_size: editProjectForm.album_size || null,
        editing_style: editProjectForm.editing_style || null,
        layout_design: editProjectForm.layout_design || null,
        photos: editProjectForm.photos ? parseInt(editProjectForm.photos) : null,
        notes: editProjectForm.notes || null,
      };
      const wasRejected = project.status === 'rejected';
      if (wasRejected) {
        updates.status = 'created';
        updates.rejected_reason = null;
        await db.transitionProjectStatus(project.id, 'created');
      }
      await db.updateProject(project.id, updates);
      if (wasRejected) {
        await db.createNotification({
          type: 'project',
          title: 'Project resubmitted',
          description: `Customer has edited and resubmitted "${editProjectForm.event_name}". Please review and approve.`,
          target_role: 'admin',
          read: false,
          project_id: project.id,
        });
      }
      setProject({ ...project, ...updates, status: wasRejected ? 'created' : project.status, rejected_reason: wasRejected ? null : project.rejected_reason });
      setShowEditProjectModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save project changes');
    }
    setSavingEditProject(false);
  };

  const handleApproveProject = async () => {
    if (!project) return;
    if (!uploadLinks.trim()) {
      setActionError('Upload links are required before approving a project.');
      return;
    }
    setApproving(true);
    setActionError(null);
    try {
      const dl = downloadLinks.trim();
      const categoryType = (project.category || '').toLowerCase().includes('video') ? 'video' : 'photo';
      let finalOrderNumber = project.order_number;
      if (finalOrderNumber.startsWith('PENDING-')) {
        finalOrderNumber = await db.generateOrderNumber(categoryType as 'photo' | 'video');
      }
      await db.transitionProjectStatus(project.id, 'approved');
      const deadlineValue = approveDeadline.trim() || project.deadline || null;
      await db.updateProject(project.id, { order_number: finalOrderNumber, download_links: dl || null, upload_links: uploadLinks.trim(), deadline: deadlineValue });
      await db.createNotification({
        type: 'project',
        title: 'Project approved',
        description: `Your project "${project.event_name}" (${finalOrderNumber}) has been approved. Editors will be assigned soon.`,
        target_role: 'customer',
        target_email: project.customer_email || null,
        read: false,
        project_id: project.id,
      });
      await db.createNotification({
        type: 'new-order',
        title: 'New project ready for assignment',
        description: `"${project.event_name}" (${finalOrderNumber}) is approved and ready for editor assignment.`,
        target_role: 'editor',
        read: false,
        project_id: project.id,
      });
      await db.createNotification({
        type: 'project',
        title: 'Project status changed to approved',
        description: `${project.event_name} (${finalOrderNumber}) status changed from created to approved.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setProject({ ...project, status: 'approved', order_number: finalOrderNumber, download_links: dl || null, upload_links: uploadLinks.trim(), deadline: deadlineValue });
      setShowApproveModal(false);
      setDownloadLinks('');
      setUploadLinks('');
      setApproveDeadline('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve project');
    }
    setApproving(false);
  };

  const handleAssignEditor = async () => {
    if (!project || !assignEditorName) return;
    const emp = employees.find((e) => e.name === assignEditorName);
    if (!emp) return;
    const groupKeys = Object.keys(templateGroups);
    if (groupKeys.length > 0 && !assignTemplateGroup) return;
    if (project.status === 'approved') { await db.transitionProjectStatus(project.id, 'assigned'); }
    await db.updateProject(project.id, { editor_id: emp.id, editor_name: emp.name });
    if (tasks.length === 0 && templates.length > 0 && assignTemplateGroup) {
      const groupTemplates = templateGroups[assignTemplateGroup];
      if (groupTemplates && groupTemplates.length > 0) {
        let seq = 1;
        for (const t of groupTemplates) {
          const shouldAssign = seq === 1;
          await db.createTask({
            project_id: project.id,
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
        refreshTasks();
      }
    } else if (tasks.length > 0 && !tasks.some((t) => t.assigned_to)) {
      const firstPending = tasks.find((t) => t.status === 'pending' || t.status === 'assigned');
      if (firstPending) {
        await db.updateTask(firstPending.id, { assigned_to: emp.id, assigned_to_name: emp.name, status: 'assigned' });
        refreshTasks();
      }
    }
    await db.createNotification({
      type: 'project',
      title: 'Editor assigned to project',
      description: `You have been assigned to "${project.event_name}" (${project.order_number}).`,
      target_role: 'editor',
      target_email: emp.email || null,
      read: false,
      project_id: project.id,
    });
    setProject({ ...project, editor_id: emp.id, editor_name: emp.name, status: project.status === 'approved' ? 'assigned' : project.status });
    setShowAssignEditor(false);
    setAssignEditorName('');
    setAssignTemplateGroup('');
  };

  const handleRevertApproval = async () => {
    if (!project) return;
    setActionError(null);
    try {
      await db.transitionProjectStatus(project.id, 'correction');
      await db.createNotification({
        type: 'project',
        title: 'Approval reverted',
        description: `Admin reverted the "approve as-is" for "${project.event_name}" (${project.order_number}). The project is back in correction.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setProject({ ...project, status: 'correction', progress: 70 });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revert approval');
    }
  };

  const handleSaveSplits = async () => {
    if (!project || !payment) return;
    setSavingSplits(true);
    setActionError(null);
    try {
      await db.deletePaymentSplits(project.id);
      const approvedTasks = tasks.filter((t) => t.status === 'approved' && t.assigned_to);
      const newSplits: Partial<PaymentSplit>[] = approvedTasks.map((t) => {
        const emp = employees.find((e) => e.id === t.assigned_to);
        return {
          payment_id: payment.id,
          project_id: project.id,
          task_id: t.id,
          employee_id: t.assigned_to,
          employee_name: emp?.name || t.assigned_to_name || null,
          task_name: t.task_name,
          amount: parseFloat(splitAmounts[t.id] || '0'),
          status: 'pending',
        };
      }).filter((s) => s.amount > 0);
      if (newSplits.length > 0) {
        await db.createPaymentSplits(newSplits);
      }
      const sp = await db.fetchPaymentSplits(project.id);
      setSplits(sp);
      await db.createNotification({
        type: 'payment',
        title: 'Payment split among editors',
        description: `Payment for "${project.event_name}" (${project.order_number}) has been split among ${newSplits.length} editor task(s).`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      newSplits.forEach((s) => {
        const emp = employees.find((e) => e.id === s.employee_id);
        if (emp?.email) {
          db.createNotification({
            type: 'payment-received',
            title: 'Earning allocated for your task',
            description: `₹${(s.amount || 0).toLocaleString()} allocated for task "${s.task_name}" on "${project.event_name}" (${project.order_number}).`,
            target_role: 'editor',
            target_email: emp.email,
            read: false,
            project_id: project.id,
          });
        }
      });
      setShowSplitModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save splits');
    }
    setSavingSplits(false);
  };

  const getInvoiceAmount = () => invoice?.current_amount ?? project.amount ?? 0;
  const getTotalPaid = () => {
    const newPaid = projectPayments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
    if (newPaid > 0) return newPaid;
    if (payment?.status === 'paid') return payment.amount;
    return 0;
  };
  const getBalance = () => getInvoiceAmount() - getTotalPaid();
  const getPaymentStatus = () => {
    const paid = getTotalPaid();
    const inv = getInvoiceAmount();
    if (paid <= 0) return 'Unpaid';
    if (paid < inv) return 'Partially Paid';
    if (paid === inv) return 'Fully Paid';
    return 'Overpaid';
  };

  const handleCreateProjectInvoice = async () => {
    if (!project) return;
    const amt = parseFloat(invoiceAmount);
    if (!amt || amt <= 0) { setActionError('Enter a valid amount'); return; }
    setSavingInvoice(true);
    setActionError(null);
    try {
      const inv = await db.createInvoice({ project_id: project.id, amount: amt, created_by: user?.email || 'admin', invoice_type: invoiceType });
      if (inv) setInvoice(inv);
      const existing = payment;
      if (existing) {
        await db.updatePayment(existing.id, { amount: amt, status: 'invoiced' });
        setPayment({ ...existing, amount: amt, status: 'invoiced' });
      } else {
        const pay = await db.createPayment({ project_id: project.id, amount: amt, status: 'invoiced' });
        setPayment(pay);
      }
      if (project.customer_email) {
        await db.createNotification({
          type: 'invoice',
          title: invoiceType === 'estimate' ? 'New estimate received' : 'Invoice created for your project',
          description: `${invoiceType === 'estimate' ? 'An estimate' : 'An invoice'} of ₹${amt.toLocaleString()} has been created for "${project.event_name}" (${project.order_number}). ${invoiceType === 'estimate' ? 'Please review and approve or reject it.' : 'Please complete the payment to proceed.'}`,
          target_role: 'customer',
          target_email: project.customer_email,
          read: false,
          project_id: project.id,
        });
      }
      await db.createNotification({
        type: 'invoice',
        title: invoiceType === 'estimate' ? 'Estimate created' : 'Invoice created',
        description: `${invoiceType === 'estimate' ? 'Estimate' : 'Invoice'} of ₹${amt.toLocaleString()} created for "${project.event_name}" (${project.order_number}).`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setProject({ ...project, amount: amt });
      setShowInvoiceModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create invoice');
    }
    setSavingInvoice(false);
  };

  const handleAddProjectPayment = async () => {
    if (!project) return;
    const amt = parseFloat(addPaymentForm.amount);
    if (!amt || amt <= 0) { setActionError('Enter a valid payment amount'); return; }
    setFinanceSaving(true);
    setActionError(null);
    try {
      await db.createProjectPayment({
        project_id: project.id,
        invoice_id: invoice?.id,
        amount: amt,
        payment_date: new Date(addPaymentForm.paymentDate).toISOString(),
        payment_method: addPaymentForm.paymentMethod,
        payment_type: addPaymentForm.paymentType,
        transaction_reference: addPaymentForm.transactionRef || undefined,
        notes: addPaymentForm.notes || undefined,
        created_by: user?.email || 'admin',
      });
      const pp = await db.fetchProjectPayments(project.id);
      setProjectPayments(pp);
      const newTotal = pp.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
      const invAmt = getInvoiceAmount();
      if (newTotal >= invAmt && project.status !== 'completed') {
        await db.transitionProjectStatus(project.id, 'completed');
        setProject({ ...project, status: 'completed', progress: 100 });
        if (project.customer_email) {
          await db.createNotification({
            type: 'project-completed',
            title: 'Project completed',
            description: `Your project "${project.event_name}" (${project.order_number}) is now complete. Thank you for working with us!`,
            target_role: 'customer',
            target_email: project.customer_email,
            read: false,
            project_id: project.id,
          });
        }
        await db.createNotification({
          type: 'project-completed',
          title: 'Project completed',
          description: `${project.order_number} - ${project.event_name} has been marked as completed.`,
          target_role: 'admin',
          read: false,
          project_id: project.id,
        });
      }
      await db.createNotification({
        type: 'payment',
        title: 'Payment recorded',
        description: `₹${amt.toLocaleString()} (${addPaymentForm.paymentType}) recorded for ${project.order_number}.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setShowAddPaymentModal(false);
      setAddPaymentForm({ amount: '', paymentMethod: 'UPI', paymentType: 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add payment');
    }
    setFinanceSaving(false);
  };

  const handleEditInvoiceAmount = async () => {
    if (!project || !invoice) return;
    const newAmt = parseFloat(editInvoiceForm.amount);
    if (!newAmt || newAmt <= 0) { setActionError('Enter a valid amount'); return; }
    if (!editInvoiceForm.reason.trim()) { setActionError('Reason is required'); return; }
    setFinanceSaving(true);
    setActionError(null);
    try {
      const updated = await db.updateInvoiceAmount(invoice.id, newAmt, editInvoiceForm.reason, user?.email || 'admin');
      if (updated) setInvoice(updated);
      const revs = await db.fetchInvoiceRevisions(invoice.id);
      setInvoiceRevisions(revs);
      await db.createNotification({
        type: 'invoice',
        title: 'Invoice revised',
        description: `Invoice for ${project.order_number} updated to ₹${newAmt.toLocaleString()}. Reason: ${editInvoiceForm.reason}`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setShowEditInvoiceModal(false);
      setEditInvoiceForm({ amount: '', reason: '' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revise invoice');
    }
    setFinanceSaving(false);
  };

  const refreshFinance = async () => {
    if (!project) return;
    const inv = await db.fetchInvoice(project.id);
    setInvoice(inv);
    const pp = await db.fetchProjectPayments(project.id);
    setProjectPayments(pp);
    if (inv) {
      const revs = await db.fetchInvoiceRevisions(inv.id);
      setInvoiceRevisions(revs);
    }
  };

  const handleCloseProject = async () => {
    if (!project) return;
    setClosing(true);
    setActionError(null);
    try {
      await db.updateProject(project.id, { output_link: closeOutputLink.trim() });
      await db.transitionProjectStatus(project.id, 'closed');
      setProject({ ...project, status: 'closed', output_link: closeOutputLink.trim(), progress: 100 });
      if (project.customer_email) {
        await db.createNotification({
          type: 'project',
          title: 'Project closed',
          description: `Your project "${project.event_name}" (${project.order_number}) has been closed. Thank you for working with us!`,
          target_role: 'customer',
          target_email: project.customer_email,
          read: false,
          project_id: project.id,
        });
      }
      await db.createNotification({
        type: 'project',
        title: 'Project closed',
        description: `${project.order_number} - ${project.event_name} has been closed.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setShowCloseModal(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to close project');
    }
    setClosing(false);
  };

  const templateGroups = templates.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
    const g = t.group_name || 'Ungrouped';
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});
  Object.keys(templateGroups).forEach((g) => templateGroups[g].sort((a, b) => a.sort_order - b.sort_order));

  const handleAddTask = async () => {
    if (!project) return;
    const emp = employees.find((e) => e.name === newTask.assignedTo);
    const groupName = newTask.groupName.trim() || null;

    if (templateMode) {
      const groupTemplates = templateGroups[selectedTemplateGroup];
      if (!groupTemplates || groupTemplates.length === 0) return;
      let seq = tasks.length + 1;
      const canAssignFirstTask = tasks.every((task) => task.status === 'approved');
      for (const t of groupTemplates) {
        const isFirst = tasks.length === 0 && seq === 1;
        const shouldAssign = canAssignFirstTask && seq === tasks.length + 1;
        await db.createTask({
          project_id: project.id,
          template_id: t.id,
          task_name: t.task,
          description: t.description,
          stage: t.stage,
          priority: t.priority.toLowerCase(),
          estimated_hours: t.estimated_hours,
          assigned_to: shouldAssign ? emp?.id || null : null,
          assigned_to_name: shouldAssign ? newTask.assignedTo || null : null,
          group_name: selectedTemplateGroup,
          sequence: seq++,
          status: shouldAssign && emp ? 'assigned' : 'pending',
          download_links: isFirst ? (project.download_links || null) : null,
          upload_links: isFirst ? (project.upload_links || null) : null,
        });
      }
      if (emp && !project.editor_id) {
        if (project.status === 'approved') { await db.transitionProjectStatus(project.id, 'assigned'); }
        await db.updateProject(project.id, { editor_id: emp.id, editor_name: emp.name });
        setProject({ ...project, editor_id: emp.id, editor_name: emp.name, status: project.status === 'approved' ? 'assigned' : project.status });
      }
      await db.createNotification({
        type: 'task-assigned',
        title: 'New task group assigned',
        description: `Group "${selectedTemplateGroup}" with ${groupTemplates.length} tasks assigned to ${newTask.assignedTo || 'unassigned'} for ${project.event_name}`,
        target_role: 'editor',
        read: false,
        project_id: project.id,
      });
      setShowAddTask(false);
      setTemplateMode(false);
      setSelectedTemplateGroup('');
      setNewTask({ taskName: '', description: '', stage: '', assignedTo: '', estimatedHours: 8, priority: 'medium', groupName: '' });
      refreshTasks();
      return;
    }

    if (groupMode) {
      const taskNames = groupTasks.map((t) => t.trim()).filter(Boolean);
      if (taskNames.length === 0) return;
      let seq = tasks.length + 1;
      const canAssignFirstTask = tasks.every((task) => task.status === 'approved');
      for (const name of taskNames) {
        const isFirst = tasks.length === 0 && seq === 1;
        const shouldAssign = canAssignFirstTask && seq === tasks.length + 1;
        await db.createTask({
          project_id: project.id,
          task_name: name,
          description: newTask.description || null,
          stage: newTask.stage || null,
          priority: newTask.priority,
          estimated_hours: newTask.estimatedHours,
          assigned_to: shouldAssign ? emp?.id || null : null,
          assigned_to_name: shouldAssign ? newTask.assignedTo || null : null,
          group_name: groupName,
          sequence: seq++,
          status: shouldAssign && emp ? 'assigned' : 'pending',
          download_links: isFirst ? (project.download_links || null) : null,
          upload_links: isFirst ? (project.upload_links || null) : null,
        });
      }
      if (emp && !project.editor_id) {
        if (project.status === 'approved') { await db.transitionProjectStatus(project.id, 'assigned'); }
        await db.updateProject(project.id, { editor_id: emp.id, editor_name: emp.name });
        setProject({ ...project, editor_id: emp.id, editor_name: emp.name, status: project.status === 'approved' ? 'assigned' : project.status });
      }
      await db.createNotification({
        type: 'task-assigned',
        title: 'New task group assigned',
        description: `Group "${groupName}" with ${taskNames.length} tasks assigned to ${newTask.assignedTo || 'unassigned'} for ${project.event_name}`,
        target_role: 'editor',
        read: false,
        project_id: project.id,
      });
      setShowAddTask(false);
      setNewTask({ taskName: '', description: '', stage: '', assignedTo: '', estimatedHours: 8, priority: 'medium', groupName: '' });
      setGroupTasks(['']);
      setGroupMode(false);
      refreshTasks();
      return;
    }

    if (!newTask.taskName) return;
    const seq = tasks.length + 1;
    const isFirst = tasks.length === 0;
    const canAssign = tasks.every((task) => task.status === 'approved');
    await db.createTask({
      project_id: project.id,
      task_name: newTask.taskName,
      description: newTask.description || null,
      stage: newTask.stage || null,
      priority: newTask.priority,
      estimated_hours: newTask.estimatedHours,
      assigned_to: canAssign ? emp?.id || null : null,
      assigned_to_name: canAssign ? newTask.assignedTo || null : null,
      group_name: groupName,
      sequence: seq,
      status: canAssign && emp ? 'assigned' : 'pending',
      download_links: isFirst ? (project.download_links || null) : null,
      upload_links: isFirst ? (project.upload_links || null) : null,
    });
    if (emp && !project.editor_id) {
      if (project.status === 'approved') { await db.transitionProjectStatus(project.id, 'assigned'); }
      await db.updateProject(project.id, { editor_id: emp.id, editor_name: emp.name });
      setProject({ ...project, editor_id: emp.id, editor_name: emp.name, status: project.status === 'approved' ? 'assigned' : project.status });
    }
    await db.createNotification({
      type: 'task-assigned',
      title: 'New task assigned',
      description: `Task "${newTask.taskName}" assigned to ${newTask.assignedTo || 'unassigned'} for ${project.event_name}`,
      target_role: 'editor',
      read: false,
      project_id: project.id,
    });
    setShowAddTask(false);
    setNewTask({ taskName: '', description: '', stage: '', assignedTo: '', estimatedHours: 8, priority: 'medium', groupName: '' });
    refreshTasks();
  };

  const isFinalTask = approvingTask ? !tasks.find((t) => t.sequence === approvingTask.sequence + 1) : false;

  const handleApproveTask = async () => {
    if (!project || !approvingTask) return;
    if (!isFinalTask && !approveTaskUploadLinks.trim()) {
      setActionError('Upload links are required before approving a task.');
      return;
    }
    if (isFinalTask && reviewInputMode === 'file' && !finalTaskFile) {
      setActionError('Please select a review file to upload before approving the final task.');
      return;
    }
    if (isFinalTask && reviewInputMode === 'link' && !reviewLinkUrl.trim()) {
      setActionError('Please paste a video link before approving the final task.');
      return;
    }
    setApprovingTaskId(approvingTask.id);
    setActionError(null);
    try {
      await db.updateTask(approvingTask.id, { status: 'approved', approved_at: new Date().toISOString(), approved_by: role || 'admin' });

      if (isFinalTask) {
        let fileUrl: string | null = null;
        if (reviewInputMode === 'link') {
          fileUrl = reviewLinkUrl.trim();
        } else {
          fileUrl = await uploadFinalTaskFile();
        }
        if (!fileUrl) {
          setActionError('Failed to upload review file. Please try again.');
          setApprovingTaskId(null);
          return;
        }
        const finalFileType = reviewInputMode === 'link' ? detectFileTypeFromUrl(fileUrl) : reviewFileType;
        const version = reviewFiles.length + 1;
        await db.createReviewFile({
          project_id: project.id,
          file_type: finalFileType,
          file_url: fileUrl,
          file_name: reviewFileName.trim() || `Version ${version}`,
          version,
          uploaded_by: role || 'admin',
        });
        const ul = approveTaskUploadLinks.trim();
        await db.transitionProjectStatus(project.id, 'review');
        await db.updateProject(project.id, { upload_links: ul || null });
        await db.createNotification({
          type: 'review-ready',
          title: 'Review files ready',
          description: `Admin has uploaded review files for "${project.event_name}". Please review and provide feedback.`,
          target_role: 'customer',
          target_email: project.customer_email || null,
          read: false,
          project_id: project.id,
        });
        await db.sendStatusEmail({
          templateName: 'review_ready',
          recipient: project.customer_email,
          recipientName: project.customer_name,
          variables: {
            customer_name: project.customer_name || 'there',
            project_name: project.event_name || '',
            order_number: project.order_number || '',
            proof_link: `${window.location.origin}/#review/${project.id}`,
          },
        });
        await db.createNotification({
          type: 'project',
          title: 'Project status changed to review',
          description: `${project.event_name} (${project.order_number}) status changed to review after final task approval.`,
          target_role: 'admin',
          read: false,
        });
        setProject({ ...project, status: 'review', upload_links: ul || null });
        const rf = await db.fetchReviewFiles(project.id);
        setReviewFiles(rf);
      } else {
        const dl = approveTaskDownloadLinks.trim();
        const ul = approveTaskUploadLinks.trim();
        const nextTask = tasks.find((t) => t.sequence === approvingTask.sequence + 1);
        if (nextTask) {
          await db.updateTask(nextTask.id, { download_links: dl || null, upload_links: ul });
        }
        const approvedEmp = employees.find((e) => e.id === approvingTask.assigned_to);
        await db.createNotification({
          type: 'task-approved',
          title: 'Task approved',
          description: `Admin approved "${approvingTask.task_name}" — the next stage is now available with new download and upload links.`,
          target_role: 'editor',
          target_email: approvedEmp?.email || null,
          read: false,
          project_id: project.id,
        });
        await db.sendStatusEmail({
          templateName: 'task_approved',
          recipient: approvedEmp?.email,
          recipientName: approvedEmp?.name,
          variables: {
            editor_name: approvedEmp?.name || 'there',
            task_name: approvingTask.task_name || '',
            project_name: project.event_name || '',
            order_number: project.order_number || '',
            upload_links: ul || '',
          },
        });
      }

      setShowApproveTaskModal(false);
      setApprovingTask(null);
      setApproveTaskDownloadLinks('');
      setApproveTaskUploadLinks('');
      setReviewLinkUrl('');
      setReviewFileName('');
      setFinalTaskFile(null);
      setFinalTaskUploadProgress(null);
      refreshTasks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve task');
    }
    setApprovingTaskId(null);
  };

  const handleRejectTask = async (task: Task) => {
    await db.updateTask(task.id, { status: 'in-progress', notes: 'Rejected by admin - needs revision' });
    const rejectEmp = employees.find((e) => e.id === task.assigned_to);
    await db.createNotification({
      type: 'correction',
      title: 'Task needs revision',
      description: `Admin requested changes on "${task.task_name}"`,
      target_role: 'editor',
      target_email: rejectEmp?.email || null,
      read: false,
      project_id: project.id,
    });
    refreshTasks();
  };

  const handleRevokeTask = async () => {
    if (!project || !revokingTask) return;
    if (revokeMode === 'reassign' && !revokeAssignTo.trim()) {
      setActionError('Please select an editor to reassign the task.');
      return;
    }
    setRevoking(true);
    setActionError(null);
    try {
      const originalEditor = employees.find((e) => e.id === revokingTask.assigned_to);
      const newEditor = revokeMode === 'reassign'
        ? employees.find((e) => e.name === revokeAssignTo) || null
        : null;
      await db.revokeTask(revokingTask.id, project.id, {
        newAssignedTo: newEditor,
        reason: revokeReason.trim(),
        originalEditorEmail: originalEditor?.email || null,
      });
      if (newEditor) {
        await db.createNotification({
          type: 'task-complete',
          title: 'Task assigned to you',
          description: `"${revokingTask.task_name}" has been assigned to you for ${project.event_name}.`,
          target_role: 'editor',
          target_email: newEditor.email || null,
          read: false,
          project_id: project.id,
        });
      }
      await refreshTasks();
      setShowRevokeModal(false);
      setRevokingTask(null);
      setRevokeReason('');
      setRevokeAssignTo('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke task');
    }
    setRevoking(false);
  };

  const handleEditTask = async () => {
    if (!editingTask) return;
    const emp = employees.find((e) => e.name === editAssignTo);
    const wasUnassigned = !editingTask.assigned_to;
    const newStatus = emp && (editingTask.status === 'pending' || editingTask.status === 'unassigned') ? 'assigned' : editingTask.status;
    await db.updateTask(editingTask.id, {
      assigned_to: emp?.id || null,
      assigned_to_name: editAssignTo || null,
      status: emp ? newStatus : (wasUnassigned ? 'pending' : editingTask.status),
    });
    setShowEditTask(false);
    setEditingTask(null);
    setEditAssignTo('');
    refreshTasks();
  };

  const handleEditTaskLinks = async () => {
    if (!editingTask) return;
    await db.updateTask(editingTask.id, {
      download_links: editDownloadLinks.trim() || null,
      upload_links: editUploadLinks.trim() || null,
    });
    setShowEditTaskLinks(false);
    setEditingTask(null);
    setEditDownloadLinks('');
    setEditUploadLinks('');
    refreshTasks();
  };

  const detectFileType = (file: File): string => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return 'video';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const detectFileTypeFromUrl = (url: string): string => {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv')) return 'video';
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';
    return 'video';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setActionError('File size exceeds 100MB limit.');
      return;
    }
    setActionError(null);
    setSelectedFile(file);
    setReviewFileType(detectFileType(file));
    setReviewFileName(file.name);
  };

  const handleUploadReviewFile = async () => {
    if (!project) return;
    if (reviewInputMode === 'link') {
      if (!reviewLinkUrl.trim()) { setActionError('Please paste a video link.'); return; }
      setUploading(true);
      setActionError(null);
      try {
        const version = reviewFiles.length + 1;
        const fileType = detectFileTypeFromUrl(reviewLinkUrl.trim());
        const fileName = reviewFileName.trim() || `Version ${version}`;
        await db.createReviewFile({
          project_id: project.id,
          file_type: fileType,
          file_url: reviewLinkUrl.trim(),
          file_name: fileName,
          version,
          uploaded_by: role || 'admin',
        });
        const newStatus = reviewFiles.length === 0 ? 'review' : 'correction';
        await db.transitionProjectStatus(project.id, newStatus);
        await db.createNotification({
          type: 'review-ready',
          title: 'Review files ready',
          description: `Admin has uploaded review files for "${project.event_name}". Please review and provide feedback.`,
          target_role: 'customer',
          read: false,
          project_id: project.id,
        });
        await db.sendStatusEmail({
          templateName: 'review_ready',
          recipient: project.customer_email,
          recipientName: project.customer_name,
          variables: {
            customer_name: project.customer_name || 'there',
            project_name: project.event_name || '',
            order_number: project.order_number || '',
            proof_link: `${window.location.origin}/#review/${project.id}`,
          },
        });
        await db.createNotification({
          type: 'project',
          title: `Project status changed to ${newStatus}`,
          description: `${project.event_name} (${project.order_number}) status changed to ${newStatus} after file upload.`,
          target_role: 'admin',
          read: false,
          project_id: project.id,
        });
        setShowUploadReview(false);
        setSelectedFile(null);
        setReviewLinkUrl('');
        setReviewFileName('');
        setUploadProgress(null);
        const rf = await db.fetchReviewFiles(project.id);
        setReviewFiles(rf);
        setProject({ ...project, status: newStatus });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to save review link');
      }
      setUploading(false);
      return;
    }
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);
    setActionError(null);
    try {
      const result = await db.uploadReviewFile(project.id, selectedFile, (p) => setUploadProgress(p.percent));
      if (!result) throw new Error('Upload failed');
      const version = reviewFiles.length + 1;
      await db.createReviewFile({
        project_id: project.id,
        file_type: reviewFileType,
        file_url: result.url,
        file_name: reviewFileName || `Version ${version}`,
        version,
        uploaded_by: role || 'admin',
      });
      const newStatus = reviewFiles.length === 0 ? 'review' : 'correction';
      await db.transitionProjectStatus(project.id, newStatus);
      await db.createNotification({
        type: 'review-ready',
        title: 'Review files ready',
        description: `Admin has uploaded review files for "${project.event_name}". Please review and provide feedback.`,
        target_role: 'customer',
        read: false,
        project_id: project.id,
      });
      await db.sendStatusEmail({
        templateName: 'review_ready',
        recipient: project.customer_email,
        recipientName: project.customer_name,
        variables: {
          customer_name: project.customer_name || 'there',
          project_name: project.event_name || '',
          order_number: project.order_number || '',
          proof_link: `${window.location.origin}/#review/${project.id}`,
        },
      });
      await db.createNotification({
        type: 'project',
        title: `Project status changed to ${newStatus}`,
        description: `${project.event_name} (${project.order_number}) status changed to ${newStatus} after file upload.`,
        target_role: 'admin',
        read: false,
        project_id: project.id,
      });
      setShowUploadReview(false);
      setSelectedFile(null);
      setReviewLinkUrl('');
      setReviewFileName('');
      setUploadProgress(null);
      const rf = await db.fetchReviewFiles(project.id);
      setReviewFiles(rf);
      setProject({ ...project, status: newStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(null);
    }
    setUploading(false);
  };

  const handleFinalTaskFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setActionError('File size exceeds 100MB limit.');
      return;
    }
    setActionError(null);
    setFinalTaskFile(file);
    setReviewFileType(detectFileType(file));
    setReviewFileName(file.name);
  };

  const uploadFinalTaskFile = async (): Promise<string | null> => {
    if (!project || !finalTaskFile) return null;
    setFinalTaskUploading(true);
    setFinalTaskUploadProgress(0);
    try {
      const result = await db.uploadReviewFile(project.id, finalTaskFile, (p) => setFinalTaskUploadProgress(p.percent));
      setFinalTaskUploading(false);
      return result?.url || null;
    } catch (err) {
      setFinalTaskUploading(false);
      setFinalTaskUploadProgress(null);
      setActionError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    }
  };

  if (loading) return <FullPageSpinner />;
  if (loadError) return <div className="text-center py-20 text-error-600"><AlertCircle className="w-8 h-8 mx-auto mb-3" /><p className="font-semibold">Failed to load project</p><p className="text-sm mt-1 text-ink-400">{loadError}</p></div>;
  if (!project) return <div className="text-center py-20 text-ink-400">Project not found</div>;
  if (accessDenied) {
    return (
      <div className="space-y-6">
        <Card className="text-center py-16">
          <Lock className="w-12 h-12 mx-auto mb-4 text-ink-300 dark:text-ink-600" />
          <h2 className="text-lg font-semibold text-ink-700 dark:text-ink-200 mb-2">Access restricted</h2>
          <p className="text-sm text-ink-400 dark:text-ink-500 max-w-md mx-auto">
            {role === 'editor'
              ? 'All tasks in this project have been picked up by other editors. You can only access projects where you have a task or where tasks are still available to pick up.'
              : 'You can only view projects that belong to your account.'}
          </p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => onNavigate(role === 'editor' ? 'available-works' : 'customer-dashboard')}>
            Back to {role === 'editor' ? 'Available Works' : 'My Dashboard'}
          </Button>
        </Card>
      </div>
    );
  }

  const currentTask = db.getCurrentTask(tasks);
  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isCustomer = role === 'customer';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Projects', onClick: () => onNavigate(isAdmin ? 'projects' : isEditor ? 'my-works' : 'my-orders') }, { label: project.order_number }]} />

      {actionError && (
        <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>
      )}

      <Card className="animate-slide-up overflow-hidden">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white truncate">{project.event_name}</h2>
              <Badge status={project.status} />
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-ink-500 dark:text-ink-400 flex-wrap">
              <span className="font-mono text-xs text-ink-600 dark:text-ink-300">{project.order_number}</span>
              {!isEditor && <><span className="text-ink-300">·</span><span>{project.customer_name}</span></>}
              {project.editor_name && !isCustomer && <><span className="text-ink-300">·</span><span>{project.editor_name}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Flag className="w-4 h-4 text-ink-500" />
            <div><p className="text-xs text-ink-500 dark:text-ink-400">Priority</p><p className="text-sm font-semibold capitalize text-ink-700 dark:text-ink-200">{project.priority}</p></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {isAdmin && project.status === 'created' && (
              <>
                <Button variant="success" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setShowApproveModal(true)}>Approve Project</Button>
                <Button variant="outline" icon={<SplitSquareHorizontal className="w-4 h-4" />} onClick={() => { setProjectSplitLabels(['A', 'B']); setProjectSplitNames(['', '']); setProjectSplitAmounts(['', '']); setShowProjectSplitModal(true); }}>Split Project</Button>
                <Button variant="danger" icon={<X className="w-4 h-4" />} onClick={() => setShowRejectModal(true)}>Reject</Button>
              </>
            )}
            {isAdmin && project.status === 'approved' && !project.editor_name && (
              <Button variant="primary" icon={<Users className="w-4 h-4" />} onClick={() => setShowAssignEditor(true)}>Assign Editor</Button>
            )}
            {isAdmin && project.status === 'correction_approved' && (
              <>
                <Button variant="success" icon={<FileText className="w-4 h-4" />} onClick={() => { setInvoiceAmount(String(project.amount || '')); setInvoiceType('estimate'); setShowInvoiceModal(true); }}>Create Bill</Button>
                <Button variant="outline" icon={<Undo2 className="w-4 h-4" />} onClick={handleRevertApproval}>Revert Approval</Button>
              </>
            )}
            {isAdmin && project.status === 'completed' && (
              <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={() => { setOutputLink(project.output_link || ''); setShowOutputModal(true); }}>Upload Output Link</Button>
            )}
            {isAdmin && project.status === 'correction_approved' && getPaymentStatus() === 'Fully Paid' && project.output_link && (
              <Button variant="success" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => { setCloseOutputLink(project.output_link || ''); setShowCloseModal(true); }}>Close Project</Button>
            )}
            {isAdmin && payment && payment.status === 'paid' && splits.length === 0 && (
              <Button variant="primary" icon={<Receipt className="w-4 h-4" />} onClick={() => setShowSplitModal(true)}>Split Payment</Button>
            )}
            {isAdmin && <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddTask(true)} disabled={project.status === 'created'}>Add Task</Button>}
            {isAdmin && <Button variant="primary" icon={<Upload className="w-4 h-4" />} onClick={() => setShowUploadReview(true)} disabled={project.status === 'created' || project.status === 'correction_approved' || (reviewFiles.length > 0 && project.status === 'review' && corrections.length === 0) || (project.status === 'correction' && corrections.length === 0) || (project.status !== 'finished' && project.status !== 'review' && project.status !== 'correction' && project.status !== 'correction_approved')} title={project.status === 'correction_approved' ? 'Customer has already approved this project' : project.status !== 'finished' && project.status !== 'review' && project.status !== 'correction' && project.status !== 'correction_approved' ? 'Work status must be finished before uploading review files' : reviewFiles.length > 0 && (project.status === 'review' || project.status === 'correction') && corrections.length === 0 ? 'Waiting for customer feedback on the current version before a new one can be uploaded' : undefined}>Upload Review File</Button>}
            {isAdmin && reviewFiles.length > 0 && (project.status === 'review' || project.status === 'correction') && corrections.length === 0 && (
              <span className="text-xs text-ink-400 dark:text-ink-500 italic">Waiting for customer feedback on V{reviewFiles[0]?.version} before uploading a new version</span>
            )}
            {isCustomer && project.status === 'rejected' && (
              <Button variant="primary" icon={<Pencil className="w-4 h-4" />} onClick={handleOpenEditProject}>Edit & Resubmit</Button>
            )}
            {isCustomer && project.status === 'created' && (
              <Button variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={handleOpenEditProject}>Edit Details</Button>
            )}
            <Button variant="outline" icon={<Eye className="w-4 h-4" />} onClick={() => onNavigate('review-screen', { id: project.id })}>Review</Button>
            {(isAdmin || role === 'customer') && reviewFiles.length > 0 && <Button variant="primary" icon={<Share2 className="w-4 h-4" />} onClick={handleShareWithClient}>Share with Client</Button>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <HeaderDetail label="Category" value={project.category} />
          <HeaderDetail label="Editing Style" value={(project.editing_style || project.layout_design) || 'Not specified'} />
          <HeaderDetail label="Photos" value={project.photos ? project.photos.toLocaleString() : 'N/A'} icon={<FileText className="w-4 h-4" />} />
          <HeaderDetail label="Album Size" value={project.album_size || 'N/A'} />
          <HeaderDetail label="Deadline" value={project.deadline || 'No deadline'} icon={<Calendar className="w-4 h-4" />} />
          <HeaderDetail label="Tasks" value={`${tasks.filter((task) => task.status === 'approved').length}/${tasks.length} done`} icon={<Clock className="w-4 h-4" />} />
        </div>

        <div className="mt-4 flex items-center gap-5 flex-wrap text-sm">
          {project.duration && <HeaderInline label="Duration" value={project.duration} />}
        </div>
      </Card>

      {/* Financials Section - Admin only */}
      {isAdmin && (
        <Card className="animate-slide-up">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success-500" /> Financials
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {invoice && (
                <>
                  {invoice.status === 'draft' && (
                    <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={async () => {
                      await db.transitionInvoiceStatus(invoice.id, 'sent');
                      const updated = await db.updateInvoice(invoice.id, { sent_at: new Date().toISOString() });
                      if (updated) setInvoice(updated);
                      if (project.customer_email) {
                        await db.createNotification({ type: 'invoice', title: invoice.invoice_type === 'estimate' ? 'Estimate sent for approval' : 'Final invoice sent', description: `${invoice.invoice_type === 'estimate' ? 'An estimate' : 'A final invoice'} of ₹${invoice.current_amount.toLocaleString()} for ${project.event_name} has been sent.`, target_role: 'customer', target_email: project.customer_email, read: false, project_id: project.id });
                      }
                    }}>Send</Button>
                  )}
                  {invoice.invoice_type === 'estimate' && invoice.status === 'approved' && (
                    <Button variant="success" size="sm" icon={<FileCheck2 className="w-3.5 h-3.5" />} onClick={async () => {
                      await db.transitionInvoiceStatus(invoice.id, 'sent');
                      const updated = await db.updateInvoice(invoice.id, { invoice_type: 'final', approved_at: new Date().toISOString(), sent_at: new Date().toISOString() });
                      if (updated) setInvoice(updated);
                      if (project.customer_email) {
                        await db.createNotification({ type: 'invoice', title: 'Final invoice received', description: `Your estimate for ${project.event_name} has been approved. A final invoice of ₹${invoice.current_amount.toLocaleString()} is now ready for payment.`, target_role: 'customer', target_email: project.customer_email, read: false, project_id: project.id });
                      }
                    }}>Convert to Final</Button>
                  )}
                  {invoice.invoice_type === 'final' && (
                    <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
                      setAddPaymentForm({ amount: '', paymentMethod: 'UPI', paymentType: getBalance() > 0 ? 'Partial' : 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
                      setShowAddPaymentModal(true);
                    }}>Add Payment</Button>
                  )}
                  <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => {
                    setEditInvoiceForm({ amount: String(invoice.current_amount), reason: '' });
                    setShowEditInvoiceModal(true);
                  }}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={<History className="w-3.5 h-3.5" />} onClick={() => setShowFinanceHistory(true)}>History</Button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-xs text-ink-400">Invoice Total</p>
              <p className="text-lg font-bold text-ink-700 dark:text-ink-200">₹{getInvoiceAmount().toLocaleString()}</p>
              {invoice && <p className="text-[10px] text-ink-400">{invoice.invoice_number}</p>}
            </div>
            {invoice && (
              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <p className="text-xs text-ink-400">Type / Status</p>
                <div className="flex flex-col items-start gap-1 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${invoice.invoice_type === 'estimate' ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400' : 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400'}`}>{invoice.invoice_type === 'estimate' ? 'Estimate' : 'Final Invoice'}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${invoice.status === 'approved' ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : invoice.status === 'rejected' ? 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' : invoice.status === 'sent' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300'}`}>{invoice.status}</span>
                  {invoice.rejected_reason && <span className="text-[10px] text-error-500">{invoice.rejected_reason}</span>}
                </div>
              </div>
            )}
            <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15">
              <p className="text-xs text-success-600">Total Paid</p>
              <p className="text-lg font-bold text-success-600 dark:text-success-400">₹{getTotalPaid().toLocaleString()}</p>
              <p className="text-[10px] text-success-600/70">{projectPayments.length} payment{projectPayments.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15">
              <p className="text-xs text-error-600">Balance</p>
              <p className="text-lg font-bold text-error-600 dark:text-error-400">₹{getBalance().toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-xs text-ink-400">Status</p>
              <p className="text-sm font-bold text-ink-700 dark:text-ink-200 mt-1">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                  getPaymentStatus() === 'Fully Paid' ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' :
                  getPaymentStatus() === 'Partially Paid' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' :
                  getPaymentStatus() === 'Overpaid' ? 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' :
                  'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300'
                }`}>{getPaymentStatus()}</span>
              </p>
            </div>
          </div>
          {invoice && projectPayments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
              <p className="text-xs font-semibold text-ink-400 mb-2">Recent Payments</p>
              <div className="space-y-1.5">
                {projectPayments.slice(0, 3).map((pp) => (
                  <div key={pp.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-success-600 dark:text-success-400">₹{pp.amount.toLocaleString()}</span>
                      <span className="text-xs text-ink-400">{pp.payment_type} · {pp.payment_method}</span>
                    </div>
                    <span className="text-xs text-ink-400">{new Date(pp.payment_date).toLocaleDateString()}</span>
                  </div>
                ))}
                {projectPayments.length > 3 && <p className="text-xs text-ink-400 text-center pt-1">+{projectPayments.length - 3} more — click History to see all</p>}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tasks Section - Key workflow component */}
      <Card className="animate-slide-up" padding={false}>
        <div className="p-5 pb-3 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
            <CheckCircle2Icon /> Task Workflow
          </h3>
          {isAdmin && <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddTask(true)} disabled={project.status === 'created'}>Add Task</Button>}
        </div>
        <div className="px-5 pb-5">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-ink-400 dark:text-ink-500">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{project.status === 'created' ? 'Project is awaiting admin approval. Tasks can be created after approval.' : 'No tasks created yet.'}{isAdmin && project.status !== 'created' && ' Click "Add Task" to create the first task.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, i) => {
                const isLocked = tasks.slice(0, i).some((t) => t.status !== 'approved');
                const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
                  pending: { color: 'text-ink-500', bg: 'bg-ink-100 dark:bg-ink-800', label: 'Unassigned' },
                  assigned: { color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-500/20', label: 'Assigned' },
                  'in-progress': { color: 'text-warning-600', bg: 'bg-warning-100 dark:bg-warning-500/20', label: 'Working' },
                  'partial-completed': { color: 'text-warning-600', bg: 'bg-warning-100 dark:bg-warning-500/20', label: 'Partially Completed' },
                  'fully-completed': { color: 'text-accent-600', bg: 'bg-accent-100 dark:bg-accent-500/20', label: 'Fully Completed' },
                  submitted: { color: 'text-primary-600', bg: 'bg-primary-100 dark:bg-primary-500/20', label: 'Submitted - Awaiting Approval' },
                  approved: { color: 'text-success-600', bg: 'bg-success-100 dark:bg-success-500/20', label: 'Approved' },
                };
                const cfg = statusConfig[task.status] || statusConfig.pending;
                const isCurrent = task.id === currentTask?.id;
                const taskDownloads = parseSourceLinks(task.download_links);
                const taskUploads = parseSourceLinks(task.upload_links);
                return (
                  <div key={task.id} className={`p-4 rounded-xl border-2 transition-all ${isCurrent ? 'border-primary-300 dark:border-primary-500/40 shadow-md' : 'border-ink-100 dark:border-ink-800'} ${isLocked ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${task.status === 'approved' ? 'bg-success-500 text-white' : cfg.bg} ${task.status === 'approved' ? '' : cfg.color}`}>
                        {task.status === 'approved' ? <Check className="w-4 h-4" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : task.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{task.task_name}</p>
                          {task.group_name && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />{task.group_name}
                            </span>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {task.description && <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{task.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-ink-400 dark:text-ink-500">
                          <span>Assigned: {task.assigned_to_name || 'Unassigned'}</span>
                          <span>·</span>
                          <span>Est: {task.estimated_hours}h</span>
                          {task.approved_at && <><span>·</span><span>Approved: {new Date(task.approved_at).toLocaleDateString()}</span></>}
                        </div>
                        {/* Admin download links as buttons */}
                        {taskDownloads.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {taskDownloads.map((dl, idx) => (
                              <a key={`dl-${idx}`} href={dl.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 text-xs font-semibold text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors">
                                <Download className="w-3 h-3" /> {dl.description || `Download ${idx + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                        {/* Admin upload destination links as buttons */}
                        {taskUploads.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {taskUploads.map((ul, idx) => (
                              <a key={`ul-${idx}`} href={ul.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success-50 dark:bg-success-500/10 border border-success-100 dark:border-success-500/20 text-xs font-semibold text-success-700 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-500/20 transition-colors">
                                <Upload className="w-3 h-3" /> {ul.description || `Upload ${idx + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                        {/* Editor uploaded files (from editor_uploads, deduped against admin upload destinations) */}
                        {(() => {
                          const editorFiles = parseSourceLinks(task.editor_uploads);
                          const adminUploadUrls = new Set(taskUploads.map((u) => u.url));
                          const dedupedEditorFiles = editorFiles.filter((f) => !adminUploadUrls.has(f.url));
                          if (dedupedEditorFiles.length === 0) return null;
                          return (
                            <div className="mt-2.5 rounded-lg bg-success-50 dark:bg-success-500/10 border border-success-100 dark:border-success-500/20 p-2.5">
                              <p className="text-xs font-semibold text-success-700 dark:text-success-400 mb-1.5 flex items-center gap-1.5">
                                <FileCheck2 className="w-3.5 h-3.5" /> Editor Uploaded Files ({dedupedEditorFiles.length})
                              </p>
                              <div className="space-y-1.5">
                                {dedupedEditorFiles.map((ul, idx) => (
                                  <a key={`eu-${idx}`} href={ul.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-1.5 rounded-md bg-white dark:bg-ink-800/60 hover:bg-success-100 dark:hover:bg-success-500/15 transition-colors group">
                                    <FileCheck2 className="w-3.5 h-3.5 text-success-500 flex-shrink-0" />
                                    <span className="text-xs text-ink-600 dark:text-ink-300 truncate flex-1 min-w-0">{ul.url}</span>
                                    <Download className="w-3.5 h-3.5 text-ink-300 group-hover:text-success-600 flex-shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-end gap-2 flex-wrap w-full sm:w-auto sm:flex-shrink-0">
                        {isAdmin && (
                          <button onClick={() => { setEditingTask(task); setEditAssignTo(task.assigned_to_name || ''); setShowEditTask(true); }} className="w-8 h-8 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/15 flex items-center justify-center text-ink-400 hover:text-primary-600 transition-colors" title="Edit assignment">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && !isLocked && (
                          <button onClick={() => { setEditingTask(task); setEditAssignTo(task.assigned_to_name || ''); setEditDownloadLinks(task.download_links || ''); setEditUploadLinks(task.upload_links || ''); setShowEditTaskLinks(true); }} className="w-8 h-8 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/15 flex items-center justify-center text-ink-400 hover:text-primary-600 transition-colors" title="Edit download/upload links">
                            <Link className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && task.status === 'submitted' && (
                          <>
                            <Button variant="success" size="sm" className="flex-1 sm:flex-none" icon={<Check className="w-3.5 h-3.5" />} onClick={() => { setApprovingTask(task); setApproveTaskDownloadLinks(''); setApproveTaskUploadLinks(''); setAutofillUpload(false); setShowApproveTaskModal(true); }}>Approve</Button>
                            <Button variant="danger" size="sm" className="flex-1 sm:flex-none" icon={<X className="w-3.5 h-3.5" />} onClick={() => handleRejectTask(task)}>Reject</Button>
                          </>
                        )}
                        {isAdmin && task.status !== 'approved' && task.status !== 'submitted' && task.status !== 'pending' && task.assigned_to && (
                          <button onClick={() => { setRevokingTask(task); setRevokeMode('unassigned'); setRevokeAssignTo(''); setRevokeReason(''); setShowRevokeModal(true); }} className="w-8 h-8 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/15 flex items-center justify-center text-ink-400 hover:text-error-600 transition-colors" title="Revoke / Reassign task">
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdmin && task.status === 'pending' && !task.assigned_to && (
                          <button onClick={() => { setRevokingTask(task); setRevokeMode('reassign'); setRevokeAssignTo(''); setRevokeReason(''); setShowRevokeModal(true); }} className="w-8 h-8 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/15 flex items-center justify-center text-ink-400 hover:text-primary-600 transition-colors" title="Assign to editor">
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isEditor && task.status === 'pending' && isLocked && (
                          <Button variant="outline" size="sm" icon={<Lock className="w-3.5 h-3.5" />} disabled>
                            Locked
                          </Button>
                        )}
                        {isEditor && !isLocked && (task.status === 'pending' || (task.status === 'assigned' && task.assigned_to === myEmpId)) && (
                          <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('working-screen', { id: project.id, taskId: task.id })}>
                            Open
                          </Button>
                        )}
                      </div>
                    </div>
                    {isAdmin && <TaskDailyUpdates taskId={task.id} isActive={true} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger">
        <div className="lg:col-span-2 space-y-6">
          <Card padding={false} className="animate-slide-up">
            <div className="px-5">
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: 'overview', label: 'Overview', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  { key: 'instructions', label: 'Instructions' },
                  { key: 'downloads', label: 'Downloads' },
                  { key: 'uploads', label: 'Review Files' },
                  { key: 'corrections', label: 'Corrections' },
                  { key: 'discussion', label: 'Discussion' },
                ]}
              />
            </div>
            <div className="p-5">
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Project Description</h4>
                    <p className="text-sm text-ink-500 dark:text-ink-400 leading-relaxed break-words whitespace-pre-wrap">{project.notes || `Full post-production for ${project.event_name}.`}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 dark:text-ink-500">Category</p>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-1">{project.category}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 dark:text-ink-500">Amount</p>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-1">₹{(project.amount ?? 0).toLocaleString()}</p>
                    </div>
                    {project.theme && <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 dark:text-ink-500">Theme</p>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-1">{project.theme}</p>
                    </div>}
                    {project.editing_style && <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 dark:text-ink-500">Editing Style</p>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-1">{project.editing_style}</p>
                    </div>}
                    {project.layout_design && <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 dark:text-ink-500">Layout Designing</p>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-1">{project.layout_design}</p>
                    </div>}
                  </div>
                </div>
              )}
              {tab === 'instructions' && (
                <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                  <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-400 mb-2">Task Instructions</h4>
                  {tasks.some((task) => task.description) ? (
                    <div className="space-y-3">
                      {tasks.filter((task) => task.description).map((task) => (
                        <div key={task.id}>
                          <p className="text-xs font-semibold text-primary-700/70 dark:text-primary-300/70">{task.task_name}</p>
                          <p className="text-sm text-ink-600 dark:text-ink-300 mt-0.5 whitespace-pre-wrap">{task.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500 dark:text-ink-400">No task instructions provided.</p>
                  )}
                  {parseSourceLinks(project.source_links).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-ink-500 mb-1">Source Links:</p>
                      {parseSourceLinks(project.source_links).map((link, i) => (
                        <p key={i} className="text-xs text-ink-500">{link.description ? `${link.description}: ` : ''}<a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{link.url}</a></p>
                      ))}
                    </div>
                  )}
                  {project.music_links && <p className="text-xs text-ink-500 mt-2">Music: {project.music_links}</p>}
                </div>
              )}
              {tab === 'downloads' && (
                <div className="space-y-2">
                  {parseSourceLinks(project.source_links).map((link, i) => (
                    <DownloadLink key={i} label={link.description || `Source Files ${i + 1}`} url={link.url} />
                  ))}
                  {project.upload_links && <DownloadLink label="Upload Destination" url={project.upload_links} />}
                  {project.reference_links && <DownloadLink label="Reference Files" url={project.reference_links} />}
                  {parseSourceLinks(project.source_links).length === 0 && !project.upload_links && !project.reference_links && <p className="text-sm text-ink-400 text-center py-6">No download links available</p>}
                </div>
              )}
              {tab === 'uploads' && (
                <div className="space-y-2">
                  {reviewFiles.length === 0 ? (
                    <p className="text-sm text-ink-400 text-center py-6">No review files uploaded yet. {isAdmin && 'Use "Upload Review File" to add files for customer review.'}</p>
                  ) : (
                    reviewFiles.map((rf) => (
                      <div key={rf.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                        <div className="flex items-center gap-3 min-w-0">
                          {rf.file_type === 'video' ? <FileText className="w-5 h-5 text-primary-500" /> : <Upload className="w-5 h-5 text-success-500" />}
                          <div>
                            <span className="text-sm font-medium text-ink-700 dark:text-ink-200 truncate">{rf.file_name || `Version ${rf.version}`}</span>
                            <p className="text-xs text-ink-400">V{rf.version} · {new Date(rf.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('review-screen', { id: project.id })}>View</Button>
                      </div>
                    ))
                  )}
                </div>
              )}
              {tab === 'corrections' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('review-screen', { id: project.id })}>Open Review Screen</Button>
                  </div>
                  {corrections.length === 0 ? (
                    <p className="text-sm text-ink-400 text-center py-6">No corrections requested</p>
                  ) : (
                    corrections.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-100 dark:border-error-500/30">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-error-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-error-700 dark:text-error-400">{c.number || 'Correction'}</p>
                              <Badge status={c.status} />
                            </div>
                            <p className="text-sm text-ink-600 dark:text-ink-300 mt-1">{c.photo_marks.length} photo marks, {c.video_timestamps.length} video timestamps, {c.voice_notes.length} voice notes</p>
                            <p className="text-xs text-ink-400 mt-2">Due: {c.due_date || 'N/A'} · Editor: {c.editor || 'Unassigned'}</p>
                          </div>
                          <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => onNavigate('corrections')}>View</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {tab === 'discussion' && (
                <ProjectChat projectId={project.id} canUseInternal={role === 'admin' || role === 'editor'} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Project Info</h3>
            <div className="space-y-3">
              <InfoRow icon={<Flag className="w-4 h-4" />} label="Priority" value={project.priority} color={project.priority === 'high' ? 'text-error-600' : 'text-ink-600 dark:text-ink-300'} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Tasks" value={`${tasks.filter(t => t.status === 'approved').length}/${tasks.length} done`} color="text-ink-600 dark:text-ink-300" />
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Deadline" value={project.deadline || 'N/A'} color="text-ink-600 dark:text-ink-300" />
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Photos" value={project.photos?.toString() || 'N/A'} color="text-ink-600 dark:text-ink-300" />
            </div>
          </Card>

          {project.editor_name && !isCustomer && (
            <Card className="animate-slide-up">
              <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-primary-500" /> Assigned Editor</h3>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                  {project.editor_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{project.editor_name}</p>
                  <p className="text-xs text-ink-400 dark:text-ink-500">Editor</p>
                </div>
                <Star className="w-3.5 h-3.5 text-warning-400 ml-auto fill-warning-400" />
              </div>
            </Card>
          )}

          <Card className="animate-slide-up">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><History className="w-4 h-4 text-primary-500" /> Process Timeline</h3>
            <VerticalTimeline items={tasks.map((t, i) => ({
              title: t.task_name,
              description: t.status === 'approved' ? 'Completed' : t.status === 'in-progress' ? 'Working' : t.status === 'partial-completed' ? 'Partially completed' : t.status === 'fully-completed' ? 'Fully completed' : t.status === 'submitted' ? 'Awaiting approval' : t.status === 'assigned' ? 'Assigned' : 'Unassigned',
              status: t.status === 'approved' ? 'completed' : t.status === 'in-progress' || t.status === 'submitted' || t.status === 'partial-completed' || t.status === 'fully-completed' || t.status === 'assigned' ? 'current' : 'pending',
              icon: <span className="text-xs font-bold">{i + 1}</span>,
            }))} />
          </Card>
        </div>
      </div>

      {/* Approve Project Modal */}
      <Modal open={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectReason(''); }} title="Reject Project" size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
            <p className="font-semibold text-ink-800 dark:text-ink-100">{project.event_name}</p>
            <p className="text-xs text-ink-400 mt-1">{project.order_number} · {project.category}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Rejection Reason *</label>
            <textarea className="input" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why the project is being rejected. The customer will see this and can edit and resubmit." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={handleRejectProject} disabled={rejecting || !rejectReason.trim()}>{rejecting ? 'Rejecting...' : 'Reject Project'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditProjectModal} onClose={() => setShowEditProjectModal(false)} title={project.status === 'rejected' ? 'Edit & Resubmit Project' : 'Edit Project Details'} size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          {project.status === 'rejected' && project.rejected_reason && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">
              <p className="font-semibold mb-1">Rejection reason:</p>
              <p>{project.rejected_reason}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Event Name</label>
            <input className="input" value={editProjectForm.event_name} onChange={(e) => setEditProjectForm({ ...editProjectForm, event_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Theme</label>
              <input className="input" value={editProjectForm.theme} onChange={(e) => setEditProjectForm({ ...editProjectForm, theme: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Deadline</label>
              <input type="date" className="input" value={editProjectForm.deadline} onChange={(e) => setEditProjectForm({ ...editProjectForm, deadline: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Duration</label>
              <input className="input" value={editProjectForm.duration} onChange={(e) => setEditProjectForm({ ...editProjectForm, duration: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Album Size</label>
              <input className="input" value={editProjectForm.album_size} onChange={(e) => setEditProjectForm({ ...editProjectForm, album_size: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Editing Style</label>
              <input className="input" value={editProjectForm.editing_style} onChange={(e) => setEditProjectForm({ ...editProjectForm, editing_style: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Layout Design</label>
              <input className="input" value={editProjectForm.layout_design} onChange={(e) => setEditProjectForm({ ...editProjectForm, layout_design: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Number of Photos</label>
              <input type="number" className="input" value={editProjectForm.photos} onChange={(e) => setEditProjectForm({ ...editProjectForm, photos: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Notes</label>
            <textarea className="input" rows={3} value={editProjectForm.notes} onChange={(e) => setEditProjectForm({ ...editProjectForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowEditProjectModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveEditProject} disabled={savingEditProject}>{savingEditProject ? 'Saving...' : project.status === 'rejected' ? 'Save & Resubmit' : 'Save Changes'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Project" size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
            <p className="font-semibold text-ink-800 dark:text-ink-100">{project.event_name}</p>
            <p className="text-xs text-ink-400 mt-1">{project.order_number} · {project.category}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Deadline</label>
            <input type="date" className="input" value={approveDeadline} onChange={(e) => setApproveDeadline(e.target.value)} />
            <p className="text-xs text-ink-400 mt-1.5">Set or adjust the delivery deadline. {project.deadline && <span>Current: {new Date(project.deadline).toLocaleDateString()}.</span>}</p>
            {project.customer_deadline && (
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Customer requested: {new Date(project.customer_deadline).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Download Link(s)</label>
            <textarea className="input placeholder:text-ink-400/50" rows={3} value={downloadLinks} onChange={(e) => setDownloadLinks(e.target.value)} placeholder="Paste links for editors to download source files. One link per line." />
            <p className="text-xs text-ink-400 mt-1.5">These links will be available to editors on the first-stage task.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Upload Link(s) *</label>
            <textarea className="input placeholder:text-ink-400/50" rows={3} value={uploadLinks} onChange={(e) => setUploadLinks(e.target.value)} placeholder="Paste Google Drive / Dropbox links for raw files. One link per line." />
            <p className="text-xs text-ink-400 mt-1.5">These links will be saved to the project and shared with the assigned editor.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleApproveProject} disabled={approving || !uploadLinks.trim()}>{approving ? 'Approving...' : 'Approve & Save Links'}</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Editor Modal */}
      <Modal open={showAssignEditor} onClose={() => { setShowAssignEditor(false); setAssignTemplateGroup(''); }} title="Assign Editor" size="md">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
            <p className="font-semibold text-ink-800 dark:text-ink-100">{project.event_name}</p>
            <p className="text-xs text-ink-400 mt-1">{project.order_number} · {project.category}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Select Editor</label>
            <select className="input" value={assignEditorName} onChange={(e) => setAssignEditorName(e.target.value)}>
              <option value="">Choose an editor...</option>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name} ({e.skills.join(', ')})</option>)}
            </select>
          </div>
          {tasks.length === 0 && Object.keys(templateGroups).length > 0 && (
            <div className="space-y-2 animate-slide-up">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Add Tasks from Template</label>
              <select
                className="input"
                value={assignTemplateGroup}
                onChange={(e) => setAssignTemplateGroup(e.target.value)}
              >
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
          {tasks.length === 0 && Object.keys(templateGroups).length === 0 && (
            <p className="text-xs text-ink-400">No task templates found. You can add tasks manually after assigning.</p>
          )}
          {tasks.length > 0 && (
            <p className="text-sm text-ink-600 dark:text-ink-300">This project already has {tasks.length} task{tasks.length !== 1 ? 's' : ''}. The first unassigned task will be assigned to this editor.</p>
          )}
          <p className="text-sm text-ink-600 dark:text-ink-300">Assigning an editor will set the project to "Assigned" status and notify the editor.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowAssignEditor(false); setAssignTemplateGroup(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Users className="w-3.5 h-3.5" />} onClick={handleAssignEditor} disabled={!assignEditorName || (tasks.length === 0 && Object.keys(templateGroups).length > 0 && !assignTemplateGroup)}>Assign & Notify</Button>
          </div>
        </div>
      </Modal>

      {/* Add Task Modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title={templateMode ? 'Add Tasks from Template' : groupMode ? 'Create Task Group' : 'Create New Task'} size="md">
        <div className="space-y-4">
          {/* Template mode toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-700">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Use a task template group</span>
            </div>
            <button
              type="button"
              onClick={() => { setTemplateMode(!templateMode); if (!templateMode) { setGroupMode(false); } }}
              className={`relative w-11 h-6 rounded-full transition-colors ${templateMode ? 'bg-primary-500' : 'bg-ink-200 dark:bg-ink-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${templateMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Template mode: select a group and preview its stages */}
          {templateMode ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Select Template Group</label>
                <select
                  className="input"
                  value={selectedTemplateGroup}
                  onChange={(e) => setSelectedTemplateGroup(e.target.value)}
                >
                  <option value="">Choose a group...</option>
                  {Object.keys(templateGroups).map((g) => (
                    <option key={g} value={g}>{g} ({templateGroups[g].length} stages)</option>
                  ))}
                </select>
              </div>
              {selectedTemplateGroup && templateGroups[selectedTemplateGroup] && (
                <div className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30">
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Stages to be created:</p>
                  <div className="space-y-1.5">
                    {templateGroups[selectedTemplateGroup].map((t, i) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="text-ink-700 dark:text-ink-200 font-medium">{t.task}</span>
                        {t.description && <span className="text-xs text-ink-400 truncate">— {t.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Assign All To</label>
                  <select className="input" value={newTask.assignedTo} onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}>
                    <option value="">Unassigned</option>
                    {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Group mode toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-700">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Group multiple tasks together</span>
            </div>
            <button
              type="button"
              onClick={() => { setGroupMode(!groupMode); setGroupTasks(['']); }}
              className={`relative w-11 h-6 rounded-full transition-colors ${groupMode ? 'bg-primary-500' : 'bg-ink-200 dark:bg-ink-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${groupMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Group name */}
          {(groupMode || newTask.groupName) && (
            <div className="animate-slide-up">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Group Name</label>
              <input
                className="input"
                value={newTask.groupName}
                onChange={(e) => setNewTask({ ...newTask, groupName: e.target.value })}
                placeholder="e.g. Pre-Wedding Editing"
                list="existing-groups"
              />
              <datalist id="existing-groups">
                {existingGroups.map((g) => <option key={g} value={g} />)}
              </datalist>
              {existingGroups.length > 0 && (
                <p className="text-xs text-ink-400 mt-1">Existing groups: {existingGroups.join(', ')}</p>
              )}
            </div>
          )}

          {/* Group mode: multiple task names */}
          {groupMode ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 block">Task Names</label>
              {groupTasks.map((tname, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={tname}
                    onChange={(e) => setGroupTasks(groupTasks.map((t, idx) => idx === i ? e.target.value : t))}
                    placeholder={`Task ${i + 1} name`}
                  />
                  {groupTasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setGroupTasks(groupTasks.filter((_, idx) => idx !== i))}
                      className="p-2 rounded-lg text-ink-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setGroupTasks([...groupTasks, ''])}
                className="text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add another task
              </button>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Shared Description</label>
                <textarea className="input" rows={2} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Applies to all tasks in this group" />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Task Name</label>
                <input className="input" value={newTask.taskName} onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })} placeholder="e.g. Color Correction" />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Description</label>
                <textarea className="input" rows={2} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
              </div>
            </>
          )}

          {/* Shared fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Stage</label>
              <input className="input" value={newTask.stage} onChange={(e) => setNewTask({ ...newTask, stage: e.target.value })} placeholder="e.g. Editing" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Assign To</label>
              <select className="input" value={newTask.assignedTo} onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Estimated Hours</label>
              <input type="number" className="input" value={newTask.estimatedHours} onChange={(e) => setNewTask({ ...newTask, estimatedHours: parseInt(e.target.value) || 8 })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Priority</label>
              <select className="input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          </>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddTask(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddTask} disabled={templateMode && !selectedTemplateGroup}>
              {templateMode ? `Create ${selectedTemplateGroup ? templateGroups[selectedTemplateGroup]?.length || 0 : 0} Tasks` : groupMode ? `Create ${groupTasks.filter((t) => t.trim()).length || ''} Tasks` : 'Create Task'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Task Modal */}
      <Modal open={showApproveTaskModal} onClose={() => { setShowApproveTaskModal(false); setApprovingTask(null); setApproveTaskDownloadLinks(''); setApproveTaskUploadLinks(''); setReviewLinkUrl(''); setReviewFileName(''); setFinalTaskFile(null); setFinalTaskUploadProgress(null); setReviewInputMode('file'); }} title={isFinalTask ? 'Approve Final Task & Upload Review File' : 'Approve Task & Pass Links'} size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          {approvingTask && (
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Approving Task</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{approvingTask.task_name}</p>
              <p className="text-xs text-ink-400 mt-1">Stage {approvingTask.sequence} · {approvingTask.stage || 'No stage'}</p>
            </div>
          )}
          {isFinalTask ? (
            <>
              <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20">
                <p className="text-xs text-primary-700 dark:text-primary-400">This is the final stage. Add a review file for the customer. The project will be set to "Review" status upon approval.</p>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
                <button onClick={() => setReviewInputMode('file')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${reviewInputMode === 'file' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Upload File</button>
                <button onClick={() => setReviewInputMode('link')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${reviewInputMode === 'link' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Paste Video Link</button>
              </div>
              {reviewInputMode === 'link' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Video URL (YouTube, Drive, or direct link)</label>
                    <input className="input" value={reviewLinkUrl} onChange={(e) => { setReviewLinkUrl(e.target.value); setReviewFileType(detectFileTypeFromUrl(e.target.value)); }} placeholder="https://www.youtube.com/watch?v=..." />
                    <p className="text-xs text-ink-400 mt-1">Paste a YouTube or video link. The customer will see it in the review player.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Label (optional)</label>
                    <input className="input" value={reviewFileName} onChange={(e) => setReviewFileName(e.target.value)} placeholder="Version 1" />
                  </div>
                </div>
              ) : (
                <>
                  <input ref={finalTaskFileInputRef} type="file" accept="video/*,application/pdf,image/*" onChange={handleFinalTaskFileSelect} className="hidden" />
                  {!finalTaskFile ? (
                    <button onClick={() => finalTaskFileInputRef.current?.click()} className="w-full p-8 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors flex flex-col items-center gap-2 text-ink-400 dark:text-ink-500">
                      <Upload className="w-10 h-10" />
                      <p className="text-sm font-medium">Click to select a file</p>
                      <p className="text-xs">Video, PDF, or image · Max 100MB</p>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 space-y-3">
                      <div className="flex items-center gap-3">
                        {reviewFileType === 'video' ? <Film className="w-8 h-8 text-primary-500" /> : <ImageIcon className="w-8 h-8 text-success-500" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{finalTaskFile.name}</p>
                          <p className="text-xs text-ink-400">{formatBytes(finalTaskFile.size)} · {reviewFileType.toUpperCase()}</p>
                        </div>
                        <button onClick={() => { setFinalTaskFile(null); setFinalTaskUploadProgress(null); }} className="w-8 h-8 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/15 flex items-center justify-center text-ink-400 hover:text-error-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {finalTaskUploadProgress !== null && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">Uploading...</span>
                            <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">{finalTaskUploadProgress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-700 overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${finalTaskUploadProgress}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Upload Link(s) for Editors</label>
                {(() => {
                  const prevTask = tasks.find((t) => t.sequence === (approvingTask?.sequence || 0) - 1);
                  const prevUploadLinks = prevTask?.upload_links || approvingTask?.upload_links || project.upload_links;
                  return prevUploadLinks ? (
                    <div className="flex items-center gap-2 mb-2">
                      <label className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autofillUpload}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAutofillUpload(checked);
                            if (checked && prevUploadLinks) {
                              setApproveTaskUploadLinks(prevUploadLinks);
                            }
                          }}
                          className="w-4 h-4 rounded border-ink-300 dark:border-ink-600 text-primary-500 focus:ring-primary-500 cursor-pointer"
                        />
                        Autofill from {prevTask ? `previous stage (${prevTask.task_name})` : 'project upload links'}
                      </label>
                    </div>
                  ) : null;
                })()}
                <textarea className="input" rows={3} value={approveTaskUploadLinks} onChange={(e) => { setApproveTaskUploadLinks(e.target.value); setAutofillUpload(false); }} placeholder="Paste links where editors should upload corrected files after resolving corrections. One link per line." />
                <p className="text-xs text-ink-400 mt-1">Shown to editors on the review page so they know where to upload corrected files after resolving customer corrections.</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-500 dark:text-ink-400">These links will become the Download and Upload links for the next stage: <span className="font-semibold text-ink-700 dark:text-ink-200">{tasks.find((t) => t.sequence === (approvingTask?.sequence || 0) + 1)?.task_name}</span></p>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Download Link(s)</label>
                <textarea className="input" rows={3} value={approveTaskDownloadLinks} onChange={(e) => setApproveTaskDownloadLinks(e.target.value)} placeholder="Paste links for the next editor to download. One link per line." />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Upload Link(s) *</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autofillUpload}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutofillUpload(checked);
                        if (checked && approvingTask?.upload_links) {
                          setApproveTaskUploadLinks(approvingTask.upload_links);
                        }
                      }}
                      className="w-4 h-4 rounded border-ink-300 dark:border-ink-600 text-primary-500 focus:ring-primary-500 cursor-pointer"
                    />
                    Autofill upload links from current task
                  </label>
                </div>
                <textarea className="input" rows={3} value={approveTaskUploadLinks} onChange={(e) => { setApproveTaskUploadLinks(e.target.value); setAutofillUpload(false); }} placeholder="Paste links for the next editor to upload their work. One link per line." />
              </div>
            </>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowApproveTaskModal(false); setApprovingTask(null); setApproveTaskDownloadLinks(''); setApproveTaskUploadLinks(''); setReviewLinkUrl(''); setReviewFileName(''); setFinalTaskFile(null); setFinalTaskUploadProgress(null); setReviewInputMode('file'); }}>Cancel</Button>
            <Button variant="success" size="sm" icon={finalTaskUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} onClick={handleApproveTask} disabled={approvingTaskId !== null || (isFinalTask ? (reviewInputMode === 'file' ? !finalTaskFile : !reviewLinkUrl.trim()) : !approveTaskUploadLinks.trim())}>{approvingTaskId !== null ? 'Approving...' : isFinalTask ? 'Approve & Send for Review' : 'Approve & Pass Links'}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Task Modal */}
      <Modal open={showEditTask} onClose={() => { setShowEditTask(false); setEditingTask(null); setEditAssignTo(''); }} title="Edit Task Assignment" size="md">
        <div className="space-y-4">
          {editingTask && (
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{editingTask.task_name}</p>
              <p className="text-xs text-ink-400 mt-0.5">Stage {editingTask.sequence} · {editingTask.stage || 'No stage'}</p>
            </div>
          )}
          {editingTask && tasks.findIndex((t) => t.id === editingTask.id) > 0 && tasks.slice(0, tasks.findIndex((t) => t.id === editingTask.id)).some((t) => t.status !== 'approved') && (
            <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 flex items-center gap-2 text-sm text-warning-700 dark:text-warning-400">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>This stage stays locked until the previous stage is approved. Admins can still update the assignment.</span>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Assign To</label>
            <select className="input" value={editAssignTo} onChange={(e) => setEditAssignTo(e.target.value)}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowEditTask(false); setEditingTask(null); setEditAssignTo(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" />} onClick={handleEditTask}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Task Links Modal */}
      <Modal open={showEditTaskLinks} onClose={() => { setShowEditTaskLinks(false); setEditingTask(null); setEditDownloadLinks(''); setEditUploadLinks(''); }} title="Stage Download & Upload Links" size="md">
        <div className="space-y-4">
          {editingTask && (
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{editingTask.task_name}</p>
              <p className="text-xs text-ink-400 mt-0.5">Stage {editingTask.sequence}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Download Links (JSON)</label>
            <textarea className="input" rows={3} value={editDownloadLinks} onChange={(e) => setEditDownloadLinks(e.target.value)} placeholder='[{"url":"https://...","description":"Source files"}]' />
            <p className="text-xs text-ink-400 mt-1">Links the editor downloads to work on this stage.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Upload Links (JSON)</label>
            <textarea className="input" rows={3} value={editUploadLinks} onChange={(e) => setEditUploadLinks(e.target.value)} placeholder='[{"url":"https://...","description":"Upload completed work"}]' />
            <p className="text-xs text-ink-400 mt-1">Where the editor uploads completed work. Reflects in editor's upload section.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowEditTaskLinks(false); setEditingTask(null); setEditDownloadLinks(''); setEditUploadLinks(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" />} onClick={handleEditTaskLinks}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Close Project Modal */}
      <Modal open={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Project" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
            <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Confirm Project Closure</p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                This will permanently close the project. The customer will no longer be able to submit corrections. Please verify all conditions below before proceeding.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30">
              <Check className="w-4 h-4 text-success-500 flex-shrink-0" />
              <span className="text-sm text-success-700 dark:text-success-300">Corrections approved by customer</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30">
              <Check className="w-4 h-4 text-success-500 flex-shrink-0" />
              <span className="text-sm text-success-700 dark:text-success-300">Payment fully received — ₹{getTotalPaid().toLocaleString()} / ₹{getInvoiceAmount().toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Final Output Link</label>
            <input className="input" value={closeOutputLink} onChange={(e) => setCloseOutputLink(e.target.value)} placeholder="https://drive.google.com/..." />
            <p className="text-xs text-ink-400 mt-1">The customer will see an "Output" button on their My Orders page.</p>
          </div>
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCloseModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} disabled={closing || !closeOutputLink.trim()} onClick={handleCloseProject}>{closing ? 'Closing...' : 'Close Project'}</Button>
          </div>
        </div>
      </Modal>

      {/* Upload Review File Modal */}
      <Modal open={showOutputModal} onClose={() => setShowOutputModal(false)} title="Upload Final Output Link" size="md">
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">Paste the download link for the final delivered project files. The customer will see an "Output" button on their My Orders page once this is set.</p>
          <input className="input" value={outputLink} onChange={(e) => setOutputLink(e.target.value)} placeholder="https://drive.google.com/..." />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowOutputModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<Check className="w-3.5 h-3.5" />} disabled={!outputLink.trim()} onClick={async () => {
              await db.updateProject(project.id, { output_link: outputLink.trim() });
              setProject({ ...project, output_link: outputLink.trim() });
              setShowOutputModal(false);
            }}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showUploadReview} onClose={() => { setShowUploadReview(false); setSelectedFile(null); setUploadProgress(null); setActionError(null); setReviewInputMode('file'); setReviewLinkUrl(''); setReviewFileName(''); }} title="Upload Review File" size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
            <button onClick={() => setReviewInputMode('file')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${reviewInputMode === 'file' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Upload File</button>
            <button onClick={() => setReviewInputMode('link')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${reviewInputMode === 'link' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Paste Video Link</button>
          </div>
          {reviewInputMode === 'link' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Video URL (YouTube, Drive, or direct link)</label>
                <input className="input" value={reviewLinkUrl} onChange={(e) => { setReviewLinkUrl(e.target.value); setReviewFileType(detectFileTypeFromUrl(e.target.value)); }} placeholder="https://www.youtube.com/watch?v=..." />
                <p className="text-xs text-ink-400 mt-1">Paste a YouTube or video link. The customer will see it in the review player.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Label (optional)</label>
                <input className="input" value={reviewFileName} onChange={(e) => setReviewFileName(e.target.value)} placeholder="Version 1" />
              </div>
            </div>
          ) : (
            <>
              <input ref={fileInputRef} type="file" accept="video/*,application/pdf,image/*" onChange={handleFileSelect} className="hidden" />
              {!selectedFile ? (
                <button onClick={() => fileInputRef.current?.click()} className="w-full p-8 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors flex flex-col items-center gap-2 text-ink-400 dark:text-ink-500">
                  <Upload className="w-10 h-10" />
                  <p className="text-sm font-medium">Click to select a file</p>
                  <p className="text-xs">Video, PDF, or image · Max 100MB</p>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 space-y-3">
                  <div className="flex items-center gap-3">
                    {reviewFileType === 'video' ? <Film className="w-8 h-8 text-primary-500" /> : <ImageIcon className="w-8 h-8 text-success-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-ink-400">{formatBytes(selectedFile.size)} · {reviewFileType.toUpperCase()}</p>
                    </div>
                    <button onClick={() => { setSelectedFile(null); setUploadProgress(null); }} className="w-8 h-8 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/15 flex items-center justify-center text-ink-400 hover:text-error-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {uploadProgress !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">Uploading...</span>
                        <span className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-700 overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <p className="text-xs text-ink-400">This will set the project to {reviewFiles.length === 0 ? '"review"' : '"correction"'} status and notify the customer.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowUploadReview(false); setSelectedFile(null); setUploadProgress(null); setActionError(null); setReviewInputMode('file'); setReviewLinkUrl(''); setReviewFileName(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} onClick={handleUploadReviewFile} disabled={uploading || (reviewInputMode === 'file' ? !selectedFile : !reviewLinkUrl.trim())}>{uploading ? 'Saving...' : 'Save & Notify Customer'}</Button>
          </div>
        </div>
      </Modal>

      <ShareLinkModal open={showShareModal} project={project} onClose={() => setShowShareModal(false)} onProjectUpdated={setProject} />

      {/* Revoke / Reassign Task Modal */}
      <Modal open={showRevokeModal} onClose={() => { setShowRevokeModal(false); setRevokingTask(null); setRevokeReason(''); setRevokeAssignTo(''); setActionError(null); }} title={revokingTask?.status === 'pending' && !revokingTask?.assigned_to ? 'Assign Task to Editor' : 'Revoke & Reassign Task'} size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          {revokingTask && (
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Task</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{revokingTask.task_name}</p>
              <p className="text-xs text-ink-400 mt-1">Current editor: {revokingTask.assigned_to_name || 'Unassigned'} · Status: {revokingTask.status}</p>
            </div>
          )}
          {revokingTask && revokingTask.assigned_to && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
              <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                This will reset the task — clearing the current editor, submitted files, and approval records. The task will either become unassigned (available for any editor to pick up) or be assigned to a specific editor.
              </p>
            </div>
          )}
          {revokingTask && revokingTask.assigned_to && (
            <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
              <button onClick={() => setRevokeMode('unassigned')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${revokeMode === 'unassigned' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Make Unassigned</button>
              <button onClick={() => setRevokeMode('reassign')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${revokeMode === 'reassign' ? 'bg-white dark:bg-ink-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Assign to Editor</button>
            </div>
          )}
          {revokeMode === 'reassign' && (
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Select Editor *</label>
              <select className="input" value={revokeAssignTo} onChange={(e) => setRevokeAssignTo(e.target.value)}>
                <option value="">Choose an editor...</option>
                {employees.filter((e) => e.status === 'active').map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Reason (optional)</label>
            <textarea className="input" rows={2} placeholder="e.g. No response from editor, reassigning due to inactivity..." value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowRevokeModal(false); setRevokingTask(null); setRevokeReason(''); setRevokeAssignTo(''); setActionError(null); }}>Cancel</Button>
            <Button variant={revokingTask?.status === 'pending' && !revokingTask?.assigned_to ? 'primary' : 'danger'} size="sm" icon={revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />} onClick={handleRevokeTask} disabled={revoking || (revokeMode === 'reassign' && !revokeAssignTo.trim())}>{revoking ? 'Processing...' : revokingTask?.status === 'pending' && !revokingTask?.assigned_to ? 'Assign Task' : 'Revoke Task'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add Payment Modal */}
      <Modal open={showAddPaymentModal} onClose={() => setShowAddPaymentModal(false)} title="Add Payment" size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                <p className="font-semibold text-ink-800 dark:text-ink-100">{project?.event_name}</p>
                <p className="text-xs text-ink-400 mt-1">{project?.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-400">Invoice: ₹{getInvoiceAmount().toLocaleString()}</p>
                <p className="text-xs text-ink-400">Paid: ₹{getTotalPaid().toLocaleString()}</p>
                <p className="text-xs font-semibold text-error-600">Balance: ₹{getBalance().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Amount (₹) *</label>
              <input type="number" className="input" placeholder="e.g. 20000" value={addPaymentForm.amount} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Date</label>
              <input type="date" className="input" value={addPaymentForm.paymentDate} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, paymentDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Method</label>
              <select className="input" value={addPaymentForm.paymentMethod} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, paymentMethod: e.target.value })}>
                <option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Type</label>
              <select className="input" value={addPaymentForm.paymentType} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, paymentType: e.target.value })}>
                <option>Advance</option><option>Partial</option><option>Final</option><option>Full</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Transaction / Reference Number</label>
            <input className="input" placeholder="e.g. UPI123456789" value={addPaymentForm.transactionRef} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, transactionRef: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Notes (optional)</label>
            <textarea className="input" rows={2} placeholder="Any notes about this payment..." value={addPaymentForm.notes} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAddPaymentModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddProjectPayment} disabled={!addPaymentForm.amount || financeSaving}>{financeSaving ? 'Adding...' : 'Add Payment'}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={showEditInvoiceModal} onClose={() => setShowEditInvoiceModal(false)} title="Revise Invoice Amount" size="md">
        <div className="space-y-4">
          {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{actionError}</div>}
          {invoice && (
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-500 dark:text-ink-400">Invoice #{invoice.invoice_number}</p>
                  <p className="text-xs text-ink-400">Original: ₹{invoice.original_amount.toLocaleString()}</p>
                  <p className="text-xs text-ink-400">Current: ₹{invoice.current_amount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Total Paid (preserved)</p>
                  <p className="text-sm font-bold text-success-600">₹{getTotalPaid().toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Invoice Amount (₹) *</label>
            <input type="number" className="input" placeholder="e.g. 60000" value={editInvoiceForm.amount} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, amount: e.target.value })} />
            {editInvoiceForm.amount && (
              <p className="text-xs text-error-600 mt-1">New balance will be: ₹{(parseFloat(editInvoiceForm.amount) - getTotalPaid()).toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Reason for Change *</label>
            <input className="input" placeholder="e.g. Additional work requested" value={editInvoiceForm.reason} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, reason: e.target.value })} />
          </div>
          <p className="text-sm text-warning-600 dark:text-warning-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Changing the invoice amount does NOT affect existing payments. The previous amount is saved in revision history.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowEditInvoiceModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={handleEditInvoiceAmount} disabled={!editInvoiceForm.amount || !editInvoiceForm.reason.trim() || financeSaving}>{financeSaving ? 'Saving...' : 'Revise Invoice'}</Button>
          </div>
        </div>
      </Modal>

      {/* Finance History Modal */}
      <Modal open={showFinanceHistory} onClose={() => setShowFinanceHistory(false)} title="Invoice & Payment History" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
              <p className="text-xs text-ink-400">Invoice Total</p>
              <p className="text-lg font-bold text-ink-700 dark:text-ink-200">₹{getInvoiceAmount().toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-center">
              <p className="text-xs text-success-600">Total Paid</p>
              <p className="text-lg font-bold text-success-600 dark:text-success-400">₹{getTotalPaid().toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-center">
              <p className="text-xs text-error-600">Balance</p>
              <p className="text-lg font-bold text-error-600 dark:text-error-400">₹{getBalance().toLocaleString()}</p>
            </div>
          </div>
          {invoice && (
            <div>
              <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Invoice Details</h4>
              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-ink-400">Invoice Number</span><span className="font-medium text-ink-700 dark:text-ink-200">{invoice.invoice_number || '—'}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">Original Amount</span><span className="font-medium text-ink-700 dark:text-ink-200">₹{invoice.original_amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">Current Amount</span><span className="font-medium text-ink-700 dark:text-ink-200">₹{invoice.current_amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">Created Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(invoice.invoice_date).toLocaleDateString()}</span></div>
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Invoice Revisions ({invoiceRevisions.length})</h4>
            {invoiceRevisions.length === 0 ? (
              <p className="text-sm text-ink-400 py-3">No revisions — the invoice amount has not been changed.</p>
            ) : (
              <div className="space-y-2">
                {invoiceRevisions.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-ink-700 dark:text-ink-200">₹{rev.previous_amount.toLocaleString()} → ₹{rev.new_amount.toLocaleString()}</span>
                      <span className="text-xs text-ink-400">{new Date(rev.changed_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-ink-500 dark:text-ink-400">Reason: {rev.reason || 'Not specified'}</p>
                    <p className="text-xs text-ink-400">Changed by: {rev.changed_by || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Payment History ({projectPayments.length})</h4>
            {projectPayments.length === 0 ? (
              <p className="text-sm text-ink-400 py-3">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {projectPayments.map((pp) => (
                  <div key={pp.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-success-600 dark:text-success-400">₹{pp.amount.toLocaleString()}</span>
                      <span className="text-xs text-ink-400">{new Date(pp.payment_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                      <span>{pp.payment_type}</span>
                      <span>· {pp.payment_method}</span>
                      {pp.transaction_reference && <span>· Ref: {pp.transaction_reference}</span>}
                    </div>
                    {pp.notes && <p className="text-xs text-ink-400 mt-1">{pp.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={showProjectSplitModal} onClose={() => setShowProjectSplitModal(false)} title="Split Project into Sub-Orders" size="lg">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20">
            <p className="text-xs text-primary-700 dark:text-primary-300">
              This will create sub-projects with order numbers like {project.order_number}A, {project.order_number}B, etc. Each sub-project is a separate project that can be assigned and tracked independently. You can customize all details for each split below — photos, category, amount, and more.
            </p>
          </div>
          <div className="max-h-[55vh] overflow-y-auto space-y-3">
            {projectSplitLabels.map((label, i) => (
              <div key={i} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{project.order_number}</span>
                  <input type="text" className="input flex-1" placeholder="A" value={label} onChange={(e) => { const l = [...projectSplitLabels]; l[i] = e.target.value; setProjectSplitLabels(l); }} style={{ maxWidth: '60px' }} />
                  <span className="text-sm text-ink-400 flex-1">Sub-order label</span>
                  {projectSplitLabels.length > 2 && (
                    <button onClick={() => {
                      setProjectSplitLabels(l => l.filter((_, idx) => idx !== i));
                      setProjectSplitNames(n => n.filter((_, idx) => idx !== i));
                      setProjectSplitAmounts(a => a.filter((_, idx) => idx !== i));
                      setProjectSplitPhotos(p => p.filter((_, idx) => idx !== i));
                      setProjectSplitCategories(c => c.filter((_, idx) => idx !== i));
                      setProjectSplitSubcategories(s => s.filter((_, idx) => idx !== i));
                      setProjectSplitPriorities(p => p.filter((_, idx) => idx !== i));
                      setProjectSplitDeadlines(d => d.filter((_, idx) => idx !== i));
                      setProjectSplitAlbumSizes(a => a.filter((_, idx) => idx !== i));
                      setProjectSplitDurations(d => d.filter((_, idx) => idx !== i));
                      setProjectSplitEditStyles(e => e.filter((_, idx) => idx !== i));
                      setProjectSplitLayoutDesigns(l => l.filter((_, idx) => idx !== i));
                      setProjectSplitThemes(t => t.filter((_, idx) => idx !== i));
                    }} className="text-ink-400 hover:text-error-500"><X className="w-4 h-4" /></button>
                  )}
                </div>
                <input type="text" className="input" placeholder={`Event name (defaults to ${project.event_name} (${label}))`} value={projectSplitNames[i]} onChange={(e) => { const n = [...projectSplitNames]; n[i] = e.target.value; setProjectSplitNames(n); }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">₹</span>
                    <input type="number" className="input pl-7" placeholder={`Amount (defaults to ${project.amount})`} value={projectSplitAmounts[i]} onChange={(e) => { const a = [...projectSplitAmounts]; a[i] = e.target.value; setProjectSplitAmounts(a); }} />
                  </div>
                  <input type="number" className="input" placeholder={`Photos (defaults to ${project.photos ?? 0})`} value={projectSplitPhotos[i]} onChange={(e) => { const p = [...projectSplitPhotos]; p[i] = e.target.value; setProjectSplitPhotos(p); }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className="input" value={projectSplitCategories[i]} onChange={(e) => { const c = [...projectSplitCategories]; c[i] = e.target.value; setProjectSplitCategories(c); }}>
                    <option value="">Category (default: {project.category})</option>
                    <option value="Photo">Photo</option>
                    <option value="Video">Video</option>
                    <option value="Album">Album</option>
                  </select>
                  <input type="text" className="input" placeholder={`Subcategory (defaults to ${project.subcategory || 'none'})`} value={projectSplitSubcategories[i]} onChange={(e) => { const s = [...projectSplitSubcategories]; s[i] = e.target.value; setProjectSplitSubcategories(s); }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className="input" value={projectSplitPriorities[i]} onChange={(e) => { const p = [...projectSplitPriorities]; p[i] = e.target.value; setProjectSplitPriorities(p); }}>
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <input type="date" className="input" placeholder="Deadline" value={projectSplitDeadlines[i]} onChange={(e) => { const d = [...projectSplitDeadlines]; d[i] = e.target.value; setProjectSplitDeadlines(d); }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" className="input" placeholder={`Album size (defaults to ${project.album_size || 'none'})`} value={projectSplitAlbumSizes[i]} onChange={(e) => { const a = [...projectSplitAlbumSizes]; a[i] = e.target.value; setProjectSplitAlbumSizes(a); }} />
                  <input type="text" className="input" placeholder={`Duration (defaults to ${project.duration || 'none'})`} value={projectSplitDurations[i]} onChange={(e) => { const d = [...projectSplitDurations]; d[i] = e.target.value; setProjectSplitDurations(d); }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" className="input" placeholder={`Editing style (defaults to ${project.editing_style || 'none'})`} value={projectSplitEditStyles[i]} onChange={(e) => { const e2 = [...projectSplitEditStyles]; e2[i] = e.target.value; setProjectSplitEditStyles(e2); }} />
                  <input type="text" className="input" placeholder={`Layout design (defaults to ${project.layout_design || 'none'})`} value={projectSplitLayoutDesigns[i]} onChange={(e) => { const l = [...projectSplitLayoutDesigns]; l[i] = e.target.value; setProjectSplitLayoutDesigns(l); }} />
                </div>
                <input type="text" className="input" placeholder={`Theme (defaults to ${project.theme || 'none'})`} value={projectSplitThemes[i]} onChange={(e) => { const t = [...projectSplitThemes]; t[i] = e.target.value; setProjectSplitThemes(t); }} />
              </div>
            ))}
          </div>
          <button onClick={() => {
            const next = String.fromCharCode(65 + projectSplitLabels.length);
            setProjectSplitLabels([...projectSplitLabels, next]);
            setProjectSplitNames([...projectSplitNames, '']);
            setProjectSplitAmounts([...projectSplitAmounts, '']);
            setProjectSplitPhotos([...projectSplitPhotos, '']);
            setProjectSplitCategories([...projectSplitCategories, '']);
            setProjectSplitSubcategories([...projectSplitSubcategories, '']);
            setProjectSplitPriorities([...projectSplitPriorities, 'medium']);
            setProjectSplitDeadlines([...projectSplitDeadlines, '']);
            setProjectSplitAlbumSizes([...projectSplitAlbumSizes, '']);
            setProjectSplitDurations([...projectSplitDurations, '']);
            setProjectSplitEditStyles([...projectSplitEditStyles, '']);
            setProjectSplitLayoutDesigns([...projectSplitLayoutDesigns, '']);
            setProjectSplitThemes([...projectSplitThemes, '']);
          }} className="text-sm text-primary-600 hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add another split</button>
          {actionError && <p className="text-sm text-error-600">{actionError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowProjectSplitModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={splittingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SplitSquareHorizontal className="w-3.5 h-3.5" />} onClick={async () => {
              if (!project) return;
              setSplittingProject(true);
              setActionError(null);
              try {
                const splits = projectSplitLabels.map((label, i) => ({
                  label,
                  eventName: projectSplitNames[i] || undefined,
                  amount: projectSplitAmounts[i] ? parseFloat(projectSplitAmounts[i]) : undefined,
                  photos: projectSplitPhotos[i] ? parseInt(projectSplitPhotos[i], 10) : undefined,
                  category: projectSplitCategories[i] || undefined,
                  subcategory: projectSplitSubcategories[i] || undefined,
                  priority: projectSplitPriorities[i] || undefined,
                  deadline: projectSplitDeadlines[i] || undefined,
                  albumSize: projectSplitAlbumSizes[i] || undefined,
                  duration: projectSplitDurations[i] || undefined,
                  editingStyle: projectSplitEditStyles[i] || undefined,
                  layoutDesign: projectSplitLayoutDesigns[i] || undefined,
                  theme: projectSplitThemes[i] || undefined,
                }));
                await db.splitProject(project.id, splits);
                await db.createNotification({
                  type: 'project',
                  title: 'Project split into sub-orders',
                  description: `${project.event_name} (${project.order_number}) was split into ${splits.length} sub-projects: ${splits.map(s => project.order_number + s.label).join(', ')}.`,
                  target_role: 'admin',
                  read: false,
                  project_id: project.id,
                });
                setShowProjectSplitModal(false);
                onNavigate('projects');
              } catch (err) {
                setActionError(err instanceof Error ? err.message : 'Failed to split project');
              }
              setSplittingProject(false);
            }} disabled={splittingProject || projectSplitLabels.some(l => !l.trim())}>{splittingProject ? 'Splitting...' : 'Create Sub-Projects'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Create Estimate or Invoice" size="md">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
            <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
            <p className="font-semibold text-ink-800 dark:text-ink-100">{project?.event_name}</p>
            <p className="text-xs text-ink-400 mt-1">{project?.order_number} · Customer: {project?.customer_name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setInvoiceType('estimate')} className={`p-3 rounded-xl border-2 text-left transition-colors ${invoiceType === 'estimate' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/15' : 'border-ink-200 dark:border-ink-700'}`}>
                <FileText className="w-4 h-4 mb-1 text-primary-500" />
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Estimate</p>
                <p className="text-xs text-ink-400">Customer reviews & approves</p>
              </button>
              <button type="button" onClick={() => setInvoiceType('final')} className={`p-3 rounded-xl border-2 text-left transition-colors ${invoiceType === 'final' ? 'border-success-500 bg-success-50 dark:bg-success-500/15' : 'border-ink-200 dark:border-ink-700'}`}>
                <Receipt className="w-4 h-4 mb-1 text-success-500" />
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Final Invoice</p>
                <p className="text-xs text-ink-400">Direct bill for payment</p>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">{invoiceType === 'estimate' ? 'Estimated' : 'Invoice'} Amount (₹) *</label>
            <input type="number" className="input" placeholder="e.g. 15000" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          </div>
          {actionError && <p className="text-sm text-error-600">{actionError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" icon={invoiceType === 'estimate' ? <FileText className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />} onClick={handleCreateProjectInvoice} disabled={savingInvoice || !invoiceAmount}>{savingInvoice ? 'Creating...' : invoiceType === 'estimate' ? 'Create Estimate' : 'Create Invoice'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showSplitModal} onClose={() => setShowSplitModal(false)} title="Split Payment Among Editors" size="lg">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-success-700 dark:text-success-400">Total Customer Payment</span>
              <span className="text-2xl font-bold text-success-700 dark:text-success-400">₹{(payment?.amount || 0).toLocaleString()}</span>
            </div>
          </div>
          {(() => {
            const approvedTasks = tasks.filter((t) => t.status === 'approved' && t.assigned_to);
            const totalSplit = approvedTasks.reduce((sum, t) => sum + (parseFloat(splitAmounts[t.id] || '0') || 0), 0);
            const remaining = (payment?.amount || 0) - totalSplit;
            return (
              <>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {approvedTasks.length === 0 ? (
                    <p className="text-sm text-ink-400 text-center py-4">No approved tasks with assigned editors found.</p>
                  ) : approvedTasks.map((t) => {
                    const emp = employees.find((e) => e.id === t.assigned_to);
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{t.task_name}</p>
                          <p className="text-xs text-ink-400">Editor: {emp?.name || t.assigned_to_name || 'Unknown'}</p>
                        </div>
                        <div className="w-32">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">₹</span>
                            <input type="number" className="input pl-7" placeholder="0" value={splitAmounts[t.id] || ''} onChange={(e) => setSplitAmounts({ ...splitAmounts, [t.id]: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                  <span className="text-sm font-semibold text-ink-600 dark:text-ink-300">Total Allocated: ₹{totalSplit.toLocaleString()}</span>
                  <span className={`text-sm font-semibold ${remaining < 0 ? 'text-error-600' : 'text-success-600'}`}>{remaining < 0 ? 'Over by' : 'Remaining'}: ₹{Math.abs(remaining).toLocaleString()}</span>
                </div>
                {actionError && <p className="text-sm text-error-600">{actionError}</p>}
                <p className="text-sm text-ink-600 dark:text-ink-300">Each editor will see their allocated amount in their Earnings page. Customer information is hidden from editors.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowSplitModal(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" icon={<Receipt className="w-3.5 h-3.5" />} onClick={handleSaveSplits} disabled={savingSplits}>{savingSplits ? 'Saving...' : 'Save Splits'}</Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}

function CheckCircle2Icon() {
  return <Check className="w-4 h-4 text-success-500" />;
}

function HeaderInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-ink-400 dark:text-ink-500">{label}</span>
      <span className="font-semibold capitalize text-ink-700 dark:text-ink-200">{value}</span>
    </span>
  );
}

function HeaderDetail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink-50 dark:bg-ink-800/50 px-3 py-2.5">
      <p className="text-[11px] text-ink-400 dark:text-ink-500 mb-1 flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 truncate" title={value}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">{icon} {label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function DownloadLink({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 transition-colors">
      <div className="flex items-center gap-3">
        <Download className="w-5 h-5 text-primary-500" />
        <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{label}</span>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}>Download</Button>
      </a>
    </div>
  );
}
