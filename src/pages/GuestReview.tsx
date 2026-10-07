import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Joyride, type Step, type CallBackProps } from 'react-joyride';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX,
  Send, Check, X, MessageSquare, Flag, Mic, MicOff, Trash2,
  CheckCircle2, AlertCircle, Clock, SkipForward, SkipBack,
  Maximize2, Minimize2, Image as ImageIcon, Film, Sparkles, Loader2, RotateCw, MousePointerClick, ArrowLeftRight, Save, Link2, HelpCircle, Lock, Undo2,
} from 'lucide-react';
import * as db from '../data/db';
import type { Project, ReviewFile, Correction } from '../data/db';
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

interface GuestVoiceNote {
  id: string;
  duration: string;
  context: 'photo' | 'video';
  refId?: number;
  time?: number;
  url: string;
  blob?: Blob;
  uploaded?: boolean;
}

const TOUR_STORAGE_KEY = 'hasSeenReviewTour';

export default function GuestReview({ token }: { token: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [reviewFiles, setReviewFiles] = useState<ReviewFile[]>([]);
  const [existingCorrections, setExistingCorrections] = useState<Correction[]>([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);
  const [sourceLink, setSourceLink] = useState('');
  const [sourceLinkSaved, setSourceLinkSaved] = useState(false);
  const [activeVersion, setActiveVersion] = useState<number>(0);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [activeReviewFile, setActiveReviewFile] = useState<ReviewFile | null>(null);

  const versionCorrections = useMemo(() => {
    return existingCorrections;
  }, [existingCorrections]);

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

  const [voiceNotes, setVoiceNotes] = useState<GuestVoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const draftCorrectionIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredPhotoFileRef = useRef<string | null>(null);
  const restoredVideoFileRef = useRef<string | null>(null);
  const restoredVoiceFileRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ field: 'photo_marks' | 'video_timestamps' | 'voice_notes'; correctionId: string | null; item: Record<string, unknown> } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        await db.guestUpdateCorrection(token, correctionId, { [field]: restored });
        const corrs = await db.fetchCorrectionsByShareToken(token);
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

  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  const isApproved = (project?.status === 'approved' || approved) && !!project;
  const hasSubmittedCorrection = useMemo(() => {
    if (!activeReviewFile) return false;
    return existingCorrections.some((c) => c.review_file_id === activeReviewFile.id && c.status !== 'draft');
  }, [existingCorrections, activeReviewFile]);
  const isReadOnly = isApproved || hasSubmittedCorrection || activeVersion < (reviewFiles.length > 0 ? reviewFiles[reviewFiles.length - 1].version : 0);
  const shouldShowGuide = !isApproved && !hasSubmittedCorrection && reviewFiles.length > 0;

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    Promise.all([
      db.fetchProjectByShareToken(token),
      db.fetchReviewFilesByShareToken(token),
      db.fetchCorrectionsByShareToken(token),
    ]).then(([p, rf, corrs]) => {
      if (!active) return;
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProject(p);
      setReviewFiles(rf);
      setExistingCorrections(corrs);
      if (rf.length > 0) {
        const latest = rf[rf.length - 1];
        setActiveReviewFile(latest);
        setActiveVersion(latest.version);
        setMode(latest.file_type === 'video' ? 'video' : 'photo');
        const existingDraft = corrs.find((c) => c.status === 'draft' && c.review_file_id === latest.id);
        if (existingDraft) draftCorrectionIdRef.current = existingDraft.id;
      } else if (p) {
        const vid = p.category?.includes('Video') || p.category?.includes('Reels');
        setMode(vid ? 'video' : 'photo');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

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
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'photo' || !activeReviewFile) return;
    const url = activeReviewFile.file_url;
    if (!url) return;

    const isPdf = activeReviewFile.file_type === 'pdf' ||
      url.toLowerCase().endsWith('.pdf') ||
      (activeReviewFile.file_name || '').toLowerCase().endsWith('.pdf');

    if (!isPdf) {
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

  useEffect(() => {
    setMarks([]);
    setTsComments([]);
    setVoiceNotes([]);
    setActiveMark(null);
    setCurrentPage(0);
    setSlideshowPlaying(false);
    restoredPhotoFileRef.current = null;
    restoredVideoFileRef.current = null;
    restoredVoiceFileRef.current = null;
  }, [activeReviewFile]);

  useEffect(() => {
    if (mode !== 'photo' || pdfPages.length === 0 || !activeReviewFile) return;
    if (restoredPhotoFileRef.current === activeReviewFile.id) return;
    restoredPhotoFileRef.current = activeReviewFile.id;
    const fileCorrections = existingCorrections.filter((c) => c.review_file_id === activeReviewFile.id);
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
  }, [pdfPages, mode, existingCorrections, activeReviewFile]);

  useEffect(() => {
    if (mode !== 'video' || !activeReviewFile) return;
    if (restoredVideoFileRef.current === activeReviewFile.id) return;
    restoredVideoFileRef.current = activeReviewFile.id;
    const fileCorrections = existingCorrections.filter((c) => c.review_file_id === activeReviewFile.id);
    const seenIds = new Set<string>();
    const savedTs = fileCorrections
      .flatMap((corr) => corr.video_timestamps)
      .filter((t) => !seenIds.has(t.id) && seenIds.add(t.id))
      .map((t) => ({ id: t.id, time: t.time, timeFormatted: t.timeFormatted, comment: t.comment, resolved: !!t.resolved }))
      .sort((a, b) => a.time - b.time);
    setTsComments(savedTs);
  }, [mode, existingCorrections, activeReviewFile]);

  // Restore saved voice notes from existing corrections (only those with a persisted URL)
  useEffect(() => {
    if (!activeReviewFile) return;
    if (restoredVoiceFileRef.current === activeReviewFile.id) return;
    restoredVoiceFileRef.current = activeReviewFile.id;
    const fileCorrections = existingCorrections.filter((c) => c.review_file_id === activeReviewFile.id);
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
  }, [existingCorrections, activeReviewFile]);

  useEffect(() => {
    if (!slideshowPlaying || mode !== 'photo') return;
    const timer = setInterval(() => {
      setCurrentPage((p) => (p + 1) % pdfPages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slideshowPlaying, mode, pdfPages.length]);

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

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.seekTo(time);
      videoRef.current.play();
    }
  }, []);

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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isReadOnly) return;
    setRecordError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError('Your browser does not support voice recording.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => { if (e.data.size > 0) mediaChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000));
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        const duration = `${mins}:${secs.toString().padStart(2, '0')}`;
        setVoiceNotes((prev) => [...prev, {
          id: `v-${Date.now()}`,
          duration,
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
    } catch (err) {
      console.error('Recording start failed:', err);
      setRecordError('Could not access your microphone. Please allow microphone permission and try again.');
      stopMediaStream();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording(); else startRecording();
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

  const deleteSavedItem = async (correction: Correction, field: 'photo_marks' | 'video_timestamps' | 'voice_notes', itemId: string) => {
    if (correction.status !== 'draft' || isReadOnly) return;
    const removedItem = correction[field].find((item) => item.id === itemId);
    if (removedItem) showUndoToast(field, correction.id, removedItem as Record<string, unknown>);
    const nextItems = correction[field].filter((item) => item.id !== itemId);
    const success = await db.guestUpdateCorrection(token, correction.id, { [field]: nextItems });
    if (!success) return;
    setExistingCorrections((prev) => prev.map((item) => item.id === correction.id ? { ...item, [field]: nextItems } : item));
    if (field === 'photo_marks') setMarks((prev) => prev.filter((item) => item.id !== itemId));
    if (field === 'video_timestamps') setTsComments((prev) => prev.filter((item) => item.id !== itemId));
    if (field === 'voice_notes') removeVoiceNote(itemId);
  };

  const uploadPendingVoiceNotes = useCallback(async (): Promise<GuestVoiceNote[]> => {
    const updated: GuestVoiceNote[] = [];
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

  const buildCorrectionPayload = useCallback((uploadedNotes: GuestVoiceNote[], status: 'draft' | 'pending') => {
    if (!project) return null;
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

    const itemCount = photoMarks.length + videoTimestamps.length + voiceNotesData.length;
    const correctionNumber = `C${existingCorrections.length + 1}`;
    const priority = itemCount > 5 ? 'high' : itemCount > 2 ? 'medium' : 'low';

    return {
      number: correctionNumber,
      project_id: project.id,
      order_id: project.order_number,
      event_name: project.event_name,
      customer: 'Guest Reviewer',
      customer_email: null,
      editor: null,
      editor_id: null,
      photo_marks: photoMarks,
      video_timestamps: videoTimestamps,
      voice_notes: voiceNotesData,
      status,
      priority,
      review_file_id: activeReviewFile?.id ?? null,
      due_date: new Date(Date.now() + (status === 'draft' ? 7 : 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      additional_files_link: sourceLink.trim() || null,
    };
  }, [project, marks, tsComments, existingCorrections.length, activeReviewFile, sourceLink]);


  const autoSaveDraft = useCallback(async () => {
    if (!project || !token || isReadOnly || submitted || approved) return;
    const uploadedNotes = await uploadPendingVoiceNotes();
    const payload = buildCorrectionPayload(uploadedNotes, 'draft');
    if (!payload) return;
    const itemCount = payload.photo_marks.length + payload.video_timestamps.length + payload.voice_notes.length;
    if (itemCount === 0 && !sourceLink.trim()) return;

    try {
      if (draftCorrectionIdRef.current) {
        await db.guestUpdateCorrection(token, draftCorrectionIdRef.current, {
          photo_marks: payload.photo_marks,
          video_timestamps: payload.video_timestamps,
          voice_notes: payload.voice_notes,
          additional_files_link: payload.additional_files_link,
        });
      } else {
        const success = await db.guestSubmitCorrection(token, payload);
        if (success) {
          const corrs = await db.fetchCorrectionsByShareToken(token);
          const draft = corrs.find((c) => c.status === 'draft' && c.review_file_id === (activeReviewFile?.id ?? null));
          if (draft) draftCorrectionIdRef.current = draft.id;
        }
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [project, token, isReadOnly, buildCorrectionPayload, sourceLink, activeReviewFile, uploadPendingVoiceNotes]);

  useEffect(() => {
    if (isReadOnly) return;
    const itemCount = marks.filter((m) => m.comment).length + tsComments.length + voiceNotes.length;
    if (itemCount === 0 && !sourceLink.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { autoSaveDraft(); }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [marks, tsComments, voiceNotes, sourceLink, isReadOnly, autoSaveDraft]);

  const handleSubmitFeedback = async () => {
    if (!project) return;
    setSubmitError(null);
    const uploadedNotes = await uploadPendingVoiceNotes();
    const payload = buildCorrectionPayload(uploadedNotes, 'pending');
    if (!payload) return;

    const itemCount = payload.photo_marks.length + payload.video_timestamps.length + payload.voice_notes.length;
    if (itemCount === 0) {
      setSubmitError('Please add at least one comment, mark, or voice note before submitting your correction.');
      return;
    }

    let success = false;
    if (draftCorrectionIdRef.current) {
      success = await db.guestUpdateCorrection(token, draftCorrectionIdRef.current, { ...payload, status: 'pending' });
    } else {
      success = await db.guestSubmitCorrection(token, payload);
    }

    if (success) {
      setSubmitted(true);
      draftCorrectionIdRef.current = null;
      const corrs = await db.fetchCorrectionsByShareToken(token);
      setExistingCorrections(corrs);
      await db.createNotification({
        type: 'correction',
        title: 'Customer feedback submitted',
        description: `Feedback has been submitted for "${project.event_name}" (${project.order_number}). Please review the corrections.`,
        target_role: 'admin',
        project_id: project.id,
        read: false,
      });
      if (project.editor_id) {
        const editorEmployees = await db.fetchEmployees();
        const editor = editorEmployees.find((e) => e.id === project.editor_id);
        await db.createNotification({
          type: 'correction',
          title: 'New corrections received',
          description: `Corrections have been submitted for "${project.event_name}" (${project.order_number}).`,
          target_role: 'editor',
          target_email: editor?.email || null,
          project_id: project.id,
          read: false,
        });
      }
    } else {
      setSubmitError('Failed to submit correction. Please try again.');
    }
  };

  const handleSaveForLater = async () => {
    if (!project) return;
    setSubmitError(null);
    const uploadedNotes = await uploadPendingVoiceNotes();
    const payload = buildCorrectionPayload(uploadedNotes, 'draft');
    if (!payload) return;

    const itemCount = payload.photo_marks.length + payload.video_timestamps.length + payload.voice_notes.length;
    if (itemCount === 0 && !sourceLink.trim()) {
      setSubmitError('Please add at least one comment, mark, voice note, or source link before saving.');
      return;
    }

    let success = false;
    if (draftCorrectionIdRef.current) {
      success = await db.guestUpdateCorrection(token, draftCorrectionIdRef.current, {
        photo_marks: payload.photo_marks,
        video_timestamps: payload.video_timestamps,
        voice_notes: payload.voice_notes,
        additional_files_link: payload.additional_files_link,
      });
    } else {
      success = await db.guestSubmitCorrection(token, payload);
      if (success) {
        const corrs = await db.fetchCorrectionsByShareToken(token);
        const draft = corrs.find((c) => c.status === 'draft' && c.review_file_id === (activeReviewFile?.id ?? null));
        if (draft) draftCorrectionIdRef.current = draft.id;
        setExistingCorrections(corrs);
      }
    }

    if (success) {
      setSavedDraft(true);
    } else {
      setSubmitError('Failed to save draft. Please try again.');
    }
  };

  const handleSaveSourceLink = async () => {
    if (!project || !sourceLink.trim()) return;
    if (draftCorrectionIdRef.current) {
      await db.guestUpdateCorrection(token, draftCorrectionIdRef.current, {
        additional_files_link: sourceLink.trim(),
      });
      setSourceLinkSaved(true);
      const corrs = await db.fetchCorrectionsByShareToken(token);
      setExistingCorrections(corrs);
    } else {
      const success = await db.guestSubmitCorrection(token, {
        project_id: project.id,
        order_id: project.order_number,
        event_name: project.event_name,
        customer: 'Guest Reviewer',
        photo_marks: [],
        video_timestamps: [],
        voice_notes: [],
        status: 'draft',
        priority: 'low',
        additional_files_link: sourceLink.trim(),
        review_file_id: activeReviewFile?.id || null,
      });
      if (success) {
        setSourceLinkSaved(true);
        const corrs = await db.fetchCorrectionsByShareToken(token);
        setExistingCorrections(corrs);
        const draft = corrs.find((c) => c.status === 'draft' && c.review_file_id === (activeReviewFile?.id || null));
        if (draft) draftCorrectionIdRef.current = draft.id;
      }
    }
  };

  const handleApproveProof = async () => {
    if (!project) return;
    setShowApproveModal(false);
    setApproved(true);
    await db.guestApproveProof(token);
    setProject({ ...project, status: 'correction_approved', progress: 80 });
    await db.createNotification({
      type: 'approval',
      title: 'Proof approved by customer',
      description: `The customer has approved the proof for "${project.event_name}" (${project.order_number}). The project is ready for invoicing.`,
      target_role: 'admin',
      project_id: project.id,
      read: false,
    });
    if (project.editor_id) {
      const approveEditorEmployees = await db.fetchEmployees();
      const approveEditor = approveEditorEmployees.find((e) => e.id === project.editor_id);
      if (approveEditor?.email) {
        await db.createNotification({
          type: 'approval',
          title: 'Customer approved the proof',
          description: `The customer has approved the proof for "${project.event_name}" (${project.order_number}). No further corrections needed.`,
          target_role: 'editor',
          target_email: approveEditor.email,
          project_id: project.id,
          read: false,
        });
      }
    }
  };

  const guideShownRef = useRef(false);
  useEffect(() => {
    if (shouldShowGuide && !guideShownRef.current && !loading) {
      guideShownRef.current = true;
    }
  }, [shouldShowGuide, loading]);

  useEffect(() => {
    const contentReady = mode === 'video' ? !!activeReviewFile : pdfPages.length > 0;
    if (!loading && reviewFiles.length > 0 && !isApproved && !hasSubmittedCorrection && contentReady) {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => setRunTour(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, reviewFiles.length, isApproved, hasSubmittedCorrection, pdfPages.length, mode, activeReviewFile]);

  const handleTourCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      setRunTour(false);
    }
  };

  const restartTour = () => {
    setRunTour(false);
    setTimeout(() => {
      setTourKey((k) => k + 1);
      setRunTour(true);
    }, 100);
  };

  const switchVersion = (version: number) => {
    const rf = reviewFiles.find((f) => f.version === version);
    if (!rf) return;
    setActiveReviewFile(rf);
    setActiveVersion(version);
    setMode(rf.file_type === 'video' ? 'video' : 'photo');
    setSubmitted(false);
    setApproved(false);
    setSavedDraft(false);
    setSourceLinkSaved(false);
    setSubmitError(null);
    draftCorrectionIdRef.current = null;
    restoredPhotoFileRef.current = null;
    restoredVideoFileRef.current = null;
    restoredVoiceFileRef.current = null;
    const fileDraft = existingCorrections.find((c) => c.status === 'draft' && c.review_file_id === rf.id);
    if (fileDraft) draftCorrectionIdRef.current = fileDraft.id;
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink-50 to-ink-100 dark:from-ink-900 dark:to-ink-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg animate-pulse">
            E
          </div>
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          <p className="text-sm text-ink-500">Loading your proof...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink-50 to-ink-100 dark:from-ink-900 dark:to-ink-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-error-50 dark:bg-error-500/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-error-500" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Proof Not Found</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">This proof link may have expired or is no longer available. Please contact your photographer for an updated link.</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const videoUrl = activeReviewFile?.file_type === 'video' ? activeReviewFile.file_url : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 via-white to-primary-50/30 dark:from-ink-950 dark:via-ink-900 dark:to-primary-900/20">
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
      {/* Clean branded header — no app navigation */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-ink-900/80 backdrop-blur-lg border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              E
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-900 dark:text-white leading-tight">Proof Review</h1>
              <p className="text-xs text-ink-400 dark:text-ink-500 truncate">{project.event_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
                {reviewFiles[0].file_type === 'video' ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                V{activeVersion}
              </span>
            )}
            <button
              onClick={restartTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/15 hover:bg-primary-100 dark:hover:bg-primary-500/25 transition-colors"
              title="Start the guided tour"
            >
              <HelpCircle className="w-4 h-4" />
              How it works
            </button>
          </div>
        </div>
      </header>

      {isReadOnly && !isApproved && !submitted && reviewFiles.length > 1 && activeVersion < reviewFiles[reviewFiles.length - 1].version && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 flex items-center gap-2">
            <Lock className="w-4 h-4 text-warning-500 flex-shrink-0" />
            <p className="text-xs text-warning-700 dark:text-warning-400">
              This is a previous version (V{activeVersion}). Comments are read-only — resolved feedback is shown for reference. Switch to V{reviewFiles[reviewFiles.length - 1].version} to add new feedback.
            </p>
          </div>
        </div>
      )}

      {hasSubmittedCorrection && !isApproved && !submitted && activeReviewFile && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-700 dark:text-success-400">Correction Submitted — Review Locked</p>
              <p className="text-xs text-success-600 dark:text-success-500">Your corrections for V{activeVersion} have been submitted to the editor. This version is now read-only. You can view all comments but cannot add, edit, or delete anything.</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {submitError && (
          <div className="mb-4 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">
            {submitError}
          </div>
        )}

        {reviewFiles.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-ink-300 dark:text-ink-600" />
            <h2 className="text-lg font-semibold text-ink-700 dark:text-ink-200 mb-2">No proofs available yet</h2>
            <p className="text-sm text-ink-400 dark:text-ink-500">Your photographer hasn't uploaded any review files. Please check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {mode === 'photo' ? (
                pdfLoading ? (
                  <div className="flex items-center justify-center py-20 bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <p className="text-sm text-ink-400">Loading pages...</p>
                    </div>
                  </div>
                ) : pdfPages.length > 0 ? (
                  <div data-tour="main-image">
                    <div data-tour="slideshow">
                    <GuestPhotoSlideshow
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
                      disabled={isReadOnly}
                    />
                    </div>
                  </div>
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
                  <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4">
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
                        placeholder="Type your comment for this moment..."
                        disabled={isReadOnly}
                        className="flex-1 px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white dark:bg-ink-900 text-ink-900 dark:text-white disabled:opacity-50"
                      />
                      <Button variant="primary" size="md" icon={<Send className="w-4 h-4" />} onClick={addTimestampComment} disabled={isReadOnly}>Add</Button>
                    </div>
                  </div>
                </>
              )}

              {/* Page comments for photo mode — includes marks AND voice notes together */}
              {mode === 'photo' && (
                <div data-tour="comments-list">
                  <GuestPageComments
                    marks={marks}
                    voiceNotes={voiceNotes}
                    currentPage={currentPage}
                    removeMark={removeMark}
                    onDeleteVoiceNote={removeVoiceNote}
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {/* Voice recorder — works in both photo and video modes */}
              <div data-tour="voice-note">
                <GuestVoiceRecorder
                  isRecording={isRecording}
                  recordSeconds={recordSeconds}
                  recordError={recordError}
                  toggleRecording={toggleRecording}
                  mode={mode}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Timestamp comments for video mode */}
              {mode === 'video' && (
                <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4">
                  <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-500" />
                    Timestamp Comments
                  </h3>
                  {tsComments.length === 0 ? (
                    <p className="text-sm text-ink-400 dark:text-ink-500 py-4 text-center">Play the video and add comments at specific moments.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {tsComments.map((c, i) => (
                        <div key={c.id} className={`p-3 rounded-xl border ${c.resolved ? 'bg-success-50/60 dark:bg-success-500/10 border-success-200 dark:border-success-500/30' : 'bg-primary-50/60 dark:bg-primary-500/10 border-primary-100 dark:border-primary-500/30'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${c.resolved ? 'bg-success-500' : 'bg-primary-500'}`}>{c.resolved ? <Check className="w-3 h-3" /> : i + 1}</span>
                            <button onClick={() => seekTo(c.time)} className={`text-xs font-mono font-bold hover:underline ${c.resolved ? 'text-success-600 dark:text-success-400' : 'text-primary-600 dark:text-primary-400'}`}>
                              {c.timeFormatted}
                            </button>
                          </div>
                          <p className="text-sm text-ink-700 dark:text-ink-200">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All submitted corrections across all versions */}
              {versionCorrections.length > 0 && (
                <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4">
                  <h3 className="font-semibold text-ink-900 dark:text-white mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary-500" />
                    Previous Corrections
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {versionCorrections.map((corr) => (
                      <div key={corr.id} className="p-3 rounded-xl bg-warning-50/60 dark:bg-warning-500/10 border border-warning-100 dark:border-warning-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-warning-700 dark:text-warning-400">{corr.number}</span>
                          <span className="text-xs text-ink-400">{corr.photo_marks.length} marks · {corr.video_timestamps.length} timestamps · {corr.voice_notes.length} voice notes</span>
                        </div>
                        {corr.photo_marks.map((m, i) => (
                          <div key={m.id} className="flex items-start gap-1.5 mb-1">
                            <span className={`flex-shrink-0 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center mt-0.5 ${m.resolved ? 'bg-success-500' : 'bg-error-500'}`}>{m.resolved ? <Check className="w-2.5 h-2.5" /> : i + 1}</span>
                            <span className="text-xs text-ink-700 dark:text-ink-200 flex-1 min-w-0"><b>{m.label}:</b> {m.comment}</span>
                            {corr.status === 'draft' && !isReadOnly && (
                              <button onClick={() => deleteSavedItem(corr, 'photo_marks', m.id)} className="flex-shrink-0 text-ink-400 hover:text-error-500 transition-colors p-0.5" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        ))}
                        {corr.video_timestamps.map((t, i) => (
                          <div key={t.id} className="flex items-start gap-1.5 mb-1">
                            <span className={`flex-shrink-0 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center mt-0.5 ${t.resolved ? 'bg-success-500' : 'bg-primary-500'}`}>{t.resolved ? <Check className="w-2.5 h-2.5" /> : i + 1}</span>
                            <span className="text-xs text-ink-700 dark:text-ink-200 flex-1 min-w-0"><b>{t.timeFormatted}:</b> {t.comment}</span>
                            {corr.status === 'draft' && !isReadOnly && (
                              <button onClick={() => deleteSavedItem(corr, 'video_timestamps', t.id)} className="flex-shrink-0 text-ink-400 hover:text-error-500 transition-colors p-0.5" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        ))}
                        {corr.voice_notes.map((v, i) => (
                          <div key={v.id} className="flex items-center gap-1.5 mb-1">
                            <span className={`flex-shrink-0 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${v.resolved ? 'bg-success-500' : 'bg-pink-500'}`}>{v.resolved ? <Check className="w-2.5 h-2.5" /> : i + 1}</span>
                            <span className="text-xs text-ink-700 dark:text-ink-200 flex-1 min-w-0">{v.context === 'photo' ? `Photo: ${v.refLabel || ''}` : `Video @ ${v.time !== undefined ? formatTime(v.time) : ''}`}</span>
                            <span className="text-xs font-mono font-bold text-pink-600">{v.duration}</span>
                            {corr.status === 'draft' && !isReadOnly && (
                              <button onClick={() => deleteSavedItem(corr, 'voice_notes', v.id)} className="flex-shrink-0 text-ink-400 hover:text-error-500 transition-colors p-0.5" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source link upload */}
              {!isApproved && !isReadOnly && (
                <div data-tour="source-link" className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4">
                  <h3 className="font-semibold text-ink-900 dark:text-white mb-2 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary-500" />
                    Source Files Link
                  </h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500 mb-3">
                    Have extra source files? Paste a Google Drive, Dropbox, or other link for the editor.
                  </p>
                  <input
                    type="url"
                    value={sourceLink}
                    onChange={(e) => { setSourceLink(e.target.value); setSourceLinkSaved(false); }}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2.5 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all bg-white dark:bg-ink-900 text-ink-900 dark:text-white"
                  />
                  {sourceLinkSaved && (
                    <p className="text-xs text-success-600 dark:text-success-400 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Link saved!
                    </p>
                  )}
                </div>
              )}

              {/* Submit / Approve actions */}
              <div data-tour="action-buttons" className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-success-500/5 to-primary-500/5" />
                <div className="relative">
                  <h3 className="font-semibold text-ink-900 dark:text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-success-500" />
                    Your Review
                  </h3>
                  <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">
                    {mode === 'photo'
                      ? `${marks.filter((m) => m.comment).length} marks · ${voiceNotes.length} voice notes`
                      : `${tsComments.length} comments · ${voiceNotes.length} voice notes`} ready to send
                  </p>
                  {isApproved ? (
                    <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-success-700 dark:text-success-400">Proof Approved</p>
                        <p className="text-xs text-success-600 dark:text-success-500">Thank you for your approval!</p>
                      </div>
                    </div>
                  ) : hasSubmittedCorrection ? (
                    <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-success-700 dark:text-success-400">Correction Submitted — Review Locked</p>
                        <p className="text-xs text-success-600 dark:text-success-500">Your corrections for V{activeVersion} have been submitted. This version is now read-only. You can view all comments but cannot add, edit, or delete anything.</p>
                      </div>
                    </div>
                  ) : isReadOnly ? (
                    <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30 flex items-center gap-3">
                      <Lock className="w-5 h-5 text-warning-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-warning-700 dark:text-warning-400">Read-only version</p>
                        <p className="text-xs text-warning-600 dark:text-warning-500">Switch to the latest version to add feedback.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button variant="success" className="w-full" size="lg" icon={<Send className="w-4 h-4" />} onClick={() => setShowSubmitModal(true)} disabled={submitted}>
                        {submitted ? 'Correction Submitted' : 'Submit Correction'}
                      </Button>
                      <Button variant="outline" className="w-full" icon={<Save className="w-4 h-4" />} onClick={handleSaveForLater} disabled={submitted}>
                        {savedDraft ? 'Draft Saved' : 'Save for Later'}
                      </Button>
                      <Button variant="outline" className="w-full" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setShowApproveModal(true)} disabled={submitted}>
                        Approve Proof
                      </Button>
                    </div>
                  )}
                  {(submitted || hasSubmittedCorrection) && !isApproved && (
                    <div className="mt-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-success-700 dark:text-success-400">
                        Your correction has been submitted. The team will review your comments and make the necessary adjustments.
                      </p>
                    </div>
                  )}
                  {savedDraft && !hasSubmittedCorrection && !isApproved && (
                    <div className="mt-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/30 flex items-start gap-2">
                      <Save className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-primary-700 dark:text-primary-400">
                        Your draft has been saved. You can come back later to add more feedback and submit when ready.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-ink-100 dark:border-ink-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-xs text-ink-400 dark:text-ink-500">Powered by EditOK · Secure Proof Review</p>
        </div>
      </footer>

      {/* Submit confirmation warning modal */}
      <Modal open={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Confirm Submission" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
            <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Before You Submit</p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                You cannot submit additional corrections once this batch is sent until the editors have resolved these items. Please ensure you have added all necessary corrections across all slides before proceeding.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-700">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {mode === 'photo'
                ? `${marks.filter((m) => m.comment).length} marks · ${voiceNotes.length} voice notes ready to send`
                : `${tsComments.length} comments · ${voiceNotes.length} voice notes ready to send`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" size="md" onClick={() => setShowSubmitModal(false)}>
            Go Back & Check
          </Button>
          <Button variant="success" size="md" icon={<Send className="w-3.5 h-3.5" />} onClick={() => { setShowSubmitModal(false); handleSubmitFeedback(); }}>
            Confirm & Submit
          </Button>
        </div>
      </Modal>

      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Final Approval" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
            <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Please Read Before Approving</p>
              <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
                By approving this proof, you confirm that all work is completed to your satisfaction.
              </p>
              <p className="text-xs text-error-600 dark:text-error-400 font-semibold leading-relaxed">
                You will not be able to submit further corrections after approval. The project will be closed for final delivery.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
          <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleApproveProof}>Yes, Approve Proof</Button>
        </div>
      </Modal>

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

function GuestPhotoSlideshow({
  pages, currentPage, setCurrentPage, slideshowPlaying, setSlideshowPlaying,
  marks, activeMark, markComment, setMarkComment,
  onAddMark, submitMarkComment, removeMark, disabled,
}: {
  pages: string[];
  currentPage: number; setCurrentPage: (n: number) => void;
  slideshowPlaying: boolean; setSlideshowPlaying: (b: boolean) => void;
  marks: Mark[]; activeMark: string | null; markComment: string; setMarkComment: (s: string) => void;
  onAddMark: (x: number, y: number, pageIndex: number) => void;
  submitMarkComment: (id: string) => void; removeMark: (id: string) => void;
  disabled: boolean;
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
    if (slideshowPlaying || disabled) return;
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
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
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
      <div ref={containerRef} className={`relative bg-ink-900 dark:bg-black flex items-center justify-center ${isFullscreen ? 'min-h-screen' : ''}`} style={{ minHeight: isFullscreen ? undefined : 'min(60vh, 400px)' }}>
        <div 
          className={`relative w-full ${disabled ? '' : 'cursor-crosshair'}`} 
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={rotateMode === 'css' ? { transform: 'rotate(90deg)', transformOrigin: 'center center' } : undefined}
        >
          <img ref={imgRef} src={pages[currentPage]} alt={`Page ${currentPage + 1}`} onLoad={computeRect} className={`w-full h-auto object-contain select-none pointer-events-none ${isFullscreen ? 'max-h-screen' : 'max-h-[min(70vh,500px)]'}`} draggable={false} />
          {imgRect.width > 0 && (
            <div className="absolute" style={{ left: `${imgRect.left}px`, top: `${imgRect.top}px`, width: `${imgRect.width}px`, height: `${imgRect.height}px` }}>
              {pageMarks.map((m, i) => (
                <div key={m.id} className="absolute group" style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg transition-transform group-hover:scale-125 ${activeMark === m.id ? 'bg-primary-500 ring-4 ring-primary-200 animate-pulse' : m.resolved ? 'bg-success-500 ring-2 ring-success-200 dark:ring-success-500/30' : 'bg-error-500'}`}>
                    {m.resolved ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {activeMark === m.id && (
                    <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-20 w-64 max-w-[90vw] p-3 rounded-xl bg-white dark:bg-ink-800 shadow-xl border border-ink-100 dark:border-ink-700 animate-scale-in">
                      <textarea autoFocus value={markComment} onChange={(e) => setMarkComment(e.target.value)} placeholder="Describe what you'd like changed..." className="w-full p-2 text-sm border border-ink-200 dark:border-ink-700 rounded-lg outline-none focus:border-primary-500 resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white" rows={3} onClick={(e) => e.stopPropagation()} />
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
      {!disabled && (
        <div className="px-4 py-2 bg-primary-50/50 dark:bg-primary-500/10 border-t border-primary-100 dark:border-primary-500/20">
          <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Click anywhere on the page to drop a comment mark. Use arrows or thumbnails to navigate.
          </p>
        </div>
      )}
    </div>
  );
}

function GuestVideoReview({
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
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
        <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 'min(60vh, 400px)' }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-auto"
            style={{ minHeight: 'min(60vh, 400px)', maxHeight: 'min(70vh, 500px)' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Video Review"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
      <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 'min(60vh, 400px)' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto max-h-[min(70vh,500px)]"
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
          <input type="range" min={0} max={duration || 100} value={current} onChange={(e) => { if (videoRef.current) { videoRef.current.seekTo(Number(e.target.value)); } }} className="w-full accent-primary-500" />
        </div>
        <span className="text-xs font-mono text-white/70 min-w-[80px] text-right">{formatTime(current)} / {formatTime(duration)}</span>
        <button onClick={toggleMute} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function GuestPageComments({
  marks, voiceNotes, currentPage, removeMark, onDeleteVoiceNote, disabled,
}: {
  marks: Mark[];
  voiceNotes: GuestVoiceNote[];
  currentPage: number;
  removeMark: (id: string) => void;
  onDeleteVoiceNote: (id: string) => void;
  disabled: boolean;
}) {
  const commentedMarks = marks.filter((m) => m.comment && m.pageIndex === currentPage);
  const pageVoiceNotes = voiceNotes.filter((v) => v.context === 'photo' && (v.refId ?? 0) === currentPage);
  const totalItems = commentedMarks.length + pageVoiceNotes.length;

  return (
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-error-500" />
        <h3 className="font-semibold text-ink-900 dark:text-white">Page {currentPage + 1} Comments</h3>
        {totalItems > 0 && <span className="text-xs text-ink-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>}
      </div>
      {totalItems === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500 py-4 text-center">No comments on this page. Click on the page above to add a mark.</p>
      ) : (
        <div className="space-y-2">
          {commentedMarks.map((m, i) => (
            <div key={m.id} className={`p-3 rounded-xl border ${m.resolved ? 'bg-success-50/60 dark:bg-success-500/10 border-success-200 dark:border-success-500/30' : 'bg-error-50/60 dark:bg-error-500/10 border-error-100 dark:border-error-500/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${m.resolved ? 'bg-success-500' : 'bg-error-500'}`}>{m.resolved ? <Check className="w-3 h-3" /> : i + 1}</span>
                  <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">{m.resolved ? 'Resolved' : 'Mark'}</span>
                </div>
                {!m.resolved && !disabled && (
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
              <GuestVoiceNotePlayButton note={v} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Voice Note</p>
              </div>
              <span className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400">{v.duration}</span>
              {!disabled && (
                <button onClick={() => onDeleteVoiceNote(v.id)} className="w-8 h-8 rounded-lg text-ink-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 flex items-center justify-center transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuestVoiceRecorder({
  isRecording, recordSeconds, recordError, toggleRecording, mode, disabled,
}: {
  isRecording: boolean;
  recordSeconds: number;
  recordError: string | null;
  toggleRecording: () => void;
  mode: 'photo' | 'video';
  disabled: boolean;
}) {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4 relative overflow-hidden">
      <div className={`absolute inset-0 transition-colors ${isRecording ? 'bg-error-500/5' : 'bg-pink-500/5'}`} />
      <div className="relative flex items-center gap-4">
        <button
          onClick={toggleRecording}
          disabled={disabled}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${isRecording ? 'bg-error-500 text-white animate-pulse' : 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg'}`}
        >
          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
            {isRecording ? 'Recording voice note...' : 'Record a voice note'}
          </p>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
            {isRecording
              ? `Recording for ${formatTime(recordSeconds)} — tap to stop and save`
              : `Explain your feedback for this ${mode === 'photo' ? 'page' : 'video'} verbally`}
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
    </div>
  );
}

function GuestVoiceNotePlayButton({ note }: { note: GuestVoiceNote }) {
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
      <button onClick={togglePlay} className="flex-shrink-0 w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center hover:scale-110 transition-transform">
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <audio ref={audioRef} src={note.url} onEnded={() => setPlaying(false)} preload="auto" />
    </>
  );
}
