import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Creative approvals · Gordon Digital",
  description: "Review and approve creative from Gordon Digital.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/portal/app.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
