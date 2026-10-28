import { BookOpen, Check, Compass } from "lucide-react";
import { POLICY_SECTIONS, POLICIES_VERSION } from "@/lib/policies";

/**
 * Policies — the policies & procedures KW Innovations follows with every
 * client. The same wording clients accept in their portal orientation
 * (lib/policies.ts), so the team and clients always read the same thing.
 */
export default function PoliciesPage() {
  return (
    <div style={{ padding: "2rem", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
        <BookOpen size={22} color="var(--accent)" />
        <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Policies</h1>
      </div>
      <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        The policies and procedures we follow with every client. Clients read and accept these in the
        orientation on their portal&apos;s Welcome tab. A client&apos;s signed proposal or agreement takes precedence.
      </p>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.8rem 1rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
        <Compass size={15} color="var(--accent)" />
        <span style={{ flex: 1 }}>
          Version <strong>{POLICIES_VERSION}</strong>. Changing the wording in <code>src/lib/policies.ts</code> and bumping the
          version asks every client to accept again.
        </span>
      </div>
      <div style={{ display: "grid", gap: "1rem" }}>
        {POLICY_SECTIONS.map((p) => (
          <div key={p.key} className="card" style={{ padding: "1.1rem 1.25rem" }}>
            <h2 style={{ fontSize: "1.02rem", fontWeight: 800, marginBottom: "0.25rem" }}>{p.title}</h2>
            <p style={{ fontSize: "0.84rem", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "0.6rem" }}>{p.summary}</p>
            <ul style={{ display: "grid", gap: "0.45rem", listStyle: "none", padding: 0, margin: 0 }}>
              {p.points.map((pt) => (
                <li key={pt} style={{ display: "flex", gap: "0.5rem", fontSize: "0.84rem", lineHeight: 1.55 }}>
                  <Check size={14} color="#10b981" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
