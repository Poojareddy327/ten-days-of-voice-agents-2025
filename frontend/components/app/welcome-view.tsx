import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/livekit/button';

/**
 * Cinematic Neon WelcomeView
 * - Prefill: POOJITHA (ALL CAPS)
 * - No external libs; uses Canvas + SVG + CSS for motion
 * - Themeable via CSS variables at top
 *
 * Usage: replace your current WelcomeView with this component.
 */

function NeonTitle({ name = 'POOJITHA' }: { name?: string }) {
  return (
    <div className="relative select-none pointer-events-none z-20">
      {/* SVG neon text with glow & chromatic aberration */}
      <svg viewBox="0 0 1200 220" className="w-full max-w-[1100px] h-auto">
        <defs>
          <filter id="neonBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="chromatic" x="-30%" y="-30%" width="160%" height="160%">
            <feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="base"/>
            <feGaussianBlur in="base" stdDeviation="0" result="b"/>
            <feOffset in="b" dx="-6" dy="0" result="r"/>
            <feOffset in="b" dx="6" dy="0" result="b"/>
            <feComposite in="r" in2="b" operator="xor" result="c"/>
            <feMerge>
              <feMergeNode in="c"/>
              <feMergeNode in="base"/>
            </feMerge>
          </filter>

          <linearGradient id="neonGrad" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>

          <mask id="scanlines">
            <rect width="100%" height="100%" fill="white" />
            <g opacity="0.06" fill="black">
              {Array.from({ length: 60 }).map((_, i) => (
                <rect key={i} x="0" y={i * 3.6} width="1200" height="1.2" />
              ))}
            </g>
          </mask>
        </defs>

        {/* Slight chromatic shadow behind text */}
        <g transform="translate(40,120)">
          <text
            x="0"
            y="0"
            fontSize="120"
            fontWeight="800"
            fontFamily="Inter, ui-sans-serif, system-ui, -apple-system"
            fill="url(#neonGrad)"
            style={{ filter: 'url(#neonBlur)' }}
          >
            {name}
          </text>
        </g>

        {/* main crisp text with slight stroke */}
        <g transform="translate(40,120)">
          <text
            x="0"
            y="0"
            fontSize="120"
            fontWeight="900"
            fontFamily="Inter, ui-sans-serif, system-ui, -apple-system"
            fill="none"
            stroke="rgba(255,255,255,0.96)"
            strokeWidth="1"
            paintOrder="stroke"
            style={{ mixBlendMode: 'screen' }}
          >
            {name}
          </text>

          <text
            x="0"
            y="0"
            fontSize="120"
            fontWeight="900"
            fontFamily="Inter, ui-sans-serif, system-ui, -apple-system"
            fill="url(#neonGrad)"
            style={{ mask: 'url(#scanlines)', WebkitMask: 'url(#scanlines)' }}
          >
            {name}
          </text>
        </g>
      </svg>
    </div>
  );
}

