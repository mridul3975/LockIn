import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

import SessionProviderWrapper from '@/components/SessionProviderWrapper';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LockIn // Habit & Productivity Tracker',
  description: 'High-performance, dark-themed cyber productivity matrix & sleep monitor.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} bg-background text-foreground antialiased min-h-screen relative overflow-x-hidden`}>
        {/* Glowing background elements for the premium layout */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-glow-gradient pointer-events-none z-0" />
        <div className="relative z-10">
          <SessionProviderWrapper>
            {children}
          </SessionProviderWrapper>
        </div>
      </body>
    </html>
  );
}
