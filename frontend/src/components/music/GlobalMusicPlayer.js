import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, SkipForward } from 'lucide-react';
import { musicAPI } from '../../services/api';
import { cn } from '../../lib/utils';

const LEGACY_PAUSED_KEY = 'assetflow-music-paused';
const PLAY_STATE_KEY = 'assetflow-music-play-state';
const REFRESH_INTERVAL_MS = 60000;
const WAVE_PURPLE = [139, 92, 246];
const WAVE_PINK = [236, 72, 153];
const WAVE_BLUE = [79, 70, 229];

function getRandomTrack(tracks, currentId) {
  if (!tracks.length) return null;
  if (tracks.length === 1) return tracks[0];
  const options = tracks.filter(track => track.id !== currentId);
  return options[Math.floor(Math.random() * options.length)];
}

function WaveCanvas({ active, expanded }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let frameId;
    let start = performance.now();

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const time = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const centerY = h * 0.5;
      const [pr, pg, pb] = WAVE_PURPLE;
      const [mr, mg, mb] = WAVE_PINK;
      const [br, bg, bb] = WAVE_BLUE;

      const lines = expanded ? 12 : 8;
      for (let i = 0; i < lines; i += 1) {
        const offset = i * 0.47;
        const amplitude = (active ? 13 : 8) + (i % 5) * 2.8;
        const alpha = active ? 0.28 + (i % 6) * 0.08 : 0.16 + (i % 5) * 0.045;
        const color = i % 4 === 0
          ? [mr, mg, mb]
          : i % 3 === 0
            ? [br, bg, bb]
            : [pr, pg, pb];
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2.5) {
          const progress = x / w;
          const fade = Math.sin(progress * Math.PI);
          const waveA = Math.sin(progress * Math.PI * (2.2 + (i % 4) * 0.42) + time * (0.9 + i * 0.045) + offset);
          const waveB = Math.sin(progress * Math.PI * (5.4 + (i % 3) * 0.55) - time * 0.72 + offset);
          const y = centerY + (waveA * amplitude + waveB * amplitude * 0.42) * fade + (i - lines / 2) * 1.35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
        ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.15;
        ctx.shadowColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${active ? 0.95 : 0.48})`;
        ctx.shadowBlur = active ? 18 : 10;
        ctx.stroke();
      }

      const sparkles = active ? 20 : 9;
      for (let i = 0; i < sparkles; i += 1) {
        const travel = ((time * (0.07 + i * 0.003) + i * 0.137) % 1);
        const dotX = travel * w;
        const dotY = centerY + Math.sin(time * 1.35 + i * 1.9) * (10 + (i % 4) * 4);
        const twinkle = Math.sin(time * 4 + i) * 0.35 + 0.65;
        const radius = (i % 5 === 0 ? 2.4 : 1.4) * twinkle;
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0
          ? `rgba(${mr}, ${mg}, ${mb}, ${0.42 * twinkle})`
          : `rgba(245, 230, 255, ${0.62 * twinkle})`;
        ctx.shadowColor = `rgba(${pr}, ${pg}, ${pb}, 0.95)`;
        ctx.shadowBlur = active ? 16 : 8;
        ctx.fill();
      }

      ctx.restore();
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [active, expanded]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

export function GlobalMusicPlayer() {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [wantsPlaying, setWantsPlaying] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(PLAY_STATE_KEY) !== 'paused';
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const canShow = enabled && tracks.length > 0;
  const streamUrl = useMemo(() => {
    return currentTrack ? musicAPI.getStreamUrl(currentTrack.id) : '';
  }, [currentTrack]);

  const loadConfig = useCallback(async () => {
    try {
      const response = await musicAPI.getConfig();
      const nextEnabled = Boolean(response.data?.enabled);
      const nextTracks = response.data?.tracks || [];
      setEnabled(nextEnabled);
      setTracks(nextTracks);
      setCurrentTrack(prev => {
        if (!nextEnabled || nextTracks.length === 0) return null;
        if (prev && nextTracks.some(track => track.id === prev.id)) return prev;
        return getRandomTrack(nextTracks, null);
      });
    } catch (error) {
      setEnabled(false);
      setTracks([]);
      setCurrentTrack(null);
    }
  }, []);

  const attemptPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    try {
      await audio.play();
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch (error) {
      setIsPlaying(false);
      setAutoplayBlocked(true);
    }
  }, [streamUrl]);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
  }, []);

  const playUserRequested = useCallback(() => {
    localStorage.setItem(PLAY_STATE_KEY, 'playing');
    setWantsPlaying(true);
    attemptPlay();
  }, [attemptPlay]);

  const pauseUserRequested = useCallback(() => {
    localStorage.setItem(PLAY_STATE_KEY, 'paused');
    setWantsPlaying(false);
    setAutoplayBlocked(false);
    pauseAudio();
  }, [pauseAudio]);

  const selectNextTrack = useCallback(() => {
    const nextTrack = getRandomTrack(tracks, currentTrack?.id);
    if (!nextTrack) return;
    localStorage.setItem(PLAY_STATE_KEY, 'playing');
    setWantsPlaying(true);
    setCurrentTrack(nextTrack);
  }, [currentTrack, tracks]);

  useEffect(() => {
    localStorage.removeItem(LEGACY_PAUSED_KEY);
    loadConfig();
    const interval = window.setInterval(loadConfig, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', loadConfig);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', loadConfig);
    };
  }, [loadConfig]);

  useEffect(() => {
    if (!canShow) {
      pauseAudio();
    }
  }, [canShow, pauseAudio]);

  useEffect(() => {
    if (!canShow || !streamUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (wantsPlaying) {
      const timer = window.setTimeout(attemptPlay, 80);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [attemptPlay, canShow, streamUrl, wantsPlaying]);

  useEffect(() => {
    if (!canShow || !wantsPlaying || isPlaying) return undefined;

    const resumeFromGesture = () => {
      attemptPlay();
    };

    document.addEventListener('pointerdown', resumeFromGesture, { capture: true, passive: true });
    document.addEventListener('click', resumeFromGesture, { capture: true, passive: true });
    document.addEventListener('keydown', resumeFromGesture, { capture: true });
    document.addEventListener('touchstart', resumeFromGesture, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', resumeFromGesture, { capture: true });
      document.removeEventListener('click', resumeFromGesture, { capture: true });
      document.removeEventListener('keydown', resumeFromGesture, { capture: true });
      document.removeEventListener('touchstart', resumeFromGesture, { capture: true });
    };
  }, [attemptPlay, canShow, isPlaying, wantsPlaying]);

  function handleMouseEnter() {
    setExpanded(true);
  }

  function handleMouseLeave() {
    setExpanded(false);
  }

  function handlePlayPause(event) {
    event.stopPropagation();
    if (isPlaying) pauseUserRequested();
    else playUserRequested();
  }

  function handleNext(event) {
    event.stopPropagation();
    selectNextTrack();
  }

  function handleEnded() {
    if (tracks.length <= 1) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
      if (wantsPlaying) attemptPlay();
      return;
    }
    selectNextTrack();
  }

  if (!canShow || !currentTrack) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[45] hidden md:block">
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="auto"
        onCanPlay={() => {
          if (wantsPlaying && !isPlaying) attemptPlay();
        }}
        onPlay={() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
      />

      <motion.div
        className="relative h-16"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={{ scale: 0, y: 24 }}
        animate={{ scale: 1, y: 0, width: expanded ? 352 : 64 }}
        transition={{ type: 'spring', bounce: 0.14, duration: expanded ? 0.34 : 0.16 }}
        style={{ borderRadius: 9999 }}
      >
        <motion.div
          className="pointer-events-none absolute right-[-83px] top-1/2 z-0 h-24 -translate-y-1/2 overflow-hidden"
          animate={{
            width: expanded ? 360 : 230,
            opacity: isPlaying ? 1 : 0
          }}
          transition={{
            width: { type: 'spring', bounce: 0.1, duration: expanded ? 0.34 : 0.16 },
            opacity: { duration: 0.42, ease: 'easeInOut' }
          }}
          style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 14%, black 88%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 14%, black 88%, transparent 100%)'
          }}
        >
          <WaveCanvas active={isPlaying} expanded={expanded} />
        </motion.div>
        <motion.div
          className={cn(
            "relative z-10 flex h-16 items-center overflow-hidden rounded-full border border-violet-200/20",
            "bg-[#0b071d]/72 text-white shadow-2xl backdrop-blur-2xl"
          )}
          animate={{ width: expanded ? 352 : 64 }}
          transition={{ type: 'spring', bounce: 0.12, duration: expanded ? 0.34 : 0.16 }}
          style={{
            boxShadow: isPlaying
              ? '0 0 42px rgba(139, 92, 246, 0.62), 0 16px 46px rgb(0 0 0 / 0.34)'
              : '0 0 26px rgba(139, 92, 246, 0.34), 0 16px 40px rgb(0 0 0 / 0.28)',
            borderRadius: 9999
          }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 z-0"
            animate={{ opacity: isPlaying ? 0.85 : 0 }}
            transition={{ duration: 0.34, ease: 'easeInOut' }}
          >
            <WaveCanvas active={isPlaying} expanded={expanded} />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#050414]/70 via-transparent to-[#14092e]/40" />
          </motion.div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="track-info"
                initial={{ opacity: 0, x: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: 12, filter: 'blur(5px)' }}
                transition={{ duration: 0.18 }}
                className="relative z-10 flex min-w-0 flex-1 items-center gap-3 pl-5 pr-20"
              >
                <div className="flex h-9 w-16 items-center justify-center gap-1 rounded-full bg-violet-400/15">
                  {[0, 1, 2, 3].map(index => (
                    <motion.span
                      key={index}
                      className="w-1 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.9)]"
                      animate={{ height: isPlaying ? [8, 18, 10] : 8, opacity: isPlaying ? 1 : 0.45 }}
                      transition={{
                        duration: 0.75,
                        repeat: Infinity,
                        delay: index * 0.1,
                        ease: 'easeInOut'
                      }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{currentTrack.name}</p>
                  <p className="text-xs text-violet-100/60 leading-tight">
                    {autoplayBlocked ? 'Click anywhere to start' : isPlaying ? 'Now playing' : 'Paused'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-400/15 text-violet-100 transition-colors hover:bg-violet-500 hover:text-white"
                  aria-label="Play another random song"
                  title="Next random song"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={handlePlayPause}
            className={cn(
              "absolute right-0 top-0 z-20 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              "bg-violet-400/15 text-violet-100 hover:bg-violet-500 hover:text-white",
              !expanded && "bg-violet-600 text-white shadow-[0_0_28px_rgba(139,92,246,0.58)]"
            )}
            aria-label={isPlaying ? 'Pause app music' : 'Play app music'}
            title={isPlaying ? 'Pause app music' : 'Play app music'}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <Pause
                className={cn(
                  "absolute h-5 w-5 fill-current transition-all duration-100",
                  isPlaying ? "scale-100 opacity-100" : "scale-90 opacity-0"
                )}
              />
              <Play
                className={cn(
                  "absolute h-5 w-5 fill-current transition-all duration-100",
                  isPlaying ? "scale-90 opacity-0" : "scale-100 opacity-100"
                )}
              />
            </span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
