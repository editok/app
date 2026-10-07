import { useState, useEffect, useRef } from 'react';
import { Send, Lock, MessageSquare } from 'lucide-react';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { useMessages } from '../../hooks/useMessages';
import { useNotifications } from '../../contexts/NotificationContext';
import { markChatRead } from '../../utils/chatReadState';
import { createProjectMessage, fetchProject, emitNotification, sendStatusEmail, ProjectMessage } from '../../data/db';

interface ProjectChatProps {
  projectId: string;
  canUseInternal?: boolean;
  className?: string;
  compact?: boolean;
  workStarted?: boolean;
}

export default function ProjectChat({ projectId, canUseInternal = false, className = '', compact = false, workStarted = true }: ProjectChatProps) {
  const { user, role } = useAuth();
  const { messages, loading, addMessage } = useMessages(projectId);
  const { markProjectMessagesRead } = useNotifications();
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    markProjectMessagesRead(projectId);
    markChatRead(projectId);
  }, [projectId, markProjectMessagesRead]);

  useEffect(() => {
    if (messages.length === 0) return;
    markProjectMessagesRead(projectId);
    markChatRead(projectId);
  }, [messages, projectId, markProjectMessagesRead]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    setSending(true);
    setError(null);
    try {
      const createdMessage = await createProjectMessage(projectId, user.id, trimmed, isInternal);
      if (createdMessage) addMessage(createdMessage);
      setText('');
      setIsInternal(false);
      setSending(false);
      // Fire notifications/emails in the background — don't block the UI
      (async () => {
        try {
          const project = await fetchProject(projectId);
          if (!project) return;
          const snippet = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
          const senderLabel = role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Customer';
          const messageKey = createdMessage?.id || `${projectId}-${Date.now()}`;
          if (role !== 'customer' && project.customer_email && !isInternal) {
            emitNotification({
              eventKey: `chat:${projectId}:${messageKey}:customer`,
              category: 'chat',
              type: 'message',
              title: `New message from ${senderLabel}`,
              description: `${snippet} — in project ${project.order_number}`,
              targetRole: 'customer',
              targetEmail: project.customer_email,
              projectId: project.id,
              metadata: { message_id: createdMessage?.id },
            });
            sendStatusEmail({
              templateName: 'new_message',
              recipient: project.customer_email,
              recipientName: project.customer_name,
              variables: {
                customer_name: project.customer_name || 'there',
                project_name: project.event_name || '',
                order_number: project.order_number || '',
                sender_name: senderLabel,
                message_preview: snippet,
              },
            });
          }
          if (role !== 'editor' && project.editor_email && workStarted) {
            emitNotification({
              eventKey: `chat:${projectId}:${messageKey}:editor`,
              category: 'chat',
              type: 'message',
              title: `New message from ${senderLabel}`,
              description: `${snippet} — in project ${project.order_number}`,
              targetRole: 'editor',
              targetEmail: project.editor_email,
              projectId: project.id,
              metadata: { message_id: createdMessage?.id },
            });
          }
          if (role !== 'admin') {
            emitNotification({
              eventKey: `chat:${projectId}:${messageKey}:admin`,
              category: 'chat',
              type: 'message',
              title: `New message from ${senderLabel}`,
              description: `${snippet} — in project ${project.order_number}`,
              targetRole: 'admin',
              projectId: project.id,
              metadata: { message_id: createdMessage?.id },
            });
          }
        } catch {
          // notifications are best-effort
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const senderName = (m: ProjectMessage): string => {
    if (m.sender?.full_name) return m.sender.full_name;
    if (m.sender?.email) return m.sender.email;
    return 'Unknown';
  };

  const senderRoleLabel = (m: ProjectMessage): string => {
    const r = m.sender?.role;
    if (r === 'admin') {
      const ar = m.sender?.admin_role;
      if (ar === 'manager') return 'Manager';
      if (ar === 'finance') return 'Finance Admin';
      return 'Admin';
    }
    if (r === 'editor') return 'Editor';
    if (r === 'customer') return 'Customer';
    return 'User';
  };

  const senderInitial = (m: ProjectMessage): string => {
    const name = senderName(m);
    return name.charAt(0).toUpperCase();
  };

  const isMine = (m: ProjectMessage): boolean => m.sender_id === user?.id;

  const avatarColor = (name: string): string => {
    const colors = [
      'from-primary-400 to-primary-600',
      'from-success-400 to-success-600',
      'from-warning-400 to-warning-600',
      'from-accent-400 to-accent-600',
      'from-sky-400 to-sky-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[60vh] min-h-[300px] max-h-[600px]'} ${className}`}>
      {/* Messages list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 px-1 py-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageSquare className="w-10 h-10 text-ink-300 dark:text-ink-600 mb-3" />
            <p className="text-sm font-medium text-ink-500 dark:text-ink-400">No messages yet</p>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">Start the conversation about this project</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = isMine(m);
            const name = senderName(m);
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${mine ? 'opacity-0' : ''}`}>
                  {senderInitial(m)}
                </div>
                <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">{role === 'admin' ? `${senderName(m)} · ${senderRoleLabel(m)}` : senderRoleLabel(m)}</span>
                      {m.is_internal && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400">
                          <Lock className="w-2.5 h-2.5" /> Internal
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    className={`px-3.5 py-2 text-sm break-words [overflow-wrap:anywhere] transition-all ${
                      mine
                        ? 'bg-primary-600 text-white rounded-2xl rounded-br-md'
                        : m.is_internal
                        ? 'bg-warning-50 dark:bg-warning-500/10 text-ink-700 dark:text-ink-200 border border-warning-200 dark:border-warning-500/30 rounded-2xl rounded-bl-md'
                        : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 rounded-2xl rounded-bl-md'
                    }`}
                  >
                    {m.message}
                  </div>
                  <span className={`text-[10px] text-ink-400 dark:text-ink-500 mt-0.5 px-1 ${mine ? 'text-right' : 'text-left'}`}>
                    {formatTime(m.created_at)}{mine && m.is_internal && ' · Internal'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 text-xs text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-ink-100 dark:border-ink-800 pt-3 mt-2">
        {canUseInternal && (
          <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setIsInternal(!isInternal)}
              className={`relative w-9 h-5 rounded-full transition-colors ${isInternal ? 'bg-warning-500' : 'bg-ink-200 dark:bg-ink-600'}`}
              aria-pressed={isInternal}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isInternal ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-xs font-medium text-ink-600 dark:text-ink-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-warning-500" /> Internal note (admin & editor only)
            </span>
          </label>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white max-h-24"
            disabled={sending}
          />
          <Button
            variant="primary"
            size="sm"
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={handleSend}
            disabled={!text.trim() || sending}
            loading={sending}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
