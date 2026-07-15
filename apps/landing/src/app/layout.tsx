import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BehaviorOS — The Operating System for Autonomous AI Teams',
  description:
    'Open-source behavioral governance framework for AI agent teams. 9-layer architecture, 30+ MCP tools, DNA patterns, EU AI Act ready.',
  creator: 'Ilvan Joaquim',
  openGraph: {
    title: 'BehaviorOS — The Operating System for Autonomous AI Teams',
    description:
      'Open-source behavioral governance framework for AI agent teams. 9-layer architecture, 30+ MCP tools, DNA patterns, EU AI Act ready.',
    type: 'website',
    url: 'https://behavioros.dev',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
