import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Joyride, type Step, type CallBackProps } from 'react-joyride';
import { Card } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { AbstractBackground } from '../components/ui/AbstractBackground';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Play, Pause, Volume2, VolumeX,
  Mic, MicOff, Send, Check, X, MessageSquare, Flag, Share2,
  CheckCircle2, AlertCircle, Clock, SkipForward, SkipBack, Lock,
  Maximize2, Minimize2, Image as ImageIcon, Film, Sparkles, Loader2, FileText, Upload, RotateCw, Trash2, Link2, HelpCircle, Undo2,
} from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth, supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, ReviewFile, Correction } from '../data/db';
import ShareLinkModal from '../components/ShareLinkModal';
import ReviewVideoPlayer, { type ReviewVideoPlayerHandle } from '../components/ui/ReviewVideoPlayer';
import {
  ClickToMarkAnimation, SlideshowAnimation, CommentsListAnimation,
  VoiceNoteAnimation, SourceLinkAnimation, SubmitApproveAnimation,
  VideoTimestampAnimation, VideoScrubAnimation,
} from '../components/ui/TourAnimations';

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

interface Mark {
  id: string;
  x: number;
  y: number;
  pageIndex: number;
  comment: string;
  resolved: boolean;
}

interface TimestampComment {
  id: string;
  time: number;
  timeFormatted: string;
  comment: string;
  resolved: boolean;
}

interface VoiceNote {
  id: string;
  duration: string;
  context: 'photo' | 'video';
  refId?: number;
  time?: number;
  url: string;
  blob?: Blob;
  uploaded?: boolean;
}

