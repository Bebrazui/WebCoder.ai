// src/app/nocode/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'No-Code Game Editor',
  description: 'Create simple 2D games without writing any code.',
};

export default function NoCodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
