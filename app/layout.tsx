import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { NextAuthSessionProvider } from '@/components/session-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Distill - Git Repository Intelligence',
  description: 'Branch-aware, commit-aware AI intelligence layer for Git repositories',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NextAuthSessionProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
