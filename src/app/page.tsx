// src/app/page.tsx
"use client";

import { Ide } from "@/components/ide";
import { WelcomeScreen } from "@/components/welcome-screen";
import { useVfs } from "@/hooks/use-vfs";
import { Skeleton } from "@/components/ui/skeleton";
import { LoaderCircle } from "lucide-react";

export default function Home() {
  const vfs = useVfs();

  if (vfs.loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary mb-4" />
        <h1 className="text-lg font-semibold text-foreground">Loading Project...</h1>
        <p className="text-sm text-muted-foreground">Please wait while we set up your environment.</p>
      </div>
    );
  }

  // Check if it's the default "empty" project which means nothing is loaded.
  const isDefaultProject = 
    vfs.vfsRoot.children.length === 1 &&
    vfs.vfsRoot.children[0].name === 'welcome.md';

  if (isDefaultProject) {
    // Render ONLY the welcome screen if no project is loaded
    return (
      <main>
        <h1 className="sr-only">WebCoder.ai - Project Hub</h1>
        <WelcomeScreen
          onOpenFolder={vfs.openFolderWithApi}
          onCloneRepository={vfs.cloneRepository}
          onCreateNoCodeProject={vfs.createNoCodeHProject}
          onAddZipToVfs={vfs.addZipToVfs}
        />
      </main>
    );
  }

  // If a project is loaded, show the full IDE
  return (
    <main className="overflow-hidden h-screen">
      <h1 className="sr-only">WebCoder.ai - A web-based IDE with AI-powered code transformation</h1>
      <Ide vfs={vfs} />
    </main>
  );
}
