"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Phone, Mail, MessageSquare, History,
  Plus, Pencil, Trash2, ArrowRightLeft, UserCircle2, PhoneOutgoing,
} from "lucide-react";

interface EventRow {
  id: number;
  action: string;
  detail: string | null;
  actor: string | null;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: React.FC<{ size?: number }>; color: string }> = {
  created:        { label: "Created",     icon: Plus,           color: "#36d399" },
  updated:        { label: "Updated",     icon: Pencil,         color: "#8b95c0" },
  deleted:        { label: "Deleted",     icon: Trash2,         color: "#f87171" },
  stage_changed:  { label: "Stage",       icon: ArrowRightLeft, color: "#7c85f3" },
  status_changed: { label: "Status",      icon: ArrowRightLeft, color: "#7c85f3" },
  reassigned:     { label: "Reassigned",  icon: UserCircle2,    color: "#fbbf24" },
  contacted:      { label: "Contacted",   icon: PhoneOutgoing,  color: "#2dd4e8" },
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecordTimeline({
  entityType, entityId, entityName, phone, email,
}: {
  entityType: "client" | "potential";
  entityId: number;
  entityName: string;
  phone?: string | null;
  email?: string | null;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    return fetch(`/api/events?entity_type=${entityType}&entity_id=${entityId}&limit=30`)
      .then((res) => res.json())
      .then((data) => { setEvents(data); setLoaded(true); });
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events?entity_type=${entityType}&entity_id=${entityId}&limit=30`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) { setEvents(data); setLoaded(true); }
      });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  async function logContact(method: string) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_type: entityType, entity_id: entityId, entity_name: entityName,
        action: "contacted", detail: method,
      }),
    });
    load();
  }

  const quickActions = [
    phone && { label: "Call", icon: Phone, href: `tel:${phone}`, log: "Called" },
    phone && { label: "SMS", icon: MessageSquare, href: `sms:${phone}`, log: "Texted" },
    email && { label: "Email", icon: Mail, href: `mailto:${email}`, log: "Emailed" },
  ].filter(Boolean) as { label: string; icon: React.FC<{ size?: number }>; href: string; log: string }[];

  return (
    <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1.1rem" }}>
      {/* Contact quick actions */}
      {quickActions.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {quickActions.map(({ label, icon: Icon, href, log }) => (
            <a
              key={label}
              href={href}
              onClick={() => logContact(log)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                padding: "0.5rem 0.6rem", borderRadius: 9, textDecoration: "none",
                background: "rgba(45,212,232,0.08)", border: "1px solid rgba(45,212,232,0.2)",
                color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700,
              }}
            >
              <Icon size={13} /> {label}
            </a>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
        <History size={13} color="var(--text-3)" />
        <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>
          History
        </span>
      </div>
      {!loaded ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Loading…</p>
      ) : events.length === 0 ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>No history yet — changes will appear here.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", maxHeight: 200, overflowY: "auto" }}>
          {events.map((ev) => {
            const meta = ACTION_META[ev.action] ?? { label: ev.action, icon: Pencil, color: "#8b95c0" };
            const Icon = meta.icon;
            return (
              <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", padding: "0.35rem 0.2rem" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: meta.color,
                }}>
                  <Icon size={11} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-1)", fontWeight: 600 }}>{meta.label}</span>
                  {ev.detail && <span style={{ fontSize: "0.78rem", color: "var(--text-2)" }}> · {ev.detail}</span>}
                  <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                    {ev.actor ? `${ev.actor} · ` : ""}{timeAgo(ev.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
