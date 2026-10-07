import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, AlertCircle } from 'lucide-react';

export interface ReviewTimestamp {
  id: string;
  time: number;
  comment: string;
  resolved?: boolean;
}

export interface ReviewVideoPlayerHandle {
  readonly currentTime: number;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  readonly muted: boolean;
}

interface ReviewVideoPlayerProps {
  videoUrl: string;
  comments: ReviewTimestamp[];
  onTimeChange: (time: number) => void;
}

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isMuted: () => boolean;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  unMute: () => void;
};

type YouTubeApi = {
  Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, unknown>; events: { onReady: (event: { target: YouTubePlayer }) => void; onStateChange: (event: { data: number }) => void } }) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; CUED: number };
};

type YouTubeWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).match(/^[\w-]{11}$/)?.[0] || null;
    if (parsed.hostname.endsWith('youtube.com')) {
      const queryId = parsed.searchParams.get('v');
      if (queryId && /^[\w-]{11}$/.test(queryId)) return queryId;
      const pathId = parsed.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
      return pathId?.[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, '0')}`;
}

const ReviewVideoPlayer = forwardRef<ReviewVideoPlayerHandle, ReviewVideoPlayerProps>(function ReviewVideoPlayer({ videoUrl, comments, onTimeChange }, ref) {
  const youtubeId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateTime = useCallback((time: number) => {
    setCurrent(time);
    onTimeChange(time);
  }, [onTimeChange]);

  const play = useCallback(() => {
    if (youtubePlayerRef.current) youtubePlayerRef.current.playVideo();
    else void nativeVideoRef.current?.play();
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (youtubePlayerRef.current) youtubePlayerRef.current.pauseVideo();
    else nativeVideoRef.current?.pause();
    setPlaying(false);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (youtubePlayerRef.current) youtubePlayerRef.current.seekTo(time, true);
    else if (nativeVideoRef.current) nativeVideoRef.current.currentTime = time;
    updateTime(time);
  }, [updateTime]);

  useImperativeHandle(ref, () => ({
    get currentTime() { return current; },
    play,
    pause,
    seekTo,
    get muted() { return muted; },
  }), [current, muted, pause, play, seekTo]);

  useEffect(() => {
    if (!youtubeId || !youtubeContainerRef.current) return;
    let active = true;
    const youtubeWindow = window as YouTubeWindow;

    const createPlayer = () => {
      if (!active || !youtubeContainerRef.current || !youtubeWindow.YT) return;
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = new youtubeWindow.YT.Player(youtubeContainerRef.current, {
        videoId: youtubeId,
        playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (!active) return;
            setDuration(target.getDuration());
            setMuted(target.isMuted());
          },
          onStateChange: ({ data }) => {
            if (!youtubeWindow.YT) return;
            setPlaying(data === youtubeWindow.YT.PlayerState.PLAYING);
            if (data === youtubeWindow.YT.PlayerState.ENDED) setPlaying(false);
          },
        },
      });
    };

    if (youtubeWindow.YT) {
      createPlayer();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]');
      const script = existingScript || document.createElement('script');
      if (!existingScript) {
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.youtubeIframeApi = 'true';
        document.head.appendChild(script);
      }
      const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
      youtubeWindow.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        createPlayer();
      };
    }

    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player) return;
      const time = player.getCurrentTime();
      setDuration(player.getDuration());
      updateTime(time);
    }, 250);

    return () => {
      active = false;
      window.clearInterval(timer);
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [updateTime, youtubeId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenRef.current.requestFullscreen();
  }, []);

  const toggleMute = useCallback(() => {
    if (youtubePlayerRef.current) {
      if (muted) youtubePlayerRef.current.unMute();
      else youtubePlayerRef.current.mute();
      setMuted(!muted);
    } else if (nativeVideoRef.current) {
      nativeVideoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }, [muted]);

  const skip = useCallback((seconds: number) => seekTo(Math.max(0, current + seconds)), [current, seekTo]);

  return (
    <div ref={fullscreenRef} className={`bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden ${isFullscreen ? 'bg-black dark:bg-black' : ''}`}>
      <div className={`relative bg-black flex items-center justify-center ${isFullscreen ? 'min-h-screen' : 'min-h-[min(60vh,400px)]'}`}>
        {youtubeId ? (
          <div ref={youtubeContainerRef} className={`w-full aspect-video ${isFullscreen ? 'max-h-screen' : 'max-h-[500px]'}`} />
        ) : (
          <video
            ref={nativeVideoRef}
            src={videoUrl}
            className={`w-full h-auto object-contain ${isFullscreen ? 'max-h-screen' : 'max-h-[500px]'}`}
            onTimeUpdate={(event) => updateTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={() => (playing ? pause() : play())}
          />
        )}
        <div className="absolute bottom-[60px] left-0 right-0 h-1 px-4 pointer-events-none">
          <div className="relative h-full">
            {comments.map((comment) => (
              <button
                key={comment.id}
                type="button"
                className={`absolute w-2.5 h-2.5 -mt-0.5 rounded-full ring-2 ring-white/50 pointer-events-auto hover:scale-150 transition-transform ${comment.resolved ? 'bg-success-500' : 'bg-primary-500'}`}
                style={{ left: `${duration > 0 ? (comment.time / duration) * 100 : 0}%` }}
                onClick={() => seekTo(comment.time)}
                title={comment.comment}
                aria-label={`Jump to ${formatTime(comment.time)}: ${comment.comment}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-ink-900 text-white">
        <button type="button" onClick={() => skip(-10)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Back 10 seconds"><SkipBack className="w-4 h-4" /></button>
        <button type="button" onClick={playing ? pause : play} className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center hover:scale-110 transition-transform" title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button type="button" onClick={() => skip(10)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Forward 10 seconds"><SkipForward className="w-4 h-4" /></button>
        <div className="flex-1 mx-1 sm:mx-2">
          <input type="range" min={0} max={duration || 100} value={Math.min(current, duration || 100)} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-primary-500" aria-label="Video progress" />
        </div>
        <span className="hidden sm:block text-xs font-mono text-white/70 min-w-[80px] text-right">{formatTime(current)} / {formatTime(duration)}</span>
        <button type="button" onClick={toggleMute} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button type="button" onClick={toggleFullscreen} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      <div className="px-4 py-2 bg-primary-50/50 dark:bg-primary-500/10 border-t border-primary-100 dark:border-primary-500/20">
        <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Pause the video at any moment and add feedback at that timestamp. Click the markers to jump.</p>
      </div>
    </div>
  );
});

export default ReviewVideoPlayer;
