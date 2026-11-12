import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import { ToastProvider } from '@/components/ui/toast';
import { StartLights } from '@/components/fx/StartLights';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Fantasy League F1',
  description: 'Crée ton écurie, drafté tes pilotes, domine tes potes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className={`${sans.variable} ${mono.variable} font-sans`}>
        <StartLights />
        <div className="relative z-10">
          <AuthProvider>
            <ToastProvider>
              <Navbar />
              <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
            </ToastProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
