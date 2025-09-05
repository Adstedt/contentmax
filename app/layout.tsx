import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { MonitoringProvider } from '@/components/providers/monitoring-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ContentMax - AI-Powered E-commerce Content Management',
  description: 'Automate content generation and management for e-commerce sites at scale',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <MonitoringProvider>{children}</MonitoringProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
