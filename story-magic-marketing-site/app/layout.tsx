import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Story Magic — Transform Scripts into Cinematic Audio',
  description:
    'AI-powered platform that converts screenplays into professional-quality audio experiences with voice acting, music, ambience, and sound effects.',
  openGraph: {
    title: 'Story Magic',
    description: 'Transform Scripts into Cinematic Audio',
    url: 'https://www.storymagicapp.net',
    siteName: 'Story Magic',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
