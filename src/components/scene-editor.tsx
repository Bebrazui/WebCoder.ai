// src/components/scene-editor.tsx
"use client";

import React from 'react';
import type { VFSFile } from '@/lib/vfs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Film } from 'lucide-react';

interface SceneEditorProps {
  file: VFSFile;
}

export function SceneEditor({ file }: SceneEditorProps) {
  const sceneData = React.useMemo(() => {
    try {
      return JSON.parse(file.content);
    } catch (e) {
      return { name: "Invalid Scene File", error: "Could not parse JSON." };
    }
  }, [file.content]);

  return (
    <div className="h-full w-full bg-muted/30 p-4 flex items-center justify-center">
        <Card className="w-full max-w-2xl text-center">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                    <Film />
                    Scene Editor
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg">Editing: <span className="font-semibold text-primary">{sceneData.name || file.name}</span></p>
                <p className="text-muted-foreground mt-4">
                    This is where the visual scene editor will be. You'll be able to drag and drop objects, manipulate their properties, and design your game levels.
                </p>
                {sceneData.error && <p className="text-destructive mt-2">{sceneData.error}</p>}
            </CardContent>
        </Card>
    </div>
  );
}
