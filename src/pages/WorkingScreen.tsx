import { useState } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Progress from '../components/ui/Progress';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { Download, Upload, FileText, Send, Clock, Calendar, CheckCircle2, Lock, AlertTriangle, Trash2, MessageSquare, X, ChevronDown, ChevronRight, Link as LinkIcon } from 'lucide-react';
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
    handleMarkPartialCompleted, handleMarkFullyCompleted,
  } = useActiveTask(params.id as string, params.taskId as string);

  const [update, setUpdate] = useState('');
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [fileUrl, setFileUrl