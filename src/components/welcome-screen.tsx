// src/components/welcome-screen.tsx
"use client";

import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { FolderSearch, Github, FileArchive, Gamepad2, FilePlus } from 'lucide-react';
import { CloneRepositoryDialog } from './clone-repository-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onCloneRepository: (url: string) => Promise<boolean>;
  onAddZipToVfs: (file: File) => void;
  onCreateBlankProject: () => void;
}

export function WelcomeScreen({ onOpenFolder, onCloneRepository, onAddZipToVfs, onCreateBlankProject }: WelcomeScreenProps) {
  const [isCloneDialogOpen, setIsCloneDialogOpen] = React.useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddZipToVfs(e.target.files[0]);
    }
    if (e.target) {
      e.target.value = '';
    }
  };
  
  const handleCreateProject = (lang: string) => {
    toast({
        title: "Coming Soon!",
        description: `Project templates for ${lang} are not yet implemented.`
    });
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold font-headline tracking-tight">Welcome to WebCoder.ai</h1>
            <p className="text-lg text-muted-foreground mt-2">Your AI-powered development environment in the cloud.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Start a Project</CardTitle>
                    <CardDescription>Open a local folder or create something new.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-center gap-4">
                     <Button variant="outline" size="lg" onClick={onOpenFolder}>
                        <FolderSearch className="mr-2"/> Open Folder
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => zipInputRef.current?.click()}>
                        <FileArchive className="mr-2"/> Open a .zip file
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => setIsCloneDialogOpen(true)}>
                        <Github className="mr-2"/> Clone Repository
                    </Button>
                    <input type="file" ref={zipInputRef} onChange={handleZipChange} className="hidden" accept=".zip" />
                </CardContent>
            </Card>

            <Card className="flex flex-col">
                 <CardHeader>
                    <CardTitle>Create New</CardTitle>
                    <CardDescription>Start from a blank slate or a template.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-center gap-4">
                    <Button onClick={onCreateBlankProject} variant="outline" size="lg">
                        <FilePlus className="mr-2"/> Blank Project
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <Link href="/nocode">
                          <Gamepad2 className="mr-2"/> New No-Code Game
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
       <CloneRepositoryDialog 
        open={isCloneDialogOpen} 
        onOpenChange={setIsCloneDialogOpen}
        onClone={onCloneRepository}
      />
    </div>
  );
}
