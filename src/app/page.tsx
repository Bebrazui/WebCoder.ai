// src/app/page.tsx
"use client";

import { Ide } from "@/components/ide";
import { WelcomeScreen } from "@/components/welcome-screen";
import { useVfs } from "@/hooks/use-vfs";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const vfs = useVfs();

  if (vfs.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-32 w-32" />
      </div>
    );
  }

  // Check if it's the default "empty" project
  const isDefaultProject = 
    vfs.vfsRoot.children.length === 1 &&
    vfs.vfsRoot.children[0].name === 'welcome.md';

  if (isDefaultProject) {
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
