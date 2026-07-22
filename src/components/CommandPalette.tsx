"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Users, Target } from "lucide-react";
import { flatNavItems } from "@/lib/nav";

interface RecordHit {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status?: string;
}

type PaletteItem = {
  kind: "page" | "client" | "potential";
  key: string;
  label: string;
  sub?: string;
  href: string;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
};

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal: "Proposal", won: "Won", lost: "Lost",
};

export default function CommandPalette({
  open,
  onClose,
  isKye,
}: {
  open: boolean;
  onClose: () => void;
  isKye: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const [records, setRecords] = useState<{ clients: RecordHit[]; potentials: RecordHit[] }>({ clients: [], potentials: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setRecords({ clients: [], potentials: [] });
    }
  }

  const navItems = useMemo(() => flatNavItems(isKye), [isKye]);

  // Debounced record search
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setRecords({ clients: [], potentials: [] });
        return;
      }
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => setRecords({ clients: data.clients ?? [], potentials: data.potentials ?? [] }))
        .catch(() => setRecords({ clients: [], potentials: [] }));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: PaletteItem[] = navItems
      .filter((item) => !q || `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(q))
      .map((item) => ({ kind: "page", key: `page-${item.href}`, label: item.label, href: item.href, icon: item.icon }));
    const clients: PaletteItem[] = records.clients.map((c) => ({
      kind: "client", key: `client-${c.id}`, label: c.business_name,
      sub: c.contact_name ?? c.phone ?? c.email ?? undefined,
      href: `/clients?q=${encodeURIComponent(c.business_name)}`, icon: Users,
    }));
    const potentials: PaletteItem[] = records.potentials.map((p) => ({
      kind: "potential", key: `potential-${p.id}`, label: p.business_name,
      sub: [p.status ? STAGE_LABELS[p.status] ?? p.status : null, p.contact_name].filter(Boolean).join(" · ") || undefined,
      href: `/potentials?q=${encodeURIComponent(p.business_name)}`, icon: Target,
    }));
    return [...pages, ...clients, ...potentials];
  }, [navItems, query, records]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function go(item: PaletteItem) {
    router.push(item.href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) go(item);
    }
  }

  if (!open) return null;

  const KIND_LABEL: Record<PaletteItem["kind"], string> = {
    page: "Pages", client: "Clients", potential: "Potentials",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(34,26,61,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "12vh 1rem 1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%", maxWidth: 560,
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
          <Search size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search pages, clients, potentials…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-1)", fontSize: "0.95rem", letterSpacing: "-0.01em",
            }}
          />
          <kbd style={{
            fontSize: "0.68rem", fontWeight: 600, color: "var(--text-3)",
            background: "var(--surface-2)", border: "1px solid var(--border-2)",
            borderRadius: 5, padding: "0.15rem 0.4rem",
          }}>Esc</kbd>
        </div>

        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "0.5rem" }}>
          {results.length === 0 && (
            <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((item, i) => {
            const Icon = item.icon;
            const active = i === activeIndex;
            const showHeader = i === 0 || results[i - 1].kind !== item.kind;
            return (
              <div key={item.key}>
                {showHeader && (
                  <p style={{
                    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "var(--text-4)",
                    padding: "0.5rem 0.75rem 0.25rem",
                  }}>
                    {KIND_LABEL[item.kind]}
                  </p>
                )}
                <button
                  onClick={() => go(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "0.7rem",
                    padding: "0.65rem 0.75rem", borderRadius: 10, border: "none",
                    background: active ? "var(--surface-3)" : "transparent",
                    color: active ? "var(--text-1)" : "var(--text-2)",
                    cursor: "pointer", textAlign: "left", fontSize: "0.875rem",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.4 : 1.8} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                    {item.sub && (
                      <span style={{ color: "var(--text-3)", fontSize: "0.78rem" }}> — {item.sub}</span>
                    )}
                  </span>
                  {active && <CornerDownLeft size={13} strokeWidth={2} />}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "1rem",
          padding: "0.6rem 1.1rem", borderTop: "1px solid var(--border)",
          fontSize: "0.68rem", color: "var(--text-3)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <ArrowUp size={11} /><ArrowDown size={11} /> Navigate
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <CornerDownLeft size={11} /> Select
          </span>
          <span style={{ marginLeft: "auto" }}>Type 2+ letters to search records</span>
        </div>
      </div>
    </div>
  );
}
