// src/app/synthesis-runner/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SYNTHESIS App Runner',
  description: 'Running a SYNTHESIS application.',
};

export default function RunnerLayout({
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
