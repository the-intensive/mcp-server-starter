import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'MCP Server',
  description: 'Model Context Protocol server',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
