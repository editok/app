import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef, useEffect } from 'react';

type SoundType =
  | 'click' | 'nav' | 'scroll' | 'select'
  | 'toggle-on' | 'toggle-off'
  | 'success' | 'error' | 'back'
  | 'step' | 'add' | 'remove' | 'dropdown';

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  play: (type?: SoundType) => void;
  volume: number;
  setVolume: (v: number) => void;
}

const SoundContext = createContext<SoundContextValue>({
  enabled: false,
  toggle: () => {},
  play: () => {},
  volume: 0.5,
  setVolume: () => {},
});

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface SoundConfig {
  freq: number;
  freqEnd: number;
  dur: number;
  vol: number;
  type: OscillatorType;
}

const soundConfigs: Record<SoundType, SoundConfig> = {
  'click':      { freq: 800,  freqEnd: 1200, dur: 0.05, vol: 0.3,  type: 'sine' },
  'nav':        { freq: 520,  freqEnd: 780,  dur: 0.08, vol: 0.28, type: 'sine' },
  'scroll':     { freq: 300,  freqEnd: 340,  dur: 0.03, vol: 0.12, type: 'sine' },
  'select':     { freq: 600,  freqEnd: 900,  dur: 0.06, vol: 0.25, type: 'triangle' },
  'toggle-on':  { freq: 440,  freqEnd: 880,  dur: 0.1,  vol: 0.28, type: 'triangle' },
  'toggle-off': { freq: 880,  freqEnd: 440,  dur: 0.1,  vol: 0.28, type: 'triangle' },
  'success':    { freq: 523,  freqEnd: 1047, dur: 0.15, vol: 0.3,  type: 'sine' },
  'error':      { freq: 400,  freqEnd: 200,  dur: 0.15, vol: 0.28, type: 'sawtooth' },
  'back':       { freq: 700,  freqEnd: 500,  dur: 0.06, vol: 0.25, type: 'sine' },
  'step':       { freq: 660,  freqEnd: 990,  dur: 0.07, vol: 0.26, type: 'sine' },
  'add':        { freq: 740,  freqEnd: 1100, dur: 0.06, vol: 0.24, type: 'triangle' },
  'remove':     { freq: 500,  freqEnd: 300,  dur: 0.06, vol: 0.22, type: 'triangle' },
  'dropdown':   { freq: 450,  freqEnd: 600,  dur: 0.04, vol: 0.2,  type: 'sine' },
};

let lastScrollTime = 0;
let volumeMultiplier = 0.5;

function playSound(type: SoundType) {
  const ctx = getAudioCtx();
  if (!ctx) return;

  if (type === 'scroll') {
    const now = ctx.currentTime;
    if (now - lastScrollTime < 0.06) return;
    lastScrollTime = now;
  }

  const cfg = soundConfigs[type];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const vol = Math.min(cfg.vol * volumeMultiplier, 0.8);
  osc.type = cfg.type;
  osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(cfg.freqEnd, 1), ctx.currentTime + cfg.dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + cfg.dur);
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editok-sound') === 'true';
    }
    return false;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = parseFloat(localStorage.getItem('editok-sound-volume') || '');
      return isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v));
    }
    return 0.5;
  });

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    volumeMultiplier = volume;
    localStorage.setItem('editok-sound-volume', String(volume));
  }, [volume]);

  // Sync volume from other tabs / admin changes via storage events
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'editok-sound-volume' && e.newValue) {
        const v = parseFloat(e.newValue);
        if (!isNaN(v)) setVolumeState(Math.max(0, Math.min(1, v)));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('editok-sound', String(next));
      if (next) playSound('toggle-on');
      else playSound('toggle-off');
      return next;
    });
  }, []);

  const play = useCallback((type: SoundType = 'click') => {
    if (enabledRef.current) playSound(type);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const value = useMemo(() => ({ enabled, toggle, play, volume, setVolume }), [enabled, toggle, play, volume, setVolume]);

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
