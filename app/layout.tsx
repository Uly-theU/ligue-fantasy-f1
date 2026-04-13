import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fantasy League F1',
  description: 'Crée ton écurie, drafté tes pilotes, domine tes potes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
