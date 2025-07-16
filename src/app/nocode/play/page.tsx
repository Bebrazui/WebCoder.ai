// src/app/nocode/play/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { NoCodeHGame, type LevelData } from '@/components/nocodeh-game';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PlayPage() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = localStorage.getItem('nocodeh-level-data');
      if (data) {
        setLevelData(JSON.parse(data));
      } else {
        setError("No level data found. Please create a level in the editor first.");
      }
    } catch (e) {
      console.error("Failed to load level data:", e);
      setError("Failed to load level data. It might be corrupted.");
    }
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8 text-center">
        <Gamepad2 className="mx-auto h-24 w-24 mb-6 text-destructive" />
        <h1 className="text-3xl font-bold">Error</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link href="/nocode" passHref>
            <Button className="mt-6">Back to Editor</Button>
        </Link>
      </div>
    );
  }

  if (!levelData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p>Loading level...</p>
      </div>
    );
  }

  return <NoCodeHGame levelData={levelData} />;
}
