"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, ClipboardList, Hourglass, BellRing, X, MessageSquare } from "lucide-react";

export interface NotificationItem {
  id: string;
  type: "follow_up" | "task" | "stale" | "portal";
  title: string;
  detail: string;
  href: string;
  urgency: "high" | "medium" | "low";
}

const TYPE_ICON: Record<NotificationItem["type"], React.FC<{ size?: number }>> = {
  follow_up: CalendarClock,
  task: ClipboardList,
  stale: Hourglass,
  portal: MessageSquare,
};
const URGENCY_COLOR: Record<NotificationItem["urgency"], string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#8b95c0",
};

const POLL_MS = 90_000;

/** Single source of truth for notifications — call once in LayoutShell. */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const alertedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    function poll() {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data: NotificationItem[]) => {
          if (cancelled || !Array.isArray(data)) return;
          setItems(data);
          // Best-effort browser alerts for new high-urgency items while the app is open
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const item of data) {
              if (item.urgency !== "high" || alertedIds.current.has(item.id)) continue;
              alertedIds.current.add(item.id);
              try {
                new Notification(`KW Hub — ${item.detail}`, { body: item.title, tag: item.id });
              } catch {
                // Notification constructor can throw on some mobile browsers; ignore.
              }
            }
          }
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return items;
}

export function NotificationsBell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Notifications"
      style={{
        position: "relative", background: "none", border: "none", cursor: "pointer",
        color: count > 0 ? "var(--text-1)" : "var(--text-3)",
        padding: "0.4rem", borderRadius: 8, display: "flex",
      }}
    >
      <Bell size={17} />
      {count > 0 && (
        <span style={{
          position: "absolute", top: 0, right: 0,
          minWidth: 15, height: 15, borderRadius: 99,
          background: "#f87171", color: "#07090f",
          fontSize: "0.58rem", fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 3px", lineHeight: 1,
        }}>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

export function NotificationsPanel({
  items, open, onClose,
}: {
  items: NotificationItem[]; open: boolean; onClose: () => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      Promise.resolve().then(() => setPermission(Notification.permission));
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 349 }} />
      <div style={{
        position: "fixed", top: 64, left: 12, zIndex: 350,
        width: "min(380px, calc(100vw - 24px))",
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 16, boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-1)" }}>Notifications</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {permission === "default" && (
              <button
                onClick={() => Notification.requestPermission().then(setPermission)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)",
                  background: "rgba(45,212,232,0.08)", border: "1px solid rgba(45,212,232,0.2)",
                  borderRadius: 7, padding: "0.25rem 0.55rem", cursor: "pointer",
                }}
              >
                <BellRing size={11} /> Enable alerts
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.25rem", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {items.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>✅</div>
              <p style={{ color: "var(--text-2)", fontSize: "0.85rem", fontWeight: 600 }}>All caught up</p>
              <p style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>No overdue follow-ups, tasks or stale leads.</p>
            </div>
          ) : items.map((item) => {
            const Icon = TYPE_ICON[item.type];
            const color = URGENCY_COLOR[item.urgency];
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "0.65rem",
                  padding: "0.7rem 1rem", borderBottom: "1px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                  background: `${color}14`, border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", color,
                }}>
                  <Icon size={13} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "0.73rem", color }}>{item.detail}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
