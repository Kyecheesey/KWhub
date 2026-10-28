import { Outfit, Open_Sans } from "next/font/google";

// The portal matches kwinnovations.com.au: Outfit for text, Open Sans for the wordmark
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], weight: ["300", "700", "800"] });

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`kwp ${outfit.variable} ${openSans.variable}`} style={{ flex: 1, minWidth: 0, minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {children}
    </div>
  );
}
