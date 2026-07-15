export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {children}
    </div>
  );
}
