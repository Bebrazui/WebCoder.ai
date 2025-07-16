// src/app/nocode/play/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { NoCodeHGame, type LevelData } from '@/components/nocodeh-game';
import { Gamepad2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useVfsForPage } from '@/hooks/use-vfs-for-page';

export default function PlayPage() {
  const { vfsRoot, loading: isVfsLoading } = useVfsForPage();
  const [projectData, setProjectData] = useState<any>(null);
  const [levelData, setLevelData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVfsLoading) return;

    try {
      if (!vfsRoot || vfsRoot.children.length === 0) {
        throw new Error("No project loaded.");
      }
      
      const gameConfigNode = vfsRoot.children.find(c => c.name === 'game.json');
      if (!gameConfigNode || gameConfigNode.type !== 'file') {
        throw new Error("`game.json` not found in the project root.");
      }
      const config = JSON.parse(gameConfigNode.content);
      setProjectData(config);

      // Find and parse the starting scene
      const scenePath = config.start_scene;
      const scenesDir = vfsRoot.children.find(c => c.type === 'directory' && c.name === 'scenes') as any;
      if (!scenesDir) {
          throw new Error("Could not find /scenes directory.");
      }
      const sceneNode = scenesDir.children.find((s: any) => s.path === scenePath);
      
      if (!sceneNode || sceneNode.type !== 'file') {
        throw new Error(`Start scene "${scenePath}" not found.`);
      }

      const scene = JSON.parse(sceneNode.content);
      setLevelData(scene);

    } catch (e: any) {
      console.error("Failed to load game data:", e);
      setError(`Failed to load game data: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, [isVfsLoading, vfsRoot]);

  if (isLoading || isVfsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8 text-center">
        <LoaderCircle className="mx-auto h-24 w-24 mb-6 text-purple-400 animate-spin" />
        <h1 className="text-3xl font-bold font-headline">Loading Level...</h1>
      </div>
    );
  }

  if (error || !levelData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8 text-center">
        <Alert variant="destructive" className="max-w-md bg-red-900/50 border-red-500 text-white">
            <Gamepad2 className="h-4 w-4" />
            <AlertTitle>Error Loading Game</AlertTitle>
            <AlertDescription>
                {error || "Could not load level data."}
            </AlertDescription>
        </Alert>
         <p className="mt-4 text-sm text-muted-foreground">This page loads the game from your saved project files.</p>
      </div>
    );
  }

  return <NoCodeHGame initialLevelData={levelData} />;
}
