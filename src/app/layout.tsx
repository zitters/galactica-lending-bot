// src/app/layout.tsx — Root Layout
/* eslint-disable @next/next/no-page-custom-font */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Galactica Lending Bot | AI-Powered Bitcoin Credit',
  description: 'Autonomous AI lending agent using Bitcoin identity, Intercom Protocol credit scoring, and WDK self-custodial settlement.',
  keywords: ['Bitcoin', 'DeFi', 'Lending', 'AI', 'Tether', 'Intercom Protocol', 'WDK', 'TAP'],
  openGraph: {
    title: 'Galactica Lending Bot',
    description: 'Autonomous AI lending agent bridging Bitcoin identity with Tether-based lending.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cyber-bg text-cyber-text font-sans antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
