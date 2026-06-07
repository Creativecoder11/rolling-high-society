import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

const ogImage =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5f57f1cb-3a47-4380-b083-507a7ceb8563/id-preview-a0a725f8--a49ccebe-576f-46f8-9c49-3d938bed9a9b.lovable.app-1779689750750.png";

export const metadata: Metadata = {
  title: "Rolling High Society",
  description: "Manage group cigarette sharing, dues and payments.",
  openGraph: {
    title: "Rolling High Society",
    description: "Manage group cigarette sharing, dues and payments.",
    images: [ogImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rolling High Society",
    description: "Manage group cigarette sharing, dues and payments.",
    images: [ogImage],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
