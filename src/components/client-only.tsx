// src/components/client-only.tsx
"use client";

import { useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
}

/**
 * A wrapper component that ensures its children are only rendered on the client-side,
 * after the initial hydration is complete. This is useful for preventing hydration
 * mismatch errors with components that rely on browser-specific APIs or state.
 */
export function ClientOnly({ children }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
