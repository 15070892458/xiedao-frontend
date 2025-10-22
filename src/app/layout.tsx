import type { Metadata, Viewport } from "next";
import { UserProvider } from "@/contexts/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "说到，写道",
  description: "Voice agent powering AI writing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
      // className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
