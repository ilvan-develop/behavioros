import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BehaviorOS - The Operating System for Autonomous AI Teams',
  description: 'Mission control for your AI workforce',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0a] text-[#fafafa] antialiased">{children}</body>
    </html>
  );
}
