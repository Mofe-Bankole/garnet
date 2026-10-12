import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const ui = Geist({ variable: "--font-ui", subsets: ["latin"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });
const editorial = Instrument_Serif({ variable: "--font-editorial", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const description =
  "Garnet is a buyer agent that hires specialist agents within your budget, independently verifies what they deliver, and only then settles, recovers or escalates the payment.";

export const metadata: Metadata = {
  title: { default: "Garnet — Agents can transact. Every outcome should be provable.", template: "%s · Garnet" },
  description,
  applicationName: "Garnet",
  openGraph: {
    title: "Garnet — Agents can transact. Every outcome should be provable.",
    description,
    type: "website",
    siteName: "Garnet",
  },
  twitter: { card: "summary_large_image", title: "Garnet", description },
};

export const viewport: Viewport = { themeColor: "#19171B", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable} ${editorial.variable} antialiased`}>
      <body className="min-h-dvh bg-graphite text-ivory">{children}</body>
    </html>
  );
}