export default function ReviewScreen({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const { role, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [reviewFiles, setReviewFiles] = useState<ReviewFile[]>([]);
  const [existingCorrections, setExistingCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [activeReviewFile, setActiveReviewFile] = useState<ReviewFile | null>(null);

  const [marks, setMarks] = useState<Mark[]>([]);
  const [activeMark, setActiveMark] = useState<string | null>(null);
  const [markComment, setMarkComment] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [tsComments, setTsComments] = useState<TimestampComment[]>([]);
  const [tsInput, setTsInput] = useState('');
  const [videoTime, setVideoTime] = useState(0);
  const videoRef = useRef<ReviewVideoPlayerHandle>(null);

  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [correctionsSubmitted, setCorrectionsSubmitted] = useState(false);
  const [additionalFilesLink, setAdditionalFilesLink] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const restoredPhotoFileRef = useRef<string | null>(null);
  const restoredVideoFileRef = useRef<string | null>(null);
  const restoredVoiceFileRef = useRef<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<number>(0);
  const draftCorrectionIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ field: 'photo_marks' | 'video_timestamps' | 'voice_notes'; correctionId: string | null; item: Record<string, unknown> } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const REVIEW_TOUR_KEY = 'hasSeenReviewScreenTour';

  const hasSubmittedCorrection = useMemo(() => {
    if (!activeReviewFile) return false;
    return existingCorrections.some((c) => c.review_file_id === activeReviewFile.id && c.status !== 'draft');
  }, [existingCorrections, activeReviewFile]);

  const isReadOnly = approved || hasSubmittedCorrection || (reviewFiles.length > 0 && activeVersion > 0 && activeVersion < reviewFiles[0].version);

  const uploadPendingVoiceNotes = useCallback(async (): Promise<VoiceNote[]> => {
    const updated: VoiceNote[] = [];
    for (const v of voiceNotes) {
      if (v.uploaded || !v.blob) { updated.push(v); continue; }
      try {
        const publicUrl = await db.uploadVoiceNote(project!.id, v.blob);
        updated.push({ ...v, url: publicUrl || v.url, uploaded: true });
      } catch (err) {
        console.error('Voice note upload failed:', err);
        updated.push(v);
      }
    }
    setVoiceNotes(updated);
    return updated;
  }, [voiceNotes, project]);

  const buildCorrectionPayload = useCallback((uploadedNotes: VoiceNote[], status: 'draft' | 'pending') => {
    if (!project) return null;
    const photoMarks = marks.filter((m) => m.comment).map((m) => ({ id: m.id, label: `Page ${m.pageIndex + 1}`, x: m.x, y: m.y, pageIndex: m.pageIndex, comment: m.comment }));
    const videoTimestamps = tsComments.map((t) => ({ id: t.id, time: t.time, timeFormatted: t.timeFormatted, comment: t.comment }));
    const voiceNotesData = uploadedNotes.map((v) => ({ id: v.id, duration: v.duration, context: v.context, refLabel: v.context === 'photo' ? `Page ${(v.refId ?? 0) + 1}` : undefined, time: v.context === 'video' ? v.time : undefined, url: v.uploaded ? v.url : undefined }));
    const itemCount = photoMarks.length + videoTimestamps.length + voiceNotesData.length;
    const correctionNumber = db.generateCorrectionNumber(existingCorrections);
    const priority = itemCount > 5 ? 'high' : itemCount > 2 ? 'medium' : 'low';
    return {
      number: correctionNumber,
      project_id: project.id,
      order_id: project.order_number,
      event_name: project.event_name,
      customer: project.customer_name,
      customer_email: project.customer_email,
      editor: project.editor_name,
      editor_id: project.editor_id,
      photo_marks: photoMarks,
      video_timestamps: videoTimestamps,
      voice_notes: voiceNotesData,
      status,
      priority,
      review_file_id: activeReviewFile?.id ?? null,
      additional_files_link: additionalFilesLink.trim() || null,
      due_date: new Date(Date.now() + (status === 'draft' ? 7 : 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }, [project, marks, tsComments, existingCorrections, activeReviewFile, additionalFilesLink]);

  const autoSaveDraft = useCallback(async () => {
    if (!project || isReadOnly) return;
    const uploadedNotes = await uploadPendingVoiceNotes();
    const payload = buildCorrectionPayload(uploadedNotes, 'draft');
    if (!payload) return;
    const itemCount = payload.photo_marks.length + payload.video_timestamps.length + payload.voice_notes.length;
    if (itemCount === 0 && !additionalFilesLink.trim()) return;
    try {
      if (draftCorrectionIdRef.current) {
        await db.updateCorrection(draftCorrectionIdRef.current, {
          photo_marks: payload.photo_marks,
          video_timestamps: payload.video_timestamps,
          voice_notes: payload.voice_notes,
          additional_files_link: payload.additional_files_link,
        });
      } else {
        const created = await db.createCorrection(payload);
        if (created) draftCorrectionIdRef.current = created.id;
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [project, isReadOnly, buildCorrectionPayload, additionalFilesLink, uploadPendingVoiceNotes]);

  useEffect(() => {
    if (isReadOnly) return;
    const itemCount = marks.filter((m) => m.comment).length + tsComments.length + voiceNotes.length;
    if (itemCount === 0 && !additionalFilesLink.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { autoSaveDraft(); }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [marks, tsComments, voiceNotes, additionalFilesLink, isReadOnly, autoSaveDraft]);

  const switchVersion = (version: number) => {
    const rf = reviewFiles.find((f) => f.version === version);
    if (!rf) return;
    setActiveReviewFile(rf);
    setActiveVersion(version);
    setMode(rf.file_type === 'video' ? 'video' : 'photo');
    setSubmitted(false);
    setApproved(false);
    draftCorrectionIdRef.current = null;
    restoredPhotoFileRef.current = null;
    restoredVideoFileRef.current = null;
    restoredVoiceFileRef.current = null;
    const fileDraft = existingCorrections.find((c) => c.status === 'draft' && c.review_file_id === rf.id);
    if (fileDraft) draftCorrectionIdRef.current = fileDraft.id;
  };

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    let active = true;
    setLoading(true);
    Promise.all([
      db.fetchProject(id),
      db.fetchReviewFiles(id),
      db.fetchCorrectionsByProject(id),
    ]).then(async ([p, rf, corrs]) => {
      if (!active) return;
      // Customer access control: only allow if the project belongs to them
      if (role === 'customer' && user?.email && p) {
        if (p.customer_email !== user.email) {
          setAccessDenied(true);
          setProject(p);
          return;
        }
      }
      // Editor access control: only allow if they have a task in this project
      if (role === 'editor' && user?.email && p) {
        const tasks = await db.fetchTasks(id);
        const employees = await db.fetchEmployees();
        const emp = employees.find((e) => e.email === user.email);
        const hasMyTask = emp ? tasks.some((t) => t.assigned_to === emp.id) : false;
        if (!hasMyTask) {
          setAccessDenied(true);
          setProject(p);
          return;
        }
      }
      setAccessDenied(false);
      setProject(p);
      setReviewFiles(rf);
      setExistingCorrections(corrs);
      if (rf.length > 0) {
        const latest = rf[0];
        setActiveReviewFile(latest);
        setActiveVersion(latest.version);
        const isVid = latest.file_type === 'video';
        setMode(isVid ? 'video' : 'photo');
        const existingDraft = corrs.find((c) => c.status === 'draft' && c.review_file_id === latest.id);
        if (existingDraft) draftCorrectionIdRef.current = existingDraft.id;
      } else if (p) {
        const vid = p.category?.includes('Video') || p.category?.includes('Reels');
        setMode(vid ? 'video' : 'photo');
      }
    }).catch((err) => {
      console.error('ReviewScreen load failed:', err);
    }).finally(() => {
      if (active) setLoading(false);
    });

    // Real-time: corrections for this project
    if (supabase) {
      const corrChannel = supabase
        .channel(`review-corrections-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections', filter: `project_id=eq.${id}` }, async () => {
          const corrs = await db.fetchCorrectionsByProject(id);
          setExistingCorrections(corrs);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` }, async (payload) => {
          setProject(payload.new as Project);
        })
        .subscribe();

      return () => { active = false; supabase.removeChannel(corrChannel); };
    }

    return () => { active = false; };
  }, [params.id]);

  // PDF rendering with pdfjs-dist
  useEffect(() => {
    if (mode !== 'photo' || !activeReviewFile) return;
    const url = activeReviewFile.file_url;
    if (!url) return;

    // Check if it's a PDF
    const isPdf = activeReviewFile.file_type === 'pdf' ||
      url.toLowerCase().endsWith('.pdf') ||
      (activeReviewFile.file_name || '').toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      // It's an image - just use the URL directly
      setPdfPages([url]);
      setCurrentPage(0);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfPages([]);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        const pageImages: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          pageImages.push(canvas.toDataURL('image/jpeg', 0.85));
        }

        if (!cancelled) {
          setPdfPages(pageImages);
          setCurrentPage(0);
          setPdfLoading(false);
        }
      } catch (err) {
        console.error('PDF render error:', err);
        if (!cancelled) {
          setPdfPages([url]);
          setPdfLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeReviewFile, mode]);

  // Reset marks/timestamps when switching review files
  useEffect(() => {
    setMarks([]);
    setTsComments([]);
    setVoiceNotes([]);
    setActiveMark(null);
    setCurrentPage(0);
    setSlideshowPlaying(false);
  }, [activeReviewFile]);

  const currentVersionCorrection = useMemo(() => {
    const filtered = existingCorrections.filter(
      (c) => (role === 'customer' || c.status !== 'draft') && (!activeReviewFile || c.review_file_id === activeReviewFile.id)
    );
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  }, [existingCorrections, activeReviewFile, role]);

  // Restore saved marks from existing corrections once PDF pages are loaded
  // Only restore once per review file to avoid clobbering user edits when realtime fires
  useEffect(() => {
    if (mode !== 'photo' || pdfPages.length === 0 || !activeReviewFile) return;
    if (restoredPhotoFileRef.current === activeReviewFile.id) return;
    restoredPhotoFileRef.current = activeReviewFile.id;
    const fileCorrections = currentVersionCorrection ? [currentVersionCorrection] : [];
    const seenIds = new Set<string>();
    const savedMarks = fileCorrections
      .flatMap((corr) => corr.photo_marks)
      .filter((m) => m.x !== undefined && m.y !== undefined && !seenIds.has(m.id) && seenIds.add(m.id))
      .map((m) => {
        let pageIndex = m.pageIndex;
        if (pageIndex === undefined) {
          const match = m.label.match(/Page\s+(\d+)/i);
          pageIndex = match ? parseInt(match[1], 10) - 1 : 0;
        }
        return { id: m.id, x: m.x!, y: m.y!, pageIndex, comment: m.comment, resolved: !!m.resolved };
      });
    setMarks(savedMarks);
  }, [pdfPages, mode, currentVersionCorrection, activeReviewFile]);

  // Restore saved video timestamps for the active review file version
  useEffect(() => {
    if (mode !== 'video' || !activeReviewFile) return;
    if (restoredVideoFileRef.current === activeReviewFile.id) return;
    restoredVideoFileRef.current = activeReviewFile.id;
    const fileCorrections = currentVersionCorrection ? [currentVersionCorrection] : [];
    const seenIds = new Set<string>();
    const savedTs = fileCorrections
      .flatMap((corr) => corr.video_timestamps)
      .filter((t) => !seenIds.has(t.id) && seenIds.add(t.id))
      .map((t) => ({ id: t.id, time: t.time, timeFormatted: t.timeFormatted, comment: t.comment, resolved: !!t.resolved }))
      .sort((a, b) => a.time - b.time);
    setTsComments(savedTs);
  }, [mode, currentVersionCorrection, activeReviewFile]);

  // Restore saved voice notes from existing corrections (only those with a persisted URL)
  useEffect(() => {
    if (!activeReviewFile) return;
    if (restoredVoiceFileRef.current === activeReviewFile.id) return;
    restoredVoiceFileRef.current = activeReviewFile.id;
    const fileCorrections = currentVersionCorrection ? [currentVersionCorrection] : [];
    const seenIds = new Set<string>();
    const savedVoice = fileCorrections
      .flatMap((corr) => corr.voice_notes)
      .filter((v) => v.url && !seenIds.has(v.id) && seenIds.add(v.id))
      .map((v) => ({
        id: v.id,
        duration: v.duration,
        context: (v.context === 'video' ? 'video' : 'photo') as 'photo' | 'video',
        refId: v.context === 'photo' ? (() => { const m = v.refLabel?.match(/Page\s+(\d+)/i); return m ? parseInt(m[1], 10) - 1 : 0; })() : undefined,
        time: v.context === 'video' ? v.time : undefined,
        url: v.url!,
        uploaded: true,
      }));
    setVoiceNotes(savedVoice);
  }, [currentVersionCorrection, activeReviewFile]);

  useEffect(() => {
    if (!slideshowPlaying || mode !== 'photo') return;
    const timer = setInterval(() => {
      setCurrentPage((p) => (p + 1) % pdfPages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slideshowPlaying, mode, pdfPages.length]);

  // Discard unsaved mark (no comment) when navigating to a different page
  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      if (activeMark) {
        setMarks((prev) => prev.filter((m) => m.id !== activeMark || m.comment));
        setActiveMark(null);
        setMarkComment('');
      }
      prevPageRef.current = currentPage;
    }
  }, [currentPage, activeMark]);

  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordSeconds(0);
    }
    return () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceNotes.forEach((note) => URL.revokeObjectURL(note.url));
    };
  }, [voiceNotes]);

  const handleAddMark = (x: number, y: number, pageIndex: number) => {
    if (slideshowPlaying || isReadOnly) return;
    const id = `m-${Date.now()}`;
    setMarks((prev) => {
      const filtered = activeMark ? prev.filter((m) => m.id !== activeMark || m.comment) : prev;
      return [...filtered, { id, x, y, pageIndex, comment: '' }];
    });
    setActiveMark(id);
  };

  const submitMarkComment = (id: string) => {
    if (!markComment.trim()) {
      setMarks((prev) => prev.filter((m) => m.id !== id));
    } else {
      setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, comment: markComment } : m)));
    }
    setActiveMark(null);
    setMarkComment('');
  };

  const removeMark = (id: string) => {
    const removed = marks.find((m) => m.id === id);
    if (removed) {
      showUndoToast('photo_marks', draftCorrectionIdRef.current, { id: removed.id, label: `Page ${removed.pageIndex + 1}`, x: removed.x, y: removed.y, pageIndex: removed.pageIndex, comment: removed.comment });
    }
    setMarks((prev) => prev.filter((m) => m.id !== id));
    if (activeMark === id) setActiveMark(null);
  };

  const removeTimestampComment = (id: string) => {
    const removed = tsComments.find((t) => t.id === id);
    if (removed) {
      showUndoToast('video_timestamps', draftCorrectionIdRef.current, { id: removed.id, time: removed.time, timeFormatted: removed.timeFormatted, comment: removed.comment });
    }
    setTsComments((prev) => prev.filter((t) => t.id !== id));
  };

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.seekTo(time);
      videoRef.current.play();
    }
  }, []);

  useEffect(() => {
    const handleJumpPage = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (typeof idx === 'number') setCurrentPage(idx);
    };
    const handleJumpVideo = (e: Event) => {
      const time = (e as CustomEvent<number>).detail;
      if (typeof time === 'number') seekTo(time);
    };
    window.addEventListener('review-jump-page', handleJumpPage);
    window.addEventListener('review-jump-video', handleJumpVideo);
    return () => {
      window.removeEventListener('review-jump-page', handleJumpPage);
      window.removeEventListener('review-jump-video', handleJumpVideo);
    };
  }, [seekTo]);

  const addTimestampComment = () => {
    if (!tsInput.trim() || !videoRef.current || isReadOnly) return;
    const time = Math.floor(videoRef.current.currentTime);
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const id = `ts-${Date.now()}`;
    setTsComments((prev) => [...prev, { id, time, timeFormatted: `${mins}:${secs.toString().padStart(2, '0')}`, comment: tsInput.trim() }].sort((a, b) => a.time - b.time));
    setTsInput('');
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const startRecording = async () => {
    if (isReadOnly) return;
    setRecordError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordError('Your browser does not support voice recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000));
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setVoiceNotes((prev) => [...prev, {
          id: `v-${Date.now()}`,
          duration: formatTime(elapsedSeconds),
          context: mode,
          refId: mode === 'photo' ? currentPage : undefined,
          time: mode === 'video' && videoRef.current ? Math.floor(videoRef.current.currentTime) : undefined,
          url,
          blob,
          uploaded: false,
        }]);
        recordingStartedAtRef.current = null;
        stopMediaStream();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Recording start failed:', error);
      setRecordError('Could not access your microphone. Please allow microphone permission and try again.');
      stopMediaStream();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording(); else void startRecording();
  };

  const removeVoiceNote = (id: string) => {
    const note = voiceNotes.find((n) => n.id === id);
    if (note) {
      showUndoToast('voice_notes', draftCorrectionIdRef.current, { id: note.id, duration: note.duration, context: note.context, refLabel: note.context === 'photo' ? `Page ${(note.refId ?? 0) + 1}` : undefined, time: note.time, url: note.url });
    }
    setVoiceNotes((prev) => {
      const n = prev.find((x) => x.id === id);
      if (n) URL.revokeObjectURL(n.url);
      return prev.filter((x) => x.id !== id);
    });
  };

  const handleSubmitReview = async () => {
    if (!project) return;
    setShowSubmitModal(false);
    setSubmitError(null);
    const uploadedNotes = await uploadPendingVoiceNotes();
    const failedNotes = uploadedNotes.filter((v) => !v.uploaded && v.blob);
    if (failedNotes.length > 0) {
      setSubmitError(`${failedNotes.length} voice note(s) failed to upload. Please try again or remove them before submitting.`);
      return;
    }
    const photoMarks = marks
      .filter((m) => m.comment)
      .map((m) => ({ id: m.id, label: `Page ${m.pageIndex + 1}`, x: m.x, y: m.y, pageIndex: m.pageIndex, comment: m.comment }));
    const videoTimestamps = tsComments.map((t) => ({ id: t.id, time: t.time, timeFormatted: t.timeFormatted, comment: t.comment }));
    const voiceNotesData = uploadedNotes.map((v) => ({
      id: v.id,
      duration: v.duration,
      context: v.context,
      refLabel: v.context === 'photo' ? `Page ${(v.refId ?? 0) + 1}` : undefined,
      time: v.context === 'video' ? v.time : undefined,
      url: v.uploaded ? v.url : undefined,
    }));

    const allCorrections = await db.fetchCorrectionsByProject(project.id);
    const correctionNumber = db.generateCorrectionNumber(allCorrections);
    const itemCount = photoMarks.length + videoTimestamps.length + voiceNotesData.length;
    const priority = itemCount > 5 ? 'high' : itemCount > 2 ? 'medium' : 'low';

    let success = false;
    if (draftCorrectionIdRef.current) {
      await db.updateCorrection(draftCorrectionIdRef.current, {
        number: correctionNumber,
        project_id: project.id,
        order_id: project.order_number,
        event_name: project.event_name,
        customer: project.customer_name,
        customer_email: project.customer_email,
        editor: project.editor_name,
        editor_id: project.editor_id,
        photo_marks: photoMarks,
        video_timestamps: videoTimestamps,
        voice_notes: voiceNotesData,
        status: 'pending',
        priority,
        review_file_id: activeReviewFile?.id ?? null,
        additional_files_link: additionalFilesLink.trim() || null,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      success = true;
      draftCorrectionIdRef.current = null;
    } else {
      const created = await db.createCorrection({
        number: correctionNumber,
        project_id: project.id,
        order_id: project.order_number,
        event_name: project.event_name,
        customer: project.customer_name,
        customer_email: project.customer_email,
        editor: project.editor_name,
        editor_id: project.editor_id,
        photo_marks: photoMarks,
        video_timestamps: videoTimestamps,
        voice_notes: voiceNotesData,
        status: 'pending',
        priority,
        review_file_id: activeReviewFile?.id ?? null,
        additional_files_link: additionalFilesLink.trim() || null,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      success = !!created;
    }
    if (!success) {
      setSubmitError('Failed to submit correction. Please try again.');
      return;
    }
    setSubmitted(true);

    await db.transitionProjectStatus(project.id, 'correction');
    setProject({ ...project, status: 'correction' });

    await db.createNotification({
      type: 'correction',
      title: 'Review feedback submitted',
      description: `${project.order_number} - ${project.event_name} has ${photoMarks.length} marks, ${videoTimestamps.length} timestamp comments, and ${voiceNotesData.length} voice notes from customer.`,
      target_role: 'admin',
      read: false,
      project_id: project.id,
    });
    const editorEmployees = await db.fetchEmployees();
    const editor = editorEmployees.find((e) => e.id === project.editor_id);
    await db.createNotification({
      type: 'correction',
      title: 'New corrections received',
      description: `${project.order_number} - ${project.event_name}: ${itemCount} correction items to address.`,
      target_role: 'editor',
      target_email: editor?.email || null,
      read: false,
      project_id: project.id,
    });
    await db.sendStatusEmail({
      templateName: 'correction_received',
      recipient: editor?.email,
      recipientName: editor?.name,
      variables: {
        editor_name: editor?.name || 'there',
        project_name: project.event_name || '',
        order_number: project.order_number || '',
        correction_count: `${photoMarks.length + videoTimestamps.length + voiceNotesData.length}`,
      },
    });
    await db.sendStatusEmail({
      templateName: 'admin_client_feedback',
      recipient: 'support@editok.in',
      recipientName: 'EDITOK Admin',
      variables: {
        project_name: project.event_name || '',
        order_number: project.order_number || '',
        customer_name: project.customer_name || '',
        feedback_summary: `${photoMarks.length + videoTimestamps.length + voiceNotesData.length} correction items submitted`,
      },
    });

    const corrs = await db.fetchCorrectionsByProject(project.id);
    setExistingCorrections(corrs.filter((c) => c.status !== 'completed'));
  };

  const handleApproveAsIs = async () => {
    setShowApproveModal(true);
  };

  const confirmApproveAsIs = async () => {
    if (!project) return;
    setShowApproveModal(false);
    setApproved(true);
    await db.transitionProjectStatus(project.id, 'correction_approved');
    setProject({ ...project, status: 'correction_approved', progress: 80 });
    await db.createNotification({
      type: 'approval',
      title: 'Customer approved the review',
      description: `${project.order_number} - ${project.event_name} has been approved by the customer. Ready for invoicing and closure.`,
      target_role: 'admin',
      read: false,
      project_id: project.id,
    });
    await db.sendStatusEmail({
      templateName: 'project_approved',
      recipient: project.customer_email,
      recipientName: project.customer_name,
      variables: {
        customer_name: project.customer_name || 'there',
        project_name: project.event_name || '',
        order_number: project.order_number || '',
      },
    });
    const approveEditorEmployees = await db.fetchEmployees();
    const approveEditor = approveEditorEmployees.find((e) => e.id === project.editor_id);
    if (approveEditor?.email) {
      await db.createNotification({
        type: 'approval',
        title: 'Customer approved the review',
        description: `${project.order_number} - ${project.event_name} has been approved by the customer. No further corrections needed.`,
        target_role: 'editor',
        target_email: approveEditor.email,
        read: false,
        project_id: project.id,
      });
    }
  };

  const uploadLinks = useMemo(() => db.parseSourceLinks(project?.upload_links || null), [project?.upload_links]);

  useEffect(() => {
    const contentReady = mode === 'video' ? !!activeReviewFile : pdfPages.length > 0;
    if (role !== 'customer' || reviewFiles.length === 0 || isReadOnly || !contentReady) return;
    const seen = localStorage.getItem(REVIEW_TOUR_KEY);
    if (!seen) {
      const timer = setTimeout(() => setRunTour(true), 600);
      return () => clearTimeout(timer);
    }
  }, [role, reviewFiles.length, isReadOnly, pdfPages.length, mode, activeReviewFile]);

  const restartTour = useCallback(() => {
    setTourKey((k) => k + 1);
    setRunTour(true);
  }, []);

  const handleTourCallback = useCallback((data: CallBackProps) => {
    if (data.status === 'finished' || data.status === 'skipped') {
      localStorage.setItem(REVIEW_TOUR_KEY, 'true');
      setRunTour(false);
    }
  }, []);

  const tourSteps: Step[] = mode === 'video'
    ? [
      {
        target: '[data-tour="main-image"]',
        content: <VideoScrubAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="ts-input"]',
        content: <VideoTimestampAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="voice-note"]',
        content: <VoiceNoteAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="source-link"]',
        content: <SourceLinkAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="action-buttons"]',
        content: <SubmitApproveAnimation />,
        disableBeacon: true,
      },
    ]
    : [
      {
        target: '[data-tour="main-image"]',
        content: <ClickToMarkAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="slideshow"]',
        content: <SlideshowAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="comments-list"]',
        content: <CommentsListAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="voice-note"]',
        content: <VoiceNoteAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="source-link"]',
        content: <SourceLinkAnimation />,
        disableBeacon: true,
      },
      {
        target: '[data-tour="action-buttons"]',
        content: <SubmitApproveAnimation />,
        disableBeacon: true,
      },
    ];

  const versionCorrections = useMemo(() => {
    return currentVersionCorrection ? [currentVersionCorrection] : [];
  }, [currentVersionCorrection]);

  const allCorrectionsResolved = useMemo(() => {
    const active = versionCorrections.filter((c) => c.status !== 'completed');
    if (active.length === 0) return true;
    return active.every((c) => {
      const allItems = [...c.photo_marks, ...c.video_timestamps, ...c.voice_notes];
      return allItems.every((item) => item.resolved);
    });
  }, [versionCorrections]);

  const handleMarkCorrectedFileUploaded = () => {
    setUploadedFiles((files) => [...files, `File ${files.length + 1}`]);
  };

  const handleSubmitCorrectionsComplete = async () => {
    if (!project || !allCorrectionsResolved) return;
    setCorrectionsSubmitted(true);
    await db.transitionProjectStatus(project.id, 'correction');
    setProject({ ...project, status: 'correction' });
    await db.createNotification({
      type: 'correction',
      title: 'Corrections resolved — new version needed',
      description: `Editor has resolved all corrections for ${project.order_number} - ${project.event_name}. Please upload the next review version for customer review.`,
      target_role: 'admin',
      read: false,
      project_id: project.id,
    });
    if (project.customer_email) {
      await db.createNotification({
        type: 'correction',
        title: 'Corrections received — new version coming soon',
        description: `Your corrections for ${project.order_number} - ${project.event_name} have been received and resolved by our editor. A new version will be uploaded for your review shortly.`,
        target_role: 'customer',
        target_email: project.customer_email,
        read: false,
        project_id: project.id,
      });
    }
  };

  const showUndoToast = (field: 'photo_marks' | 'video_timestamps' | 'voice_notes', correctionId: string | null, item: Record<string, unknown>) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ field, correctionId, item });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 5000);
  };

  const handleUndoDelete = async () => {
    if (!undoInfo) return;
    const { field, correctionId, item } = undoInfo;
    setUndoInfo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    if (correctionId) {
      const corr = existingCorrections.find((c) => c.id === correctionId);
      if (corr && corr.status === 'draft') {
        const restored = [...corr[field], item];
        await db.updateCorrection(correctionId, { [field]: restored });
        const corrs = await db.fetchCorrectionsByProject(project!.id);
        setExistingCorrections(corrs);
      }
    }
    if (field === 'photo_marks') {
      const m = item as { id: string; x: number; y: number; pageIndex: number; comment: string; resolved?: boolean };
      setMarks((prev) => [...prev, { id: m.id, x: m.x, y: m.y, pageIndex: m.pageIndex, comment: m.comment, resolved: !!m.resolved }]);
    } else if (field === 'video_timestamps') {
      const t = item as { id: string; time: number; timeFormatted: string; comment: string; resolved?: boolean };
      setTsComments((prev) => [...prev, { id: t.id, time: t.time, timeFormatted: t.timeFormatted, comment: t.comment, resolved: !!t.resolved }].sort((a, b) => a.time - b.time));
    } else if (field === 'voice_notes') {
      const v = item as { id: string; duration: string; context: 'photo' | 'video'; refLabel?: string; time?: number; url?: string };
      const refId = v.refLabel ? (parseInt(v.refLabel.match(/Page\s+(\d+)/i)?.[1] || '1', 10) - 1) : undefined;
      setVoiceNotes((prev) => [...prev, { id: v.id, duration: v.duration, context: v.context, refId, time: v.time, url: v.url || '', uploaded: true }]);
    }
  };

  const handleDeleteCorrectionItem = async (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', itemId: string) => {
    if (corr.status !== 'draft') return;
    const removedItem = corr[field].find((item) => item.id === itemId);
    if (removedItem) showUndoToast(field, corr.id, removedItem as Record<string, unknown>);
    const nextItems = corr[field].filter((item) => item.id !== itemId);
    await db.updateCorrection(corr.id, { [field]: nextItems });
    const corrs = await db.fetchCorrectionsByProject(project!.id);
    setExistingCorrections(corrs);
    if (field === 'photo_marks') setMarks((prev) => prev.filter((m) => m.id !== itemId));
    if (field === 'video_timestamps') setTsComments((prev) => prev.filter((t) => t.id !== itemId));
    if (field === 'voice_notes') setVoiceNotes((prev) => prev.filter((v) => v.id !== itemId));
  };

  const handleResolveCorrection = async (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', commentId: string, resolved: boolean) => {
    await db.resolveCorrectionComment(corr.id, field, commentId, resolved);
    const freshCorrs = await db.fetchCorrectionsByProject(project!.id);
    setExistingCorrections(freshCorrs);
    const fresh = freshCorrs.find((c) => c.id === corr.id);
    if (!fresh) return;
    const allItems = [...fresh.photo_marks, ...fresh.video_timestamps, ...fresh.voice_notes];
    const allResolved = allItems.length > 0 && allItems.every((item) => item.resolved);
    if (allResolved && fresh.status !== 'completed') {
      await db.updateCorrection(corr.id, { status: 'completed' });
      await db.createNotification({
        type: 'correction',
        title: 'Corrections resolved',
        description: `Correction ${corr.number} for ${corr.event_name} has been resolved by the editor.`,
        target_role: 'customer',
        target_email: project?.customer_email || null,
        read: false,
        project_id: project?.id || null,
      });
      await db.createNotification({
        type: 'task-complete',
        title: 'Correction resolved',
        description: `Editor resolved correction ${corr.number} for ${corr.event_name}.`,
        target_role: 'admin',
        read: false,
        project_id: project?.id || null,
      });
    } else if (!allResolved && fresh.status === 'completed') {
      await db.updateCorrection(corr.id, { status: 'in-progress' });
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!project) return <div className="text-center py-20 text-ink-400">Project not found</div>;
  if (accessDenied) {
    return (
      <div className="space-y-6">
        <Card className="text-center py-16">
          <Lock className="w-12 h-12 mx-auto mb-4 text-ink-300 dark:text-ink-600" />
          <h2 className="text-lg font-semibold text-ink-700 dark:text-ink-200 mb-2">Access restricted</h2>
          <p className="text-sm text-ink-400 dark:text-ink-500 max-w-md mx-auto">
            {role === 'editor'
              ? 'You can only review projects where you have an assigned task or where tasks are still available.'
              : 'You can only review projects that belong to your account.'}
          </p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => onNavigate(role === 'editor' ? 'available-works' : 'customer-dashboard')}>
            Back to {role === 'editor' ? 'Available Works' : 'My Dashboard'}
          </Button>
        </Card>
      </div>
    );
  }

  const videoUrl = activeReviewFile?.file_type === 'video' ? activeReviewFile.file_url : '';

  return (
    <div className="space-y-6">
      <Joyride
        key={tourKey}
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        callback={handleTourCallback}
        locale={{ back: 'Back', close: 'Close', last: 'Got it!', next: 'Next', skip: 'Skip tour' }}
        styles={{
          options: {
            primaryColor: '#6366f1',
            backgroundColor: '#1e293b',
            textColor: '#f1f5f9',
            arrowColor: '#1e293b',
            overlayColor: 'rgba(0,0,0,0.6)',
            spotlightShadow: '0 0 0 4px rgba(99,102,241,0.4)',
            zIndex: 1000,
          },
          tooltip: { backgroundColor: '#1e293b', borderRadius: '12px' },
          tooltipContent: { color: '#f1f5f9', fontSize: '14px', padding: '12px' },
          buttonNext: { backgroundColor: '#6366f1', borderRadius: '8px', fontSize: '13px', padding: '8px 16px' },
          buttonBack: { color: '#94a3b8', fontSize: '13px' },
          buttonSkip: { color: '#94a3b8', fontSize: '13px' },
          buttonClose: { display: 'none' },
          spotlight: { borderRadius: '8px' },
        }}
      />
      <Breadcrumbs items={[
        { label: 'Projects', onClick: () => onNavigate(role === 'customer' ? 'customer-dashboard' : 'my-works') },
        ...(role === 'editor'
          ? [{ label: project.order_number }]
          : [{ label: project.order_number, onClick: () => onNavigate('project-details', { id: project.id }) }]),
        { label: 'Review' },
      ]} />

      <Card className="animate-slide-up relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-pink-500/10" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{project.event_name}</h2>
              <Badge status={project.status} />
            </div>
            <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">{project.order_number} · {project.customer_name} · {project.category}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {reviewFiles.length > 0 && role !== 'editor' && (
              <Button variant="primary" size="sm" icon={<Share2 className="w-3.5 h-3.5" />} onClick={() => setShowShareModal(true)}>Create Link</Button>
            )}
            {role === 'customer' && reviewFiles.length > 0 && (
              <button
                onClick={restartTour}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/15 hover:bg-primary-100 dark:hover:bg-primary-500/25 transition-colors"
                title="Start the guided tour"
              >
                <HelpCircle className="w-4 h-4" />
                How it works
              </button>
            )}
            {reviewFiles.length > 1 && (
              <div className="flex items-center gap-1 bg-ink-50 dark:bg-ink-800 rounded-lg p-1">
                {reviewFiles.map((rf) => (
                  <button
                    key={rf.id}
                    onClick={() => switchVersion(rf.version)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeVersion === rf.version ? 'bg-primary-500 text-white shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
                  >
                    V{rf.version}
                  </button>
                ))}
              </div>
            )}
            {reviewFiles.length > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white shadow-sm flex items-center gap-1.5">
                {activeReviewFile?.file_type === 'video' ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                V{activeVersion}
              </span>
            )}
          </div>
        </div>
      </Card>

      {isReadOnly && !approved && !submitted && reviewFiles.length > 1 && activeVersion < reviewFiles[0].version && (
        <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 flex items-center gap-2">
          <Lock className="w-4 h-4 text-warning-500 flex-shrink-0" />
          <p className="text-xs text-warning-700 dark:text-warning-400">
            This is a previous version (V{activeVersion}). Comments are read-only — resolved feedback is shown for reference. Switch to V{reviewFiles[0].version} to add new feedback.
          </p>
        </div>
      )}

      {hasSubmittedCorrection && !approved && !submitted && activeReviewFile && role !== 'editor' && (
        <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success-700 dark:text-success-400">Correction Submitted — Review Locked</p>
            <p className="text-xs text-success-600 dark:text-success-500">Your corrections for V{activeVersion} have been submitted to the editor. This version is now read-only. You can view all comments but cannot add, edit, or delete anything.</p>
          </div>
        </div>
      )}

      {reviewFiles.length === 0 && (
        <Card className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-3 text-ink-300 dark:text-ink-600" />
          <p className="text-sm text-ink-400">No review files uploaded yet. The admin needs to upload review files before you can review.</p>
        </Card>
      )}

      {reviewFiles.length > 0 && (
        role === 'customer' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {mode === 'photo' ? (
                pdfLoading ? (
                  <Card className="flex items-center justify-center" padding={false}>
                    <div className="flex flex-col items-center gap-3 py-20">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <p className="text-sm text-ink-400">Loading PDF pages...</p>
                    </div>
                  </Card>
                ) : pdfPages.length > 0 ? (
                  <>
                    <div data-tour="main-image">
                      <div data-tour="slideshow">
                        <PhotoSlideshow
                          pages={pdfPages}
                          currentPage={currentPage}
                          setCurrentPage={setCurrentPage}
                          slideshowPlaying={slideshowPlaying}
                          setSlideshowPlaying={setSlideshowPlaying}
                          marks={marks}
                          activeMark={activeMark}
                          markComment={markComment}
                          setMarkComment={setMarkComment}
                          onAddMark={handleAddMark}
                          submitMarkComment={submitMarkComment}
                          removeMark={removeMark}
                        />
                      </div>
                    </div>
                    <div data-tour="voice-note">
                      <VoiceRecorder
                        isRecording={isRecording}
                        recordSeconds={recordSeconds}
                        recordError={recordError}
                        toggleRecording={toggleRecording}
                        mode={mode}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div data-tour="comments-list">
                      <PageComments marks={marks} voiceNotes={voiceNotes} currentPage={currentPage} pageCount={pdfPages.length} setCurrentPage={setCurrentPage} setSlideshowPlaying={setSlideshowPlaying} removeMark={removeMark} onDeleteVoiceNote={removeVoiceNote} />
                    </div>
                  </>
                ) : null
              ) : (
                <>
                  <div data-tour="main-image">
                    <ReviewVideoPlayer
                      ref={videoRef}
                      videoUrl={videoUrl}
                      comments={tsComments}
                      onTimeChange={setVideoTime}
                    />
                  </div>
                  <Card className="animate-slide-up">
                    <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary-500" />
                      Add Timestamp Comment
                    </h3>
                    <div className="flex gap-2" data-tour="ts-input">
                      <div className="flex-shrink-0 px-3 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 text-sm font-mono font-bold min-w-[60px] text-center">
                        {formatTime(videoTime)}
                      </div>
                      <input
                        type="text"
                        value={tsInput}
                        onChange={(e) => setTsInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTimestampComment()}
                        placeholder="Type your comment for this timestamp..."
                        disabled={isReadOnly}
                        className="flex-1 px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white dark:bg-ink-900 text-ink-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Button variant="primary" size="md" icon={<Send className="w-4 h-4" />} onClick={addTimestampComment} disabled={isReadOnly}>Add</Button>
                    </div>
                  </Card>
                </>
              )}

              {mode === 'video' && (
                <div data-tour="voice-note">
                  <VoiceRecorder
                    isRecording={isRecording}
                    recordSeconds={recordSeconds}
                    recordError={recordError}
                    toggleRecording={toggleRecording}
                    mode={mode}
                    disabled={isReadOnly}
                  />
                  {voiceNotes.filter((v) => v.context === 'video').length > 0 && (
                    <Card className="animate-slide-up mt-3">
                      <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-pink-500" />
                        Recorded Voice Notes
                      </h3>
                      <div className="space-y-2">
                        {voiceNotes.filter((v) => v.context === 'video').map((v, i) => (
                          <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-pink-100 dark:border-pink-500/30 bg-pink-50/60 dark:bg-pink-500/10">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center bg-pink-500">{i + 1}</span>
                            <audio src={v.url} controls className="h-8 flex-1 min-w-0" />
                            <span className="text-xs font-mono font-bold text-pink-600">{v.duration}</span>
                            {!isReadOnly && (
                              <button onClick={() => removeVoiceNote(v.id)} className="text-ink-400 hover:text-error-500 transition-colors flex-shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <CorrectionsTabs
                corrections={versionCorrections}
                reviewFiles={reviewFiles}
                title={allCorrectionsResolved ? 'Resolved Comments' : 'Comments'}
                role={role}
                onDelete={handleDeleteCorrectionItem}
              />

              <Card className="animate-slide-up" data-tour="source-link">
                <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary-500" />
                  Additional Files Source Link
                </h3>
                <p className="text-xs text-ink-400 dark:text-ink-500 mb-3">
                  If you have extra source files (Google Drive, Dropbox, etc.) that the editor should reference, paste the link here.
                </p>
                <input
                  className="input disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="https://drive.google.com/..."
                  value={additionalFilesLink}
                  onChange={(e) => setAdditionalFilesLink(e.target.value)}
                  disabled={isReadOnly}
                />
              </Card>

              <Card className="animate-slide-up relative overflow-hidden" data-tour="action-buttons">
                <div className="absolute inset-0 bg-gradient-to-br from-success-500/10 to-primary-500/10" />
                <div className="relative">
                  <h3 className="font-semibold text-ink-900 dark:text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-success-500" />
                    Submit Correction
                  </h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">
                    {mode === 'photo'
                      ? `${marks.filter((m) => m.comment).length} marks + ${voiceNotes.length} voice notes`
                      : `${tsComments.length} comments + ${voiceNotes.length} voice notes`} ready to send
                  </p>
                  <div className="space-y-2">
                    {isReadOnly ? (
                      <div className={`p-4 rounded-xl border flex items-center gap-3 ${hasSubmittedCorrection && !approved ? 'bg-success-50 dark:bg-success-500/15 border-success-200 dark:border-success-500/30' : 'bg-warning-50 dark:bg-warning-500/15 border-warning-200 dark:border-warning-500/30'}`}>
                        {hasSubmittedCorrection && !approved ? <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" /> : <Lock className="w-5 h-5 text-warning-500 flex-shrink-0" />}
                        <div>
                          <p className={`text-sm font-semibold ${hasSubmittedCorrection && !approved ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'}`}>{hasSubmittedCorrection && !approved ? 'Correction Submitted' : 'Read-only version'}</p>
                          <p className={`text-xs ${hasSubmittedCorrection && !approved ? 'text-success-600 dark:text-success-500' : 'text-warning-600 dark:text-warning-500'}`}>{hasSubmittedCorrection && !approved ? 'Your corrections have been submitted. This version is locked until the editor resolves them.' : 'Switch to the latest version to add feedback.'}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button variant="success" className="w-full" size="lg" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setShowSubmitModal(true)} disabled={submitted || approved}>
                          {submitted ? 'Correction Submitted' : 'Submit Correction'}
                        </Button>
                        <Button variant="outline" className="w-full" icon={<Check className="w-4 h-4" />} onClick={handleApproveAsIs} disabled={submitted || approved}>
                          {approved ? 'Approved' : 'Approve as-is'}
                        </Button>
                      </>
                    )}
                  </div>
                  {submitError && (
                    <div className="mt-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-error-700 dark:text-error-400">{submitError}</p>
                    </div>
                  )}
                  {(submitted || approved) && (
                    <div className="mt-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-success-700 dark:text-success-400">
                        {approved ? 'You approved the project. Admin will confirm payment and close it.' : 'Your correction has been submitted. The editor will be notified of the corrections.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {uploadLinks.length > 0 && (
              <Card className="animate-slide-up border-success-200 dark:border-success-500/30">
                <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-success-500" />
                  Upload Corrected Files
                </h3>
                <p className="text-xs text-ink-500 dark:text-ink-400 mb-3">Upload your corrected files to the following destinations after resolving all corrections:</p>
                <div className="space-y-2">
                  {uploadLinks.map((link, i) => (
                    <a key={`upload-link-${i}`} href={link.url} target="_blank" rel="noopener noreferrer">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-success-100 dark:border-success-500/20 hover:border-success-300 transition-colors">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{link.description || `Upload ${i + 1}`}</span>
                          {link.description && <p className="text-xs text-ink-400 truncate mt-0.5">{link.url}</p>}
                        </div>
                        <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-success-600 dark:text-success-400">
                          <Upload className="w-3.5 h-3.5" /> Open
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 mt-3 pt-3 border-t border-success-100 dark:border-success-500/20">
                  {uploadedFiles.length > 0 && (
                    <span className="text-xs font-medium text-success-600 dark:text-success-400 mr-auto">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} marked uploaded
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Upload className="w-3.5 h-3.5" />}
                    onClick={handleMarkCorrectedFileUploaded}
                    disabled={correctionsSubmitted}
                  >
                    Mark File Uploaded
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    icon={<Send className="w-3.5 h-3.5" />}
                    onClick={handleSubmitCorrectionsComplete}
                    disabled={!allCorrectionsResolved || correctionsSubmitted}
                  >
                    {correctionsSubmitted ? 'Submitted' : 'Submit Work'}
                  </Button>
                </div>
              </Card>
            )}

            {mode === 'photo' ? (
              pdfLoading ? (
                <Card className="flex items-center justify-center" padding={false}>
                  <div className="flex flex-col items-center gap-3 py-20">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    <p className="text-sm text-ink-400">Loading PDF pages...</p>
                  </div>
                </Card>
              ) : pdfPages.length > 0 ? (
                <>
                  <PhotoSlideshow
                    pages={pdfPages}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    slideshowPlaying={slideshowPlaying}
                    setSlideshowPlaying={setSlideshowPlaying}
                    marks={marks}
                    activeMark={activeMark}
                    markComment={markComment}
                    setMarkComment={setMarkComment}
                    onAddMark={() => {}}
                    submitMarkComment={() => {}}
                    removeMark={() => {}}
                  />
                  <PageWiseCorrections
                    corrections={versionCorrections}
                    currentPage={currentPage}
                    pageCount={pdfPages.length}
                    setCurrentPage={setCurrentPage}
                    setSlideshowPlaying={setSlideshowPlaying}
                    role={role}
                    onResolve={handleResolveCorrection}
                  />
                </>
              ) : null
            ) : (
              <VideoReview
                videoRef={videoRef}
                videoUrl={videoUrl}
                setVideoTime={setVideoTime}
                tsComments={tsComments}
                seekTo={seekTo}
              />
            )}

            {mode === 'photo' && (
              <CorrectionsTabs
                corrections={versionCorrections}
                reviewFiles={reviewFiles}
                title={allCorrectionsResolved ? 'Resolved Corrections' : 'All Corrections'}
                role={role}
                onResolve={handleResolveCorrection}
                onDelete={handleDeleteCorrectionItem}
              />
            )}

            {mode === 'video' && (
              <CorrectionsTabs
                corrections={versionCorrections}
                reviewFiles={reviewFiles}
                title={allCorrectionsResolved ? 'Resolved Corrections' : 'Corrections to Resolve'}
                role={role}
                onResolve={handleResolveCorrection}
                onDelete={handleDeleteCorrectionItem}
              />
            )}

            {correctionsSubmitted && (
              <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-success-700 dark:text-success-400">
                  Admin has been notified. They will upload the V2 review file for the customer to review.
                </p>
              </div>
            )}
          </div>
        )
      )}
      <Modal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Corrections?" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
            <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Please confirm before submitting</p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                {mode === 'photo'
                  ? `You are about to submit ${marks.filter((m) => m.comment).length} mark correction(s) and ${voiceNotes.length} voice note(s).`
                  : `You are about to submit ${tsComments.length} timestamp comment(s) and ${voiceNotes.length} voice note(s).`}
              </p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                Once submitted, the editor will be notified to address your corrections. You will receive a new review version after they are resolved.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
          <Button variant="success" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleSubmitReview}>Yes, Submit Corrections</Button>
        </div>
      </Modal>

      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Final Approval" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
            <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Important — Please Read Before Approving</p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                By approving this project, you confirm that all corrections across all versions (V1, V2, V3, etc.) have been completed to your satisfaction.
              </p>
              <p className="text-xs text-error-600 dark:text-error-400 font-semibold leading-relaxed">
                Hereafter, you will not be able to submit any further corrections for this project. The project will be closed and handed over for final delivery.
              </p>
              <p className="text-xs text-success-600 dark:text-success-400 font-medium leading-relaxed">
                Thank you for your patience and for working with us. We hope you love the final result!
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
          <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={confirmApproveAsIs}>Yes, Approve Project</Button>
        </div>
      </Modal>

      <ShareLinkModal open={showShareModal} project={project} onClose={() => setShowShareModal(false)} onProjectUpdated={setProject} />

      {undoInfo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-900 dark:bg-ink-700 text-white shadow-2xl">
            <span className="text-sm">
              {undoInfo.field === 'photo_marks' ? 'Photo mark' : undoInfo.field === 'video_timestamps' ? 'Timestamp comment' : 'Voice note'} deleted
            </span>
            <button onClick={handleUndoDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors">
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button onClick={() => setUndoInfo(null)} className="text-ink-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceNotePlayButton({ note }: { note: VoiceNote }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play().catch(() => {}); }
    setPlaying(!playing);
  };
  return (
    <>
      <button onClick={togglePlay} className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center hover:scale-110 transition-transform">
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <audio ref={audioRef} src={note.url} onEnded={() => setPlaying(false)} preload="auto" />
    </>
  );
}

function PageComments({
  marks, voiceNotes, currentPage, pageCount, setCurrentPage, setSlideshowPlaying, removeMark, onDeleteVoiceNote,
}: {
  marks: Mark[];
  voiceNotes: VoiceNote[];
  currentPage: number;
  pageCount: number;
  setCurrentPage: (n: number) => void;
  setSlideshowPlaying: (b: boolean) => void;
  removeMark: ((id: string) => void) | null;
  onDeleteVoiceNote: (id: string) => void;
}) {
  const commentedMarks = marks.filter((m) => m.comment && m.pageIndex === currentPage);
  const pageVoiceNotes = voiceNotes.filter((v) => v.context === 'photo' && (v.refId ?? 0) === currentPage);
  const totalItems = commentedMarks.length + pageVoiceNotes.length;

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-error-500" />
        <h3 className="font-semibold text-ink-900 dark:text-white">Page {currentPage + 1} Corrections</h3>
        {totalItems > 0 && <span className="text-xs text-ink-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>}
      </div>
      {totalItems === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500 py-4 text-center">No corrections on this page. Click on the page above to add a mark.</p>
      ) : (
        <div className="space-y-2">
          {commentedMarks.map((m, i) => (
            <div key={m.id} className={`p-3 rounded-xl border ${m.resolved ? 'bg-success-50/60 dark:bg-success-500/10 border-success-200 dark:border-success-500/30' : 'bg-error-50/60 dark:bg-error-500/10 border-error-100 dark:border-error-500/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${m.resolved ? 'bg-success-500' : 'bg-error-500'}`}>{m.resolved ? <Check className="w-3 h-3" /> : i + 1}</span>
                  <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">{m.resolved ? 'Resolved Mark' : 'Mark'}</span>
                </div>
                {removeMark && !m.resolved && (
                  <button onClick={() => removeMark(m.id)} className="text-ink-400 hover:text-error-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-ink-700 dark:text-ink-200">{m.comment}</p>
            </div>
          ))}
          {pageVoiceNotes.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-pink-50/60 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/30">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">{commentedMarks.length + i + 1}</span>
              <VoiceNotePlayButton note={v} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Voice Note</p>
              </div>
              <span className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400">{v.duration}</span>
              <button onClick={() => onDeleteVoiceNote(v.id)} className="w-8 h-8 rounded-lg text-ink-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 flex items-center justify-center transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PhotoSlideshow({
  pages, currentPage, setCurrentPage, slideshowPlaying, setSlideshowPlaying,
  marks, activeMark, markComment, setMarkComment,
  onAddMark, submitMarkComment, removeMark,
}: {
  pages: string[];
  currentPage: number; setCurrentPage: (n: number) => void;
  slideshowPlaying: boolean; setSlideshowPlaying: (b: boolean) => void;
  marks: Mark[]; activeMark: string | null; markComment: string; setMarkComment: (s: string) => void;
  onAddMark: (x: number, y: number, pageIndex: number) => void;
  submitMarkComment: (id: string) => void; removeMark: (id: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgRect, setImgRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const computeRect = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const containerRatio = rect.width / rect.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    let renderedWidth: number, renderedHeight: number, offsetX: number, offsetY: number;
    if (imageRatio > containerRatio) {
      renderedWidth = rect.width;
      renderedHeight = rect.width / imageRatio;
      offsetX = 0;
      offsetY = (rect.height - renderedHeight) / 2;
    } else {
      renderedHeight = rect.height;
      renderedWidth = rect.height * imageRatio;
      offsetX = (rect.width - renderedWidth) / 2;
      offsetY = 0;
    }
    setImgRect({ left: offsetX, top: offsetY, width: renderedWidth, height: renderedHeight });
  }, []);

  useEffect(() => {
    computeRect();
    window.addEventListener('resize', computeRect);
    return () => window.removeEventListener('resize', computeRect);
  }, [computeRect]);

  useEffect(() => { computeRect(); }, [currentPage, pages, computeRect]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (slideshowPlaying) return;
    const img = imgRef.current;
    if (!img || imgRect.width === 0 || imgRect.height === 0) return;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left - imgRect.left;
    const clickY = e.clientY - rect.top - imgRect.top;
    const x = (clickX / imgRect.width) * 100;
    const y = (clickY / imgRect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    onAddMark(x, y, currentPage);
  };

  const pageMarks = marks.filter((m) => m.pageIndex === currentPage);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta > 0) {
        setCurrentPage((currentPage - 1 + pages.length) % pages.length);
      } else {
        setCurrentPage((currentPage + 1) % pages.length);
      }
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        setCurrentPage((currentPage - 1 + pages.length) % pages.length);
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((currentPage + 1) % pages.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, pages.length, setCurrentPage]);

  const [rotateMode, setRotateMode] = useState<'none' | 'native' | 'css'>('none');

  const toggleRotate = useCallback(async () => {
    if (rotateMode !== 'none') {
      if (rotateMode === 'native' && screen.orientation) {
        try { screen.orientation.unlock(); } catch {}
      }
      setRotateMode('none');
    } else {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock('landscape');
          setRotateMode('native');
          return;
        }
      } catch {}
      setRotateMode('css');
    }
  }, [rotateMode]);

  useEffect(() => {
    if (!isFullscreen && rotateMode !== 'none') setRotateMode('none');
  }, [isFullscreen, rotateMode]);

  return (
    <Card className="animate-slide-up overflow-hidden" padding={false}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Page {currentPage + 1}</span>
          <span className="text-xs text-ink-400">{currentPage + 1} / {pages.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {pages.length > 1 && (
            <button onClick={() => setSlideshowPlaying(!slideshowPlaying)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}>
              {slideshowPlaying ? <Pause className="w-4 h-4 text-ink-600 dark:text-ink-300" /> : <Play className="w-4 h-4 text-ink-600 dark:text-ink-300" />}
            </button>
          )}
          {isFullscreen && (
            <button onClick={toggleRotate} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title={rotateMode !== 'none' ? 'Exit landscape' : 'Rotate to landscape'}>
              <RotateCw className={`w-4 h-4 text-ink-600 dark:text-ink-300 transition-transform duration-300 ${rotateMode !== 'none' ? 'rotate-90' : ''}`} />
            </button>
          )}
          <button onClick={toggleFullscreen} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-ink-600 dark:text-ink-300" /> : <Maximize2 className="w-4 h-4 text-ink-600 dark:text-ink-300" />}
          </button>
        </div>
      </div>
      <div ref={containerRef} className={`relative bg-ink-900 dark:bg-black flex items-center justify-center ${isFullscreen ? 'min-h-screen' : ''}`} style={{ minHeight: isFullscreen ? undefined : '400px' }}>
        <div 
          className="relative w-full cursor-crosshair" 
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={rotateMode === 'css' ? { transform: 'rotate(90deg)', transformOrigin: 'center center' } : undefined}
        >
          <img ref={imgRef} src={pages[currentPage]} alt={`Page ${currentPage + 1}`} onLoad={computeRect} className={`w-full h-auto object-contain select-none pointer-events-none ${isFullscreen ? 'max-h-screen' : 'max-h-[500px]'}`} draggable={false} />
          {imgRect.width > 0 && (
            <div className="absolute" style={{ left: `${imgRect.left}px`, top: `${imgRect.top}px`, width: `${imgRect.width}px`, height: `${imgRect.height}px` }}>
              {pageMarks.map((m, i) => (
                <div key={m.id} className="absolute group" style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg transition-transform group-hover:scale-125 ${activeMark === m.id ? 'bg-primary-500 ring-4 ring-primary-200 animate-pulse' : m.resolved ? 'bg-success-500 ring-2 ring-success-200 dark:ring-success-500/30' : 'bg-error-500'}`}>
                    {m.resolved ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {activeMark === m.id && (
                    <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-20 w-64 max-w-[90vw] p-3 rounded-xl bg-white dark:bg-ink-800 shadow-xl border border-ink-100 dark:border-ink-700 animate-scale-in">
                      <textarea autoFocus value={markComment} onChange={(e) => setMarkComment(e.target.value)} placeholder="Describe the correction..." className="w-full p-2 text-sm border border-ink-200 dark:border-ink-700 rounded-lg outline-none focus:border-primary-500 resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white" rows={3} onClick={(e) => e.stopPropagation()} />
                      <div className="flex gap-2 mt-2">
                        <button onClick={(e) => { e.stopPropagation(); submitMarkComment(m.id); }} className="flex-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeMark(m.id); }} className="px-3 py-1.5 rounded-lg bg-error-50 text-error-600 text-sm font-medium hover:bg-error-100 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {m.comment && activeMark !== m.id && (
                    <div className={`absolute left-1/2 top-full mt-1 -translate-x-1/2 z-10 hidden group-hover:block w-48 max-w-[90vw] p-2 rounded-lg text-white text-xs shadow-lg ${m.resolved ? 'bg-success-500' : 'bg-error-500'}`}>
                      {m.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {pages.length > 1 && (
          <>
            <button onClick={() => setCurrentPage((currentPage - 1 + pages.length) % pages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentPage((currentPage + 1) % pages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {pages.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-t border-ink-100 dark:border-ink-800">
          {pages.map((p, i) => (
            <button key={i} onClick={() => { setCurrentPage(i); setSlideshowPlaying(false); }} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === currentPage ? 'border-primary-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <img src={p} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="px-4 py-2 bg-primary-50/50 dark:bg-primary-500/10 border-t border-primary-100 dark:border-primary-500/20">
        <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Click anywhere on the page to drop a correction mark. Use arrows or thumbnails to navigate.
        </p>
      </div>
    </Card>
  );
}

function VideoReview({
  videoRef, videoUrl, setVideoTime, tsComments, seekTo,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string;
  setVideoTime: (n: number) => void;
  tsComments: TimestampComment[];
  seekTo: (t: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const youtubeId = useMemo(() => {
    const m = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }, [videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const skip = (sec: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += sec;
  };

  if (youtubeId) {
    return (
      <Card className="animate-slide-up overflow-hidden" padding={false}>
        <div className="relative bg-black flex items-center justify-center" style={{ minHeight: '400px' }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-auto"
            style={{ minHeight: '400px', maxHeight: '500px' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Video Review"
          />
        </div>
        <div className="px-4 py-2 bg-primary-50/50 dark:bg-primary-500/10 border-t border-primary-100 dark:border-primary-500/20">
          <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Note the timestamp in the video and add a comment below to pin feedback to that moment.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-up overflow-hidden" padding={false}>
      <div className="relative bg-black flex items-center justify-center" style={{ minHeight: '400px' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto max-h-[500px]"
          onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setCurrent(t); setVideoTime(t); }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
        />
        <div className="absolute bottom-[60px] left-0 right-0 h-1 px-4 pointer-events-none">
          <div className="relative h-full">
            {tsComments.map((c) => (
              <div key={c.id} className={`absolute w-2 h-2 -mt-0.5 rounded-full ring-2 ring-white/50 cursor-pointer pointer-events-auto hover:scale-150 transition-transform ${c.resolved ? 'bg-success-500' : 'bg-primary-500'}`} style={{ left: `${duration > 0 ? (c.time / duration) * 100 : 0}%` }} onClick={() => seekTo(c.time)} title={c.comment} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 bg-ink-900 text-white">
        <button onClick={() => skip(-10)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"><SkipBack className="w-4 h-4" /></button>
        <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center hover:scale-110 transition-transform">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button onClick={() => skip(10)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"><SkipForward className="w-4 h-4" /></button>
        <div className="flex-1 mx-2">
          <input type="range" min={0} max={duration || 100} value={current} onChange={(e) => { if (videoRef.current) { videoRef.current.currentTime = Number(e.target.value); } }} className="w-full accent-primary-500" />
        </div>
        <span className="text-xs font-mono text-white/70 min-w-[80px] text-right">{formatTime(current)} / {formatTime(duration)}</span>
        <button onClick={toggleMute} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
      <div className="px-4 py-2 bg-primary-50/50 dark:bg-primary-500/10 border-t border-primary-100 dark:border-primary-500/20">
        <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Pause the video at any moment and type a comment to pin it to that timestamp. Click blue dots to jump.
        </p>
      </div>
    </Card>
  );
}

function VoiceRecorder({
  isRecording, recordSeconds, recordError, toggleRecording, mode, disabled,
}: {
  isRecording: boolean; recordSeconds: number; recordError: string | null; toggleRecording: () => void; mode: 'photo' | 'video'; disabled?: boolean;
}) {
  return (
    <Card className="animate-slide-up relative overflow-hidden">
      <div className={`absolute inset-0 transition-colors ${isRecording ? 'bg-error-500/5' : 'bg-pink-500/5'}`} />
      <div className={`relative flex items-center gap-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button onClick={toggleRecording} disabled={disabled} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 ${isRecording ? 'bg-error-500 text-white animate-pulse-ring' : 'bg-gradient-to-br from-pink-500 to-violet-500 text-white shadow-lg'}`}>
          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{isRecording ? 'Recording voice note...' : 'Record a voice note'}</p>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
            {isRecording ? `Recording for ${formatTime(recordSeconds)} — tap to stop and save` : `Explain your correction for this ${mode === 'photo' ? 'page' : 'video timestamp'} verbally`}
          </p>
          {recordError && (
            <p className="text-xs text-error-600 dark:text-error-400 mt-1">{recordError}</p>
          )}
        </div>
        {isRecording && (
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-1 bg-error-500 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 20}px`, animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
            ))}
          </div>
        )}
        {isRecording && <span className="text-lg font-mono font-bold text-error-600 dark:text-error-400">{formatTime(recordSeconds)}</span>}
      </div>
    </Card>
  );
}

function VoiceNotePlayer({ url, duration }: { url: string; duration: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-500/30 transition-colors flex-shrink-0"
      title={duration}
    >
      {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {playing ? 'Pause' : 'Play'}
    </button>
  );
}

function PageWiseCorrections({
  corrections, currentPage, pageCount, setCurrentPage, setSlideshowPlaying, role, onResolve,
}: {
  corrections: Correction[];
  currentPage: number;
  pageCount: number;
  setCurrentPage: (n: number) => void;
  setSlideshowPlaying: (b: boolean) => void;
  role: string;
  onResolve: (corr: Correction, field: 'photo_marks' | 'voice_notes', commentId: string, resolved: boolean) => void;
}) {
  type FlatItem = {
    corr: Correction;
    field: 'photo_marks' | 'voice_notes';
    itemId: string;
    pageIndex: number;
    type: 'mark' | 'voice';
    label: string;
    comment: string;
    duration?: string;
    voiceUrl?: string;
    resolved: boolean;
  };

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    corrections.forEach((corr) => {
      corr.photo_marks.forEach((m) => {
        let pageIndex = m.pageIndex ?? 0;
        if (pageIndex === undefined) {
          const match = m.label.match(/Page\s+(\d+)/i);
          pageIndex = match ? parseInt(match[1], 10) - 1 : 0;
        }
        items.push({ corr, field: 'photo_marks', itemId: m.id, pageIndex, type: 'mark', label: m.label, comment: m.comment, resolved: !!m.resolved });
      });
      corr.voice_notes.forEach((v) => {
        if (v.context === 'photo') {
          const match = v.refLabel?.match(/Page\s+(\d+)/i);
          const pageIndex = match ? parseInt(match[1], 10) - 1 : 0;
          items.push({ corr, field: 'voice_notes', itemId: v.id, pageIndex, type: 'voice', label: v.refLabel || '', comment: '', duration: v.duration, voiceUrl: v.url, resolved: !!v.resolved });
        }
      });
    });
    return items.sort((a, b) => a.pageIndex - b.pageIndex);
  }, [corrections]);

  const pageItems = flatItems.filter((i) => i.pageIndex === currentPage);
  const totalPagesWithContent = Array.from(new Set(flatItems.map((i) => i.pageIndex))).sort((a, b) => a - b);
  const canResolve = role === 'admin' || role === 'editor';

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-error-500" />
        <h3 className="font-semibold text-ink-900 dark:text-white">Page {currentPage + 1} Corrections</h3>
        {pageItems.length > 0 && <span className="text-xs text-ink-400">{pageItems.length} item{pageItems.length !== 1 ? 's' : ''}</span>}
      </div>
      {pageItems.length === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500 py-4 text-center">
          {totalPagesWithContent.length > 0
            ? <>No corrections on this page. Corrections exist on: {totalPagesWithContent.map((p) => `Page ${p + 1}`).join(', ')}</>
            : 'No corrections to resolve.'}
        </p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((item, i) => (
            <div key={item.itemId} className={`p-3 rounded-xl border ${item.resolved ? 'bg-success-50/60 dark:bg-success-500/10 border-success-200 dark:border-success-500/30' : item.type === 'mark' ? 'bg-error-50/60 dark:bg-error-500/10 border-error-100 dark:border-error-500/30' : 'bg-pink-50/60 dark:bg-pink-500/10 border-pink-100 dark:border-pink-500/30'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${item.resolved ? 'bg-success-500' : item.type === 'mark' ? 'bg-error-500' : 'bg-pink-500'}`}>{item.resolved ? <Check className="w-3 h-3" /> : i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {item.type === 'mark' ? (
                      <>
                        <button
                          onClick={() => setCurrentPage(item.pageIndex)}
                          className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:underline mb-0.5 block text-left"
                        >
                          {item.label}
                        </button>
                        <p className="text-sm text-ink-700 dark:text-ink-200">{item.comment}</p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mic className="w-4 h-4 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                        <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Voice Note</p>
                        <span className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400">{item.duration}</span>
                        {item.voiceUrl && <VoiceNotePlayer url={item.voiceUrl} duration={item.duration || ''} />}
                        <button
                          onClick={() => setCurrentPage(item.pageIndex)}
                          className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-semibold"
                        >
                          {item.label}
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-ink-400 mt-0.5">{item.corr.number}</p>
                  </div>
                </div>
                {canResolve && (
                  <button
                    onClick={() => onResolve(item.corr, item.field, item.itemId, !item.resolved)}
                    className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${item.resolved ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400 hover:bg-success-100 hover:text-success-700 dark:hover:bg-success-500/20 dark:hover:text-success-400'}`}
                  >
                    <Check className="w-3 h-3" />
                    {item.resolved ? 'Resolved' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


function CorrectionsTabs({
  corrections, reviewFiles, title, role, onResolve, onDelete,
}: {
  corrections: Correction[];
  reviewFiles: ReviewFile[];
  title: string;
  role?: string;
  onResolve?: (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', commentId: string, resolved: boolean) => void;
  onDelete?: (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', itemId: string) => void;
}) {
  if (corrections.length === 0) return null;

  return (
    <Card className="animate-slide-up relative overflow-hidden border-warning-200 dark:border-warning-500/30">
      <div className="absolute inset-0 bg-gradient-to-br from-warning-500/5 to-error-500/5" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1 px-1">
          <AlertCircle className="w-4 h-4 text-warning-500" />
          <h3 className="font-semibold text-ink-900 dark:text-white">{title}</h3>
          <span className="text-xs text-ink-400 dark:text-ink-500">
            {corrections.length} correction{corrections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 mt-2">
          {corrections.map((corr) => (
            <CorrectionItem key={corr.id} corr={corr} role={role} onResolve={onResolve} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function CorrectionItem({ corr, role, onResolve, onDelete }: { corr: Correction; role?: string; onResolve?: (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', commentId: string, resolved: boolean) => void; onDelete?: (corr: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', itemId: string) => void }) {
  const allResolved = useMemo(() => {
    const items = [...corr.photo_marks, ...corr.video_timestamps, ...corr.voice_notes];
    return items.length > 0 && items.every((item) => item.resolved);
  }, [corr]);
  const canResolve = (role === 'admin' || role === 'editor') && !!onResolve;
  const canDelete = role === 'customer' && corr.status === 'draft' && !!onDelete;

  const renderResolveBtn = (field: 'photo_marks' | 'video_timestamps' | 'voice_notes', itemId: string, resolved: boolean) => {
    if (!canResolve) return null;
    return (
      <button
        onClick={() => onResolve!(corr, field, itemId, !resolved)}
        className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${resolved ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400 hover:bg-success-100 hover:text-success-700 dark:hover:bg-success-500/20 dark:hover:text-success-400'}`}
      >
        <Check className="w-3 h-3" />
        {resolved ? 'Resolved' : 'Resolve'}
      </button>
    );
  };

  type UItem = { id: string; field: 'photo_marks' | 'video_timestamps' | 'voice_notes'; kind: 'mark' | 'timestamp' | 'voice'; label: string; comment: string; duration?: string; voiceUrl?: string; time?: number; refLabel?: string; resolved: boolean };
  const uItems: UItem[] = [
    ...corr.photo_marks.map((m) => ({ id: m.id, field: 'photo_marks' as const, kind: 'mark' as const, label: m.label, comment: m.comment, resolved: !!m.resolved })),
    ...corr.video_timestamps.map((t) => ({ id: t.id, field: 'video_timestamps' as const, kind: 'timestamp' as const, label: t.timeFormatted, comment: t.comment, time: t.time, resolved: !!t.resolved })),
    ...corr.voice_notes.map((v) => ({ id: v.id, field: 'voice_notes' as const, kind: 'voice' as const, label: '', comment: '', duration: v.duration, voiceUrl: v.url, time: v.time, refLabel: v.refLabel, resolved: !!v.resolved })),
  ];

  return (
    <div className={`p-3 rounded-xl border ${allResolved ? 'bg-success-50/60 dark:bg-success-500/10 border-success-200 dark:border-success-500/30' : 'bg-warning-50/60 dark:bg-warning-500/10 border border-warning-100 dark:border-warning-500/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-xs font-semibold ${allResolved ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'}`}>{corr.number}</span>
        <Badge status={corr.status} />
      </div>
      {uItems.length > 0 && (
        <div className="space-y-1.5">
          {uItems.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2">
              <span className={`flex-shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${item.resolved ? 'bg-success-500' : 'bg-error-500'}`}>{item.resolved ? <Check className="w-3 h-3" /> : i + 1}</span>
              <div className="flex-1 min-w-0 text-sm text-ink-700 dark:text-ink-200">
                {item.kind === 'mark' && (
                  <>
                    <button onClick={() => { const match = item.label.match(/Page\s+(\d+)/i); if (match) window.dispatchEvent(new CustomEvent('review-jump-page', { detail: parseInt(match[1], 10) - 1 })); }} className="text-primary-600 dark:text-primary-400 hover:underline font-semibold text-xs">{item.label}</button>
                    <p className="mt-0.5">{item.comment}</p>
                  </>
                )}
                {item.kind === 'timestamp' && (
                  <>
                    <button onClick={() => window.dispatchEvent(new CustomEvent('review-jump-video', { detail: item.time }))} className="text-primary-600 dark:text-primary-400 hover:underline font-semibold font-mono text-xs">{item.label}</button>
                    <p className="mt-0.5">{item.comment}</p>
                  </>
                )}
                {item.kind === 'voice' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.voiceUrl && <VoiceNotePlayer url={item.voiceUrl} duration={item.duration || ''} />}
                    <span className="font-mono font-bold text-pink-600 text-xs">{item.duration}</span>
                    {item.refLabel && <button onClick={() => { const match = item.refLabel?.match(/Page\s+(\d+)/i); if (match) window.dispatchEvent(new CustomEvent('review-jump-page', { detail: parseInt(match[1], 10) - 1 })); }} className="text-primary-600 dark:text-primary-400 hover:underline font-semibold text-xs">{item.refLabel}</button>}
                    {item.time !== undefined && <button onClick={() => window.dispatchEvent(new CustomEvent('review-jump-video', { detail: item.time }))} className="text-primary-600 dark:text-primary-400 hover:underline font-semibold font-mono text-xs">{formatTime(item.time)}</button>}
                  </div>
                )}
              </div>
              {renderResolveBtn(item.field, item.id, item.resolved)}
              {canDelete && (
                <button
                  onClick={() => onDelete!(corr, item.field, item.id)}
                  className="flex-shrink-0 text-ink-400 hover:text-error-500 transition-colors p-0.5"
                  title="Delete this comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {corr.additional_files_link && (
        <div className="mt-2 pt-2 border-t border-ink-100 dark:border-ink-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600 mb-1">Additional Files Link</p>
          <a href={corr.additional_files_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 dark:text-primary-400 hover:underline break-all">
            {corr.additional_files_link}
          </a>
        </div>
      )}
    </div>
  );
}
