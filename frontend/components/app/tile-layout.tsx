import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarVisualizer,
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';

const MotionContainer = motion.create('div');

/**
 * Deep Reactive Glow v2 - TileLayout.tsx
 *
 * - Multi-layer volumetric glow (3 layers)
 * - Depth fog aura behind tiles
 * - Chromatic ghost trails (subtle colored rings)
 * - Breathing core glow + reactive peak halo
 * - Smooth audio-driven animation with exponential smoothing
 * - Motion One (motion/react) friendly
 *
 * Drop into components/app/tile-layout.tsx replacing your old file.
 */

/* ------------------------------
   Motion + animation config
   ------------------------------ */
const ANIMATION_TRANSITION = {
  duration: 0.36,
  easing: [0.25, 0.46, 0.45, 0.94], // soft ease-out
};

/* ------------------------------
   Layout class map (kept same)
   ------------------------------ */
const classNames = {
  grid: [
    'h-full w-full',
    'grid gap-x-2 place-content-center',
    'grid-cols-[1fr_1fr] grid-rows-[90px_1fr_90px]',
  ],
  agentChatOpenWithSecondTile: ['col-start-1 row-start-1', 'self-center justify-self-end'],
  agentChatOpenWithoutSecondTile: ['col-start-1 row-start-1', 'col-span-2', 'place-content-center'],
  agentChatClosed: ['col-start-1 row-start-1', 'col-span-2 row-span-3', 'place-content-center'],
  secondTileChatOpen: ['col-start-2 row-start-1', 'self-center justify-self-start'],
  secondTileChatClosed: ['col-start-2 row-start-3', 'place-content-end'],
};

/* ------------------------------
   Helpers: local track ref
   ------------------------------ */
export function useLocalTrackRef(source: Track.Source) {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(source);
  const trackRef = useMemo<TrackReference | undefined>(
    () => (publication ? { source, participant: localParticipant, publication } : undefined),
    [source, publication, localParticipant]
  );
  return trackRef;
}

/* ------------------------------
   TileLayout component
   ------------------------------ */
interface TileLayoutProps {
  chatOpen: boolean;
}

