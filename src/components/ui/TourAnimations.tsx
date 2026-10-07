import type { ReactNode } from 'react';

interface TourStepContentProps {
  title: string;
  description: string;
  children: ReactNode;
}

function TourStepContent({ title, description, children }: TourStepContentProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center h-28 rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden relative">
        {children}
      </div>
      <div>
        <p className="font-semibold text-sm text-slate-100 mb-1">{title}</p>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function ClickToMarkAnimation() {
  return (
    <TourStepContent
      title="Click to Drop a Pin"
      description="Click anywhere on the image to drop a numbered pin. Type your comment for that exact spot, then move to the next."
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-20 h-14 rounded-lg bg-slate-600/40 border border-slate-500/30" />
        <div className="absolute w-5 h-5 rounded-full bg-indigo-400 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white tour-pin-drop">
          1
        </div>
        <div className="absolute bottom-3 right-6 px-2 py-1 rounded-md bg-slate-700 text-[8px] text-slate-200 tour-comment-pop">
          Fix background
        </div>
      </div>
    </TourStepContent>
  );
}

export function SlideshowAnimation() {
  return (
    <TourStepContent
      title="Mark and Save Comments on Every Slide"
      description="Choose a page with the arrows or thumbnails, click the image to place a pin, type your feedback, and press Save. Your comments stay attached to that page while you review the rest."
    >
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-900">
        <img
          src="/images/animated-tour-guide/image.png"
          alt="Example of placing a comment pin and saving feedback on a slideshow page"
          className="h-full w-full object-contain opacity-90"
        />
        <div className="absolute inset-0 bg-slate-950/10" />
        <div className="absolute top-1 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500 text-[7px] font-bold text-white tour-guide-callout tour-guide-callout-1">
          <span className="flex items-center justify-center w-3 h-3 rounded-full bg-white/90 text-indigo-600">1</span>
          Choose page
        </div>
        <div className="absolute top-1 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[7px] font-bold text-white tour-guide-callout tour-guide-callout-2">
          <span className="flex items-center justify-center w-3 h-3 rounded-full bg-white/90 text-amber-600">2</span>
          Add comment
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[7px] font-bold text-white tour-guide-callout tour-guide-callout-3">
          <span className="flex items-center justify-center w-3 h-3 rounded-full bg-white/90 text-emerald-600">3</span>
          Save
        </div>
      </div>
    </TourStepContent>
  );
}

export function CommentsListAnimation() {
  return (
    <TourStepContent
      title="Your Comments List"
      description="All your pins are listed here with page numbers. Click any pin to jump to that spot. Remove a pin if you change your mind."
    >
      <div className="flex flex-col gap-1 w-full px-3 justify-center">
        <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-slate-700/50 tour-comment-slide-1">
          <div className="w-3 h-3 rounded-full bg-indigo-400 text-[7px] font-bold text-white flex items-center justify-center">1</div>
          <div className="h-1.5 flex-1 rounded-full bg-slate-600" />
        </div>
        <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-slate-700/50 tour-comment-slide-2">
          <div className="w-3 h-3 rounded-full bg-indigo-400 text-[7px] font-bold text-white flex items-center justify-center">2</div>
          <div className="h-1.5 w-3/4 rounded-full bg-slate-600" />
        </div>
        <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-slate-700/50 tour-comment-slide-3">
          <div className="w-3 h-3 rounded-full bg-indigo-400 text-[7px] font-bold text-white flex items-center justify-center">3</div>
          <div className="h-1.5 w-2/3 rounded-full bg-slate-600" />
        </div>
      </div>
    </TourStepContent>
  );
}

export function VoiceNoteAnimation() {
  return (
    <TourStepContent
      title="Record a Voice Note"
      description="Prefer speaking? Tap the mic button to record a voice note explaining your feedback. It attaches to the current page or video timestamp."
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-pink-500/30 border-2 border-pink-400 flex items-center justify-center tour-mic-pulse">
          <div className="w-3 h-4 rounded-full bg-pink-400" />
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-pink-400 tour-wave-bar"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </div>
    </TourStepContent>
  );
}

export function SourceLinkAnimation() {
  return (
    <TourStepContent
      title="Add Source File Links"
      description="Have extra files on Google Drive, Dropbox, or another service? Paste the link here so the editor can access replacement or additional files for any page."
    >
      <div className="relative w-full h-full flex items-center justify-center px-3">
        <div className="flex items-center gap-1.5 w-full">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600/50 flex-1 tour-link-type">
            <div className="w-3 h-3 rounded bg-indigo-400/80" />
            <div className="h-1.5 flex-1 rounded-full bg-slate-600" />
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-indigo-500 text-[8px] font-bold text-white tour-link-save">
            Save
          </div>
        </div>
      </div>
    </TourStepContent>
  );
}

export function SubmitApproveAnimation() {
  return (
    <TourStepContent
      title="Submit or Approve"
      description="When you're done, click Submit Correction to send your comments to the editor. If everything looks perfect, click Approve Proof to finalize."
    >
      <div className="flex flex-col gap-1.5 w-full px-3 justify-center">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 tour-submit-glow">
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <div className="h-1.5 flex-1 rounded-full bg-emerald-600/50" />
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 tour-approve-glow">
          <div className="w-3 h-3 rounded-full border-2 border-slate-400" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-600" />
        </div>
      </div>
    </TourStepContent>
  );
}

export function VideoTimestampAnimation() {
  return (
    <TourStepContent
      title="Add Timestamp Comments"
      description="Play the video and pause at any moment. Type a comment — it's pinned to that exact timestamp. Click any timestamp to jump back to it."
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-24 h-14 rounded-lg bg-slate-700/40 border border-slate-600/30 overflow-hidden">
          <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-indigo-400 text-[7px] font-mono font-bold text-white tour-ts-pop">
            1:23
          </div>
          <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-slate-600">
            <div className="h-full rounded-full bg-indigo-400 tour-ts-progress" style={{ width: '45%' }} />
          </div>
          <div className="absolute bottom-3 right-2 px-1 py-0.5 rounded bg-slate-800/80 text-[7px] text-slate-300 tour-ts-comment-pop">
            Adjust color
          </div>
        </div>
      </div>
    </TourStepContent>
  );
}

export function VideoScrubAnimation() {
  return (
    <TourStepContent
      title="Scrub Through the Video"
      description="Use the play/pause button and the timeline to navigate. Drop comments at specific moments — they appear in the timestamp list on the right."
    >
      <div className="relative w-full h-full flex items-center justify-center gap-2">
        <div className="w-6 h-6 rounded-full bg-indigo-400/80 flex items-center justify-center tour-play-pulse">
          <div className="w-0 h-0 border-l-[4px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-slate-600 relative overflow-hidden">
          <div className="h-full rounded-full bg-indigo-400 tour-scrub-progress" style={{ width: '30%' }} />
        </div>
      </div>
    </TourStepContent>
  );
}
