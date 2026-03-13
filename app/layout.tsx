import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './providers';
import { SettingsProvider } from './settings-provider';
import { Sidebar } from '@/components/Sidebar';
import { DynamicFavicon } from '@/components/DynamicFavicon';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { LiveStreamWidget } from '@/components/LiveStreamWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { APP_NAME } from '@/lib/branding';

export const metadata: Metadata = {
  title: `${APP_NAME} -- Command Centre`,
  description: `${APP_NAME} AI Agent Management Dashboard`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <DynamicFavicon />
            <OnboardingWizard />
            <LiveStreamWidget />
            <div
              className="flex h-screen overflow-hidden"
              style={{ background: 'var(--bg)' }}
            >
              {/* Client-side shell handles both desktop sidebar + mobile */}
              <Sidebar />

              {/* Main content */}
              <main className="flex-1 overflow-hidden relative">
                {/* Mobile spacer for fixed header */}
                <div className="md:hidden" style={{ height: '48px', flexShrink: 0 }} />
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
