import { useId } from "react";

/* The KW | INNOVATIONS logo from kwinnovations.com.au's nav (light version).
   Styles live in globals.css under .kw-wordmark. */
export function KwiWordmark({ sub = "Client Portal" }: { sub?: string }) {
  const gid = `kwm-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="kw-wordmark">
      <svg className="kw-mark" viewBox="0 0 98 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#2a5bff" />
            <stop offset="1" stopColor="#4f8fff" />
          </linearGradient>
        </defs>
        <circle cx="6" cy="57" r="3.6" fill="#2f6bff" />
        <path d="M15 52 L33 18 Q38 9 43 18 L58 46 Q63 55 68 46 L84 16" stroke={`url(#${gid})`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 54 L64 12" stroke="#1b1d22" strokeWidth="7.5" strokeLinecap="round" />
        <circle cx="92" cy="8" r="3.6" fill="#1b1d22" />
      </svg>
      <span className="kw-text">
        <span className="kw-line">
          <span className="kw-kw">KW</span>
          <span className="kw-vr" />
          <span className="kw-inn">INNOVATIONS</span>
        </span>
        <span className="kw-sub">{sub}</span>
      </span>
    </span>
  );
}