export function TileLayout({ chatOpen }: TileLayoutProps) {
  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
  } = useVoiceAssistant();

  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);

  const isCameraEnabled = !!(cameraTrack && !cameraTrack.publication.isMuted);
  const isScreenShareEnabled = !!(screenShareTrack && !screenShareTrack.publication.isMuted);
  const hasSecondTile = isCameraEnabled || isScreenShareEnabled;

  const isAvatar = !!agentVideoTrack;
  const videoWidth = agentVideoTrack?.publication.dimensions?.width ?? 0;
  const videoHeight = agentVideoTrack?.publication.dimensions?.height ?? 0;

  /* ------------------------------
     Reactive deep glow engine
     - smoothed level from agentState
     - hue drift + spectrum bending
     - layered glow parameters computed here
  ------------------------------ */
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef(0);
  const hueRef = useRef(240);
  const [glow, setGlow] = useState({
    h: 240,
    intensity: 0.05,
    pulse: 0.0, // peak pulse 0..1
  });

  // best-effort extractor for numeric level
  function extractLevel(state: any): number {
    if (!state) return 0;
    // try common fields; prefer normalized 0..1
    const cand = state.level ?? state.volume ?? state.rms ?? state.energy ?? state.gain ?? 0;
    const n = Number(cand) || 0;
    // if likely in 0..100 range, normalize
    if (n > 1 && n <= 100) return Math.min(1, n / 100);
    return Math.max(0, Math.min(1, n));
  }

  useEffect(() => {
    let last = performance.now();

    function frame(ts: number) {
      const dt = Math.min(50, ts - last);
      last = ts;

      const raw = extractLevel(agentState);
      // adaptive smoothing: faster when dt larger
      const alpha = Math.min(0.22, dt / 300);
      smoothedRef.current = smoothedRef.current * (1 - alpha) + raw * alpha;

      // intensity mapping: amplify and curve it
      const base = Math.pow(smoothedRef.current, 0.9) * 1.5; // amplify a bit
      const chatFactor = chatOpen ? 1.05 : 0.92;
      const secondTileFactor = hasSecondTile ? 1.0 : 1.12;
      const intensity = Math.min(1, base * chatFactor * secondTileFactor);

      // pulse reacts to peaks (short decay)
      const peak = raw - smoothedRef.current;
      const peakPulse = Math.max(0, peak * 6); // quick spike multiplier

      // hue drift: slow rotation + map intensity to shift
      const timeHue = (ts / 300) % 360;
      const targetHue = (210 + timeHue + intensity * 160) % 360; // base bluish + shift
      // smooth hue ref
      hueRef.current += (targetHue - hueRef.current) * 0.07;

      setGlow({
        h: Math.round(hueRef.current),
        intensity: Math.max(0.02, Math.min(0.98, intensity)),
        pulse: Math.max(0, Math.min(1, glow.pulse ? glow.pulse * 0.92 + peakPulse * 0.08 : peakPulse)),
      });

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentState, chatOpen, hasSecondTile]);

  /* ------------------------------
     Compute multi-layered glow style (volumetric)
     - layer1: inner soft core (small, bright)
     - layer2: mid glow (spread)
     - layer3: outer aura (very soft)
     - halo: peak ring (animated on pulse)
     - fog: subtle radial gradient behind tile (div element)
  ------------------------------ */
  const glowStyle = useMemo(() => {
    const { h, intensity, pulse } = glow;

    // parameters derived from intensity
    const coreBlur = Math.round(6 + intensity * 18); // px
    const coreSpread = Math.round(2 + intensity * 8);
    const midBlur = Math.round(14 + intensity * 42);
    const midSpread = Math.round(10 + intensity * 36);
    const outerBlur = Math.round(40 + intensity * 140);
    const outerSpread = Math.round(20 + intensity * 80);

    const coreAlpha = Math.max(0.06, intensity * 0.7);
    const midAlpha = Math.max(0.03, intensity * 0.45);
    const outerAlpha = Math.max(0.008, intensity * 0.22);
    const haloAlpha = Math.max(0.02, pulse * 0.9);

    const color1 = `hsl(${h} 92% 60% / ${coreAlpha})`;
    const color2 = `hsl(${(h + 55) % 360} 88% 54% / ${midAlpha})`;
    const color3 = `hsl(${(h + 120) % 360} 80% 48% / ${outerAlpha})`;
    const haloColor = `hsl(${(h + 30) % 360} 95% 60% / ${haloAlpha})`;

    // combined box-shadow
    const boxShadow = [
      `0 0 ${coreBlur}px ${coreSpread}px ${color1}`,
      `0 0 ${midBlur}px ${midSpread}px ${color2}`,
      `0 0 ${outerBlur}px ${outerSpread}px ${color3}`,
      // small inset glow to create 3D inward light
      `inset 0 1px ${Math.max(1, coreBlur / 6)}px rgba(255,255,255,${Math.min(0.06, coreAlpha * 0.12)})`,
    ].join(', ');

    // halo ring (animated via transform on element)
    const haloStyle = {
      boxShadow: `0 0 ${Math.max(8, pulse * 48)}px ${Math.round(6 + pulse * 22)}px ${haloColor}`,
      opacity: Math.min(1, 0.9 * pulse + intensity * 0.3),
      transform: `scale(${1 + pulse * 0.18})`,
    };

    // background fog gradient behind tile (used in separate element)
    const fogStyle = {
      background: `radial-gradient( circle at 50% 40%, hsla(${h},90%,60%,${Math.min(0.18, midAlpha * 0.9)}), transparent 30% )`,
      filter: `blur(${Math.round(8 + intensity * 24)}px)`,
      opacity: Math.min(1, 0.35 + intensity * 0.6),
    };

    return {
      boxShadow,
      haloStyle,
      fogStyle,
      // expose css vars
      ['--glow-h' as any]: h,
      ['--glow-i' as any]: intensity,
      ['--glow-p' as any]: pulse,
    } as {
      boxShadow: string;
      haloStyle: React.CSSProperties;
      fogStyle: React.CSSProperties;
      [k: string]: any;
    };
  }, [glow]);

  /* ------------------------------
     Simple tile classes (kept UX)
  ------------------------------ */
  return (
    <div className="pointer-events-none fixed inset-x-0 top-8 bottom-32 z-50 md:top-12 md:bottom-40">
      <div className="relative mx-auto h-full max-w-2xl px-4 md:px-0">
        <div className={cn(classNames.grid)}>
          {/* AGENT AREA */}
          <div
            className={cn([
              'grid',
              !chatOpen && classNames.agentChatClosed,
              chatOpen && hasSecondTile && classNames.agentChatOpenWithSecondTile,
              chatOpen && !hasSecondTile && classNames.agentChatOpenWithoutSecondTile,
            ])}
          >
            <AnimatePresence mode="popLayout">
              {!isAvatar && (
                <div className="relative">
                  {/* volumetric fog behind tile */}
                  <div
                    aria-hidden
                    style={{
                      ...glowStyle.fogStyle,
                      position: 'absolute',
                      inset: '-22% -18% auto -18%',
                      zIndex: 0,
                      borderRadius: 16,
                      pointerEvents: 'none',
                    }}
                  />
                  <MotionContainer
                    key="agent-audio"
                    layoutId="agent"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ ...ANIMATION_TRANSITION }}
                    style={{
                      boxShadow: glowStyle.boxShadow,
                      borderRadius: 12,
                      zIndex: 10,
                    }}
                    className={cn(
                      'bg-background aspect-square h-[90px] rounded-xl border border-transparent transition-all duration-300',
                      chatOpen ? 'drop-shadow-2xl' : 'drop-shadow-md'
                    )}
                  >
                    {/* halo ring element (absolute) */}
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        zIndex: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '88%',
                          height: '88%',
                          borderRadius: 12,
                          ...glowStyle.haloStyle,
                          transition: 'transform 160ms linear, opacity 160ms linear, box-shadow 200ms linear',
                        }}
                      />
                    </div>

                    <BarVisualizer
                      barCount={5}
                      state={agentState}
                      options={{ minHeight: 5 }}
                      trackRef={agentAudioTrack}
                      className={cn('flex h-full items-center justify-center gap-1 relative z-20')}
                    >
                      <span
                        className={cn([
                          'bg-muted min-h-2.5 w-2.5 rounded-full',
                          'origin-center transition-colors duration-250 linear',
                          'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
                        ])}
                      />
                    </BarVisualizer>
                  </MotionContainer>
                </div>
              )}

              {isAvatar && (
                <div className="relative">
                  {/* volumetric fog behind avatar */}
                  <div
                    aria-hidden
                    style={{
                      ...glowStyle.fogStyle,
                      position: 'absolute',
                      inset: '-18% -14% auto -14%',
                      zIndex: 0,
                      borderRadius: chatOpen ? 8 : 16,
                      pointerEvents: 'none',
                    }}
                  />

                  <MotionContainer
                    key="agent-avatar"
                    layoutId="avatar"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ ...ANIMATION_TRANSITION }}
                    style={{
                      boxShadow: glowStyle.boxShadow,
                      borderRadius: chatOpen ? 6 : 12,
                      zIndex: 10,
                      overflow: 'hidden',
                    }}
                    className={cn(
                      'overflow-hidden bg-black rounded-xl transition-all duration-300',
                      chatOpen ? 'h-[90px]' : 'h-auto w-full'
                    )}
                  >
                    {/* chromatic ghost overlay (very subtle) */}
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 9,
                        mixBlendMode: 'screen',
                        opacity: Math.min(0.28, 0.08 + glow.intensity * 0.5),
                        background:
                          `radial-gradient( circle at 10% 20%, hsla(${(glow.h + 10) % 360}, 95%, 60%, ${0.14 * glow.intensity}), transparent 20% ),
                           radial-gradient( circle at 80% 80%, hsla(${(glow.h + 160) % 360}, 85%, 50%, ${0.09 * glow.intensity}), transparent 18% )`,
                        filter: 'blur(6px)',
                      }}
                    />
                    <VideoTrack
                      width={videoWidth}
                      height={videoHeight}
                      trackRef={agentVideoTrack}
                      className={cn(chatOpen && 'w-[90px] h-[90px] object-cover')}
                    />
                  </MotionContainer>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* SECOND TILE: CAMERA / SCREEN SHARE */}
          <div
            className={cn([
              'grid',
              chatOpen && classNames.secondTileChatOpen,
              !chatOpen && classNames.secondTileChatClosed,
            ])}
          >
            <AnimatePresence>
              {((cameraTrack && isCameraEnabled) || (screenShareTrack && isScreenShareEnabled)) && (
                <MotionContainer
                  key="camera"
                  layout="position"
                  layoutId="camera"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ ...ANIMATION_TRANSITION }}
                  style={{
                    boxShadow: glowStyle.boxShadow,
                    borderRadius: 10,
                    zIndex: 5,
                  }}
                  className="rounded-xl overflow-hidden"
                >
                  <VideoTrack
                    trackRef={cameraTrack || screenShareTrack}
                    width={(cameraTrack || screenShareTrack)?.publication.dimensions?.width ?? 0}
                    height={(cameraTrack || screenShareTrack)?.publication.dimensions?.height ?? 0}
                    className="bg-muted aspect-square w-[90px] rounded-md object-cover"
                  />
                </MotionContainer>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Inline styles for small animations & reduced-motion support */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .motion-container, .animate-presence, .motion-create { animation: none !important; transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
