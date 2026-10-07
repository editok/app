import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Share2 } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';
import * as db from '../data/db';
import type { Project } from '../data/db';

interface ShareLinkModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onProjectUpdated?: (project: Project) => void;
}

export default function ShareLinkModal({ open, project, onClose, onProjectUpdated }: ShareLinkModalProps) {
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    let active = true;
    setCopied(false);
    const ensureToken = async () => {
      const token = project.share_token || await db.regenerateShareToken(project.id);
      if (!active || !token) return;
      if (!project.share_token) onProjectUpdated?.({ ...project, share_token: token });
      setShareLink(`${window.location.origin}/proof/${token}`);
    };
    ensureToken();
    return () => { active = false; };
  }, [open, project, onProjectUpdated]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt('Copy this link to share with your client:', shareLink);
    }
  };

  const regenerateLink = async () => {
    if (!project) return;
    setRegenerating(true);
    const token = await db.regenerateShareToken(project.id);
    setRegenerating(false);
    if (!token) return;
    onProjectUpdated?.({ ...project, share_token: token });
    setShareLink(`${window.location.origin}/proof/${token}`);
    setCopied(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Share with Client" size="md">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/30 flex items-start gap-3">
          <Share2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-white">Public Proof Link</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 leading-relaxed">Anyone with this link can view the proof, leave feedback, and approve it — no login required.</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Share Link</label>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={shareLink || 'Creating link...'} onClick={(event) => event.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-ink-700 dark:text-ink-200 font-mono outline-none" />
            <Button variant="primary" size="md" icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} onClick={copyLink} disabled={!shareLink} className="flex-shrink-0">{copied ? 'Copied' : 'Copy'}</Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-700 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCw className="w-4 h-4 text-warning-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-700 dark:text-ink-200">Regenerate Link</p>
              <p className="text-xs text-ink-400 dark:text-ink-500">The old link will stop working.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon={regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} onClick={regenerateLink} disabled={regenerating || !project} className="flex-shrink-0 whitespace-nowrap">{regenerating ? 'Regenerating...' : 'Regenerate'}</Button>
        </div>

        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
          <a href={shareLink || '#'} target="_blank" rel="noopener noreferrer" className={`text-sm text-primary-600 hover:underline flex items-center gap-1.5 ${!shareLink ? 'pointer-events-none opacity-50' : ''}`}><ExternalLink className="w-3.5 h-3.5" /> Preview link</a>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
