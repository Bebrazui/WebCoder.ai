// src/app/page.tsx
"use client";

import { Ide } from "@/components/ide";
import { WelcomeScreen } from "@/components/welcome-screen";
import { useVfs } from "@/hooks/use-vfs";
import { LoaderCircle } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { useEffect } from "react";
import { createFile } from "@/lib/vfs";

// This new component will be rendered only on the client,
// ensuring useVfs() is not called on the server.
function VfsLoader() {
  const vfs = useVfs();

  // Create the To-Do app example file if it doesn't exist.
  useEffect(() => {
    if (!vfs.loading && !vfs.findFileByPath('/TodoApp.syn')) {
      const todoAppContent = `
struct Task {
    id: Int;
    title: String;
    isCompleted: Bool;
}

component TaskRow(task: Task, onToggle: (id: Int) => Void) {
    HStack(spacing: 10) {
        Checkbox(checked: task.isCompleted) {
            onToggle(id: task.id)
        }
        Text(task.title)
    }
}

component TodoApp() {
    @State tasks: [Task] = []
    @State newTaskTitle: String = ""

    @effect(tasks) {
        // This effect runs when the app starts, simulating a data fetch.
        // In a real app, this could be an API call.
        if (tasks.length == 0) {
           let initialTasks = [
                Task(id: 1, title: "Implement @effect", isCompleted: true),
                Task(id: 2, title: "Implement @binding", isCompleted: true),
                Task(id: 3, title: "Add ForEach component", isCompleted: false),
           ]
           tasks = initialTasks
        }
    }

    VStack(alignment: .leading, spacing: 15) {
        Text("SYNTHESIS Todo App")
            .font(.title)

        ForEach(tasks) { task in
            TaskRow(task: task, onToggle: { id in
                // Logic to toggle task completion
            })
        }

        HStack(spacing: 5) {
            TextField("Add a new task...", text: @binding newTaskTitle)
            Button("Add") {
                if (newTaskTitle != "") {
                    let newTask = Task(id: tasks.length + 1, title: newTaskTitle, isCompleted: false)
                    // This is a simplified way to append to an array
                    // A real implementation would have better array manipulation support.
                    tasks.push(newTask) 
                    newTaskTitle = ""
                }
            }
        }
    }
    .padding(20)
}

@main
func AppDelegate {
    Window("My Todo App") {
        TodoApp()
    }
}
`;
      vfs.createFileInVfs('TodoApp.syn', vfs.vfsRoot, todoAppContent);
    }
  }, [vfs.loading, vfs.findFileByPath, vfs.createFileInVfs, vfs.vfsRoot]);


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

  return (
    <>
      {isDefaultProject ? (
        // Render ONLY the welcome screen if no project is loaded
        <main>
          <h1 className="sr-only">WebCoder.ai - Project Hub</h1>
          <WelcomeScreen
            onOpenFolder={vfs.openFolderWithApi}
            onCloneRepository={vfs.cloneRepository}
            onAddZipToVfs={vfs.addZipToVfs}
            onCreateBlankProject={vfs.createBlankProject}
          />
        </main>
      ) : (
        // If a project is loaded, show the full IDE
        <main className="overflow-hidden h-screen">
          <h1 className="sr-only">WebCoder.ai - A web-based IDE with AI-powered code transformation</h1>
          <Ide vfs={vfs} />
        </main>
      )}
    </>
  );
}


export default function Home() {
  return (
    <ClientOnly>
      <VfsLoader />
    </ClientOnly>
  );
}

    