function RotatingLogo({ size = 96 }: { size?: number }) {
  return (
    <div className="w-[96px] h-[96px] rounded-xl flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)'
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="animate-spin-slow">
        <defs>
          <linearGradient id="logoG" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <g transform="translate(50,50)">
          <path d="M0,-28 A28,28 0 1,1 -1,-28 Z" fill="none" stroke="url(#logoG)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="0" cy="0" r="8" fill="url(#logoG)" />
        </g>
      </svg>
    </div>
  );
}

export const WelcomeView = React.forwardRef<HTMLDivElement, any>(({ startButtonText = 'LET\'S GO', onStartCall }, ref) => {
  const [name, setName] = useState('POOJITHA');
  const [started, setStarted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(false);

  useEffect(() => {
    // auto-focus not required; keep UX clean
  }, []);

  // Particle canvas (very lightweight)
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0, h = 0, dpr = Math.max(1, window.devicePixelRatio || 1);
    const particles: { x: number; y: number; r: number; vx: number; vy: number; hue: number; life: number }[] = [];

    function resize() {
      w = canvas.clientWidth * dpr;
      h = canvas.clientHeight * dpr;
      canvas.width = w;
      canvas.height = h;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function spawn() {
      const count = Math.max(16, Math.floor((w * h) / (38000)));
      while (particles.length < count) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.2 - Math.random() * 0.6,
          hue: Math.random() * 60 + 260,
          life: 60 + Math.random() * 140
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      // soft vignette
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dpr;
        p.y += p.vy * dpr;
        p.vy += (Math.random() - 0.5) * 0.02;
        p.life -= 1;
        if (p.y < -50 || p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${Math.max(0, p.life / 140)})`;
        ctx.ellipse(p.x, p.y, p.r * dpr, (p.r * 1.6) * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      spawn();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // mic waveform small visual & basic permission handling
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array | null = null;
    let raf = 0;

    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micRef.current = stream;
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArr = new Uint8Array(analyser.frequencyBinCount);

        const waveCanvas = document.getElementById('mic-wave') as HTMLCanvasElement | null;
        const ctx = waveCanvas?.getContext('2d');
        function drawWave() {
          if (!ctx || !analyser || !dataArr) return;
          analyser.getByteTimeDomainData(dataArr);
          const W = waveCanvas!.clientWidth;
          const H = waveCanvas!.clientHeight;
          waveCanvas!.width = W * (window.devicePixelRatio || 1);
          waveCanvas!.height = H * (window.devicePixelRatio || 1);
          ctx.clearRect(0, 0, waveCanvas!.width, waveCanvas!.height);
          ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
          ctx.strokeStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          for (let i = 0; i < dataArr.length; i++) {
            const v = dataArr[i] / 128.0;
            const x = (i / dataArr.length) * waveCanvas!.width;
            const y = (v * 0.5) * waveCanvas!.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          raf = requestAnimationFrame(drawWave);
        }
        raf = requestAnimationFrame(drawWave);
        setMicActive(true);
      } catch (e) {
        setMicActive(false);
      }
    }

    if (micActive) startMic();
    return () => {
      try {
        if (micRef.current) micRef.current.getTracks().forEach((t) => t.stop());
        if (audioCtx) audioCtx.close();
      } catch {}
      cancelAnimationFrame(raf);
    };
  }, [micActive]);

  function toggleMic() {
    setMicActive((s) => !s);
  }

  function handleStart() {
    setStarted(true);
    // dramatic pulse + voice cue
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`Welcome ${name}`);
        u.rate = 1.02;
        u.pitch = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch {}
    // call onStartCall after small transition
    setTimeout(() => onStartCall?.(name.trim()), 850);
  }

  return (
    <div
      ref={ref}
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#05060a] via-[#071027] to-[#02020a]"
      style={{
        // theme vars
        ['--accent' as any]: '#7C3AED',
        ['--accent-2' as any]: '#06B6D4'
      }}
      aria-live="polite"
    >
      {/* background canvas (particles) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full -z-10 opacity-80" aria-hidden />

      {/* large vignette + subtle film grain */}
      <div className="absolute inset-0 pointer-events-none -z-5">
        <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 3px)] opacity-5" />
      </div>

      {/* left hero: neon title + subtext */}
      <div className="max-w-[1400px] w-full flex gap-12 px-8 items-center z-20">
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <RotatingLogo />
            <div className="text-sm text-white/60 uppercase font-medium">Live • Improv • Stage</div>
          </div>

          <div>
            <NeonTitle name={name} />
            <p className="mt-4 max-w-2xl text-white/70 text-lg">
              Speak, play, and own the stage. Quick rounds — big laughs. Enter your stage name and press the start burst.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="relative">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                  border: '1px solid rgba(255,255,255,0.04)',
                  boxShadow: '0 8px 30px rgba(2,6,23,0.7)'
                }}
              >
                <div className="flex items-center gap-4">
                  <div style={{ width: 56, height: 56 }} className="rounded-lg flex items-center justify-center text-sm">
                    {/* small avatar letter */}
                    <div className="w-12 h-12 rounded-md flex items-center justify-center font-bold text-lg"
                      style={{ background: 'linear-gradient(90deg,var(--accent),var(--accent-2))', color: '#041024' }}>
                      P
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-sm font-semibold">Stage Name</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                      className="mt-1 bg-transparent w-full outline-none text-white placeholder:text-white/30 font-bold"
                      aria-label="Stage name"
                    />
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={toggleMic}
                      className="px-3 py-2 rounded-md text-sm font-semibold border border-white/8 bg-white/6 hover:bg-white/8 transition"
                      aria-pressed={micActive}
                      aria-label="Toggle mic"
                    >
                      {micActive ? 'Mic On' : 'Mic Off'}
                    </button>
                    <div className="mt-1 w-24 h-8 bg-white/3 rounded-md flex items-center justify-center">
                      {/* small waveform canvas */}
                      <canvas id="mic-wave" style={{ width: 96, height: 28 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="default"
              onClick={handleStart}
              className="px-6 py-3 rounded-2xl font-bold uppercase relative overflow-hidden"
              style={{
                background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                color: '#041024',
                boxShadow: '0 12px 40px rgba(7,12,34,0.6), 0 0 60px rgba(124,58,237,0.18)'
              }}
            >
              <span className="relative z-10">{startButtonText}</span>
              <span aria-hidden className="absolute -inset-0.5 rounded-2xl opacity-30" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.06))' }} />
            </Button>

            <button
              onClick={() => { setName('POOJITHA'); }}
              className="text-sm px-3 py-2 rounded-md bg-white/6 hover:bg-white/8 transition text-white/90"
            >
              Reset
            </button>
          </div>
        </div>

        {/* right visual: glass card with CTA + badges */}
        <aside className="w-[420px] flex-shrink-0">
          <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 18px 60px rgba(2,6,23,0.7)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/60">Next Round</div>
                <div className="text-2xl font-extrabold">Random Prompt • 45s</div>
              </div>
              <div>
                <div className="px-3 py-1 rounded-lg text-sm font-semibold" style={{ background: 'linear-gradient(90deg,var(--accent),var(--accent-2))', color: '#041024' }}>Popular</div>
              </div>
            </div>

            <div className="mt-4 text-white/70">
              <p>Get quick prompts from the deck — improv with friends and score laughs. Background will react if mic is on.</p>
            </div>

            <div className="mt-6 flex gap-3">
              <div className="flex-1">
                <div className="text-xs text-white/50">Players</div>
                <div className="text-lg font-bold">8</div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-white/50">Avg round</div>
                <div className="text-lg font-bold">00:45</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-white/3 text-center">
                <div className="text-xs text-white/60">Easy</div>
                <div className="font-bold">Yes</div>
              </div>
              <div className="p-3 rounded-lg bg-white/3 text-center">
                <div className="text-xs text-white/60">Voice</div>
                <div className="font-bold">Encouraged</div>
              </div>
              <div className="p-3 rounded-lg bg-white/3 text-center">
                <div className="text-xs text-white/60">Fun</div>
                <div className="font-bold">Guaranteed</div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs text-white/50">Share</div>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-2 rounded-md bg-white/6 hover:bg-white/8">Twitter</button>
              <button className="px-3 py-2 rounded-md bg-white/6 hover:bg-white/8">Link</button>
            </div>
          </div>
        </aside>
      </div>

      {/* Start burst visual (confetti + smoke + vignette) */}
      {started && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="text-white text-3xl font-extrabold animate-pop z-10">Let’s Jam — good luck!</div>
          <div className="absolute w-full h-full">
            {/* confetti pieces */}
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className={`confetti frag-${i}`} />
            ))}
          </div>

          <style>{`
            .animate-spin-slow { animation: spin 14s linear infinite; transform-origin: 50% 50%; }
            @keyframes spin { to { transform: rotate(360deg); } }

            @keyframes pop { 0% { transform: scale(.9); opacity:0 } 30% { transform: scale(1.03); opacity:1 } 100% { transform: scale(1); opacity:1 } }
            .animate-pop { animation: pop 700ms cubic-bezier(.2,.9,.2,1); }

            /* confetti */
            .confetti { position: absolute; width: 10px; height: 14px; border-radius: 2px; opacity: 0; transform: translateY(-10px) rotate(0deg); }
            ${Array.from({ length: 28 }).map((_, i) => {
              const left = Math.round(Math.random() * 100);
              const delay = (i % 7) * 60;
              const dur = 900 + (i % 9) * 100;
              const colors = ['#7C3AED','#06B6D4','#FB7185','#FDE68A','#60A5FA'];
              const color = colors[i % colors.length];
              const x = left;
              const rot = (i * 47) % 360;
              return `
                .confetti.frag-${i} { left: ${x}%; top: 10%; background: ${color}; animation: confetti-${i} ${dur}ms cubic-bezier(.2,.7,.2,1) ${delay}ms forwards; }
                @keyframes confetti-${i} {
                  0% { opacity: 1; transform: translateY(-10vh) rotate(${rot}deg) scale(1); }
                  60% { transform: translateY(${60 + (i%7)*20}vh) rotate(${rot + 360}deg) scale(1.05); opacity: 1; }
                  100% { transform: translateY(${120 + (i%9)*40}vh) rotate(${rot + 1080}deg) scale(.85); opacity: 0; }
                }
              `;
            }).join('\n')}
          `}</style>
        </div>
      )}
    </div>
  );
});

WelcomeView.displayName = 'WelcomeView';

