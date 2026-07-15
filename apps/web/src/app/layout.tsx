import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BehaviorOS — The Operating System for Autonomous AI Teams',
  description:
    'Mission control dashboard for your AI workforce. Governance, quality gates, audit trails, and behavioral DNA patterns.',
  creator: 'Ilvan Joaquim',
  metadataBase: new URL('https://behavioros.ai'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${plusJakarta.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TooltipProvider delay={300}>
          <Suspense>{children}</Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
