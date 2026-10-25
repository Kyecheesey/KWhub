"use client";

import { useId } from "react";

/* Set by the login page so the hub fades in from the loading screen after sign-in */
export const SPLASH_HANDOFF_KEY = "kwi:splash-handoff";

/* KWI ONE brand mark — the same artwork as src/app/icon.svg (the favicon). */
export function LogoMark({ size = 34, spin = false, className, style }: {
  size?: number; spin?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      width={size} height={size} viewBox="0 0 128 128" aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, display: "block", ...style }}
    >
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#151d45" />
          <stop offset="1" stopColor="#070a1c" />
        </linearGradient>
        <linearGradient id={`${uid}ring`} x1="20" y1="108" x2="108" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill={`url(#${uid}bg)`} />
      <g className={spin ? "logo-orbit" : undefined} style={{ transformOrigin: "64px 64px" }}>
        <path d="M95.2 45.9 A38 38 0 1 1 82 30.1" fill="none" stroke={`url(#${uid}ring)`} strokeWidth="11" strokeLinecap="round" />
        <circle cx="96.5" cy="31.5" r="6.5" fill="#c084fc" />
      </g>
      <path d="M55 49.5 L67.5 41 H75 V87 H64 V55.5 L58.5 59 Z" fill="#ffffff" />
    </svg>
  );
}

/* Mark + "KWI ONE" wordmark */
export function Logo({ size = 34, sub, dark = false }: { size?: number; sub?: string; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      <LogoMark size={size} style={{ borderRadius: size * 0.234, boxShadow: "0 4px 14px rgba(79,70,229,0.28)" }} />
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontWeight: 900, fontSize: size * 0.44, letterSpacing: "0.02em",
          color: dark ? "#ffffff" : "var(--text-1)", whiteSpace: "nowrap",
        }}>
          KWI <span className="grad-text-brand">ONE</span>
        </div>
        {sub && (
          <div style={{
            fontSize: Math.max(9.5, size * 0.28), fontWeight: 600, marginTop: size * 0.09,
            color: dark ? "rgba(255,255,255,0.55)" : "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

/* Full-screen branded loading screen (sign-in hand-off, first paint) */
export function SplashScreen({ message, leaving = false }: { message?: string; leaving?: boolean }) {
  return (
    <div className={`splash${leaving ? " splash-leaving" : ""}`} role="status" aria-live="polite">
      <div className="splash-aurora" />
      <div className="splash-inner">
        <div className="splash-mark">
          <span className="splash-halo" />
          <LogoMark size={84} spin style={{ borderRadius: 22, boxShadow: "0 20px 60px rgba(99,102,241,0.45)" }} />
        </div>
        <div className="splash-word">KWI <span className="grad-text-brand">ONE</span></div>
        <div className="splash-bar"><span /></div>
        <p className="splash-msg">{message ?? "Loading your workspace…"}</p>
      </div>
    </div>
  );
}
