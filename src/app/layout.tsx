import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Duo — Project-Based Learning',
  description: 'แพลตฟอร์มการเรียนรู้แบบโปรเจกต์',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signUpFallbackRedirectUrl="/onboarding">
      <html lang="th" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
