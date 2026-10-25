import { LogoMark } from "@/components/Logo";

export default function HubLoading() {
  return (
    <div className="route-loader" role="status" aria-label="Loading">
      <LogoMark size={44} spin style={{ borderRadius: 12, boxShadow: "0 10px 30px rgba(79,70,229,0.25)" }} />
      <div className="splash-bar"><span /></div>
    </div>
  );
}
