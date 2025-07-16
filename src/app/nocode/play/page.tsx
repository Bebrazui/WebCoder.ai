// src/app/nocode/play/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { NoCodeHGame, type LevelData } from '@/components/nocodeh-game';
import { Gamepad2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PlayPage() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const data = localStorage.getItem('nocodeh-level-data');
      if (data) {
        const parsedData = JSON.parse(data);
        // The game engine is now responsible for validation.
        // It will check for a player inside the game component.
        if(parsedData.grid && parsedData.size) {
            setLevelData(parsedData);
        } else {
            setError("Level data is invalid or corrupted.");
        }
      } else {
        setError("No level data found. Please create a level in the editor first.");
      }
    } catch (e) {
      console.error("Failed to load level data:", e);
      setError("Failed to load level data. It might be corrupted.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8 text-center">
        <LoaderCircle className="mx-auto h-24 w-24 mb-6 text-primary animate-spin" />
        <h1 className="text-3xl font-bold">Loading Level...</h1>
      </div>
    );
  }

  if (error || !levelData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8 text-center">
        <Alert variant="destructive" className="max-w-md">
            <Gamepad2 className="h-4 w-4" />
            <AlertTitle>Error Loading Game</AlertTitle>
            <AlertDescription>
                {error || "Could not load level data."}
            </AlertDescription>
        </Alert>
        <Link href="/nocode" passHref>
            <Button className="mt-6">Back to Editor</Button>
        </Link>
      </div>
    );
  }

  // The NoCodeHGame component will now handle its own internal state,
  // including checking if a player exists on the provided grid.
  return <NoCodeHGame initialLevelData={levelData} />;
}
