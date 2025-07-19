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
    if (!vfs.loading) {
      const todoAppContent = `
import "UserDetail.syn"

component TodoApp() {
    @State tasks: [Task] = []
    @State newTaskTitle: String = ""
    @State isLoading: Bool = true
    
    @effect(once: true) {
        let savedTasks = await Storage.get(key: "synthesis-todo-app")
        if (savedTasks != nil) {
            tasks = savedTasks 
        } else {
            // Загружаем начальные данные, если в хранилище пусто
            tasks = await Network.get(url: "/api/greet")
        }
        isLoading = false
    }

    // Этот эффект сохраняет задачи в localStorage каждый раз, когда они изменяются
    @effect(dependencies: [tasks]) {
        if (isLoading == false) {
            Storage.set(key: "synthesis-todo-app", value: tasks)
        }
    }

    VStack(alignment: .leading, spacing: 15) {
        HStack(alignment: .center, spacing: 10) {
            Text("SYNTHESIS Todo App")
                .font(.title)
            Text("Running on: \\(OS.platform)")
                .font(.caption)
                .padding(5)
                .background(color: "#4B5563") // gray-600
                .cornerRadius(radius: 5)
        }
        
        if isLoading {
            Text("Loading tasks...")
        } else {
             ForEach(tasks) { task in
                // Передаем callback для изменения состояния в родительском компоненте
                TaskRow(task: task, onToggle: { (idToToggle) in
                    var newTasks: [Task] = []
                    ForEach(tasks) { t in
                        var mutableT = t // Создаем изменяемую копию
                        if (mutableT.id == idToToggle) {
                            mutableT.isCompleted = !mutableT.isCompleted
                        }
                        newTasks.push(value: mutableT)
                    }
                    tasks = newTasks
                })
            }
        }

        HStack(spacing: 5) {
            TextField("Add a new task...", text: @binding newTaskTitle)
            Button("Add") {
                if (newTaskTitle != "") {
                    let newTask = Task(id: OS.randomInt(), title: newTaskTitle, isCompleted: false)
                    tasks.push(value: newTask) 
                    newTaskTitle = ""
                }
            }
        }
    }
    .padding(20)
    .frame(width: 450)
}
`;
        if (!vfs.findFileByPath('/TodoApp.syn')) {
            vfs.createFileInVfs('TodoApp.syn', vfs.vfsRoot, todoAppContent);
        }

        const userDetailContent = `
struct Task {
    id: Int;
    title: String;
    isCompleted: Bool;
}

// Дочерний компонент, который использует @binding и callback
component TaskRow(task: Task, onToggle: (id: Int) -> Void) {
    HStack(spacing: 10, alignment: .center) {
        Checkbox(checked: @binding task.isCompleted, onToggle: { (newValue) in
            // Вызываем callback, переданный от родителя
            onToggle(task.id)
        })
        Text(task.title)
    }
}
`;
        if (!vfs.findFileByPath('/UserDetail.syn')) {
            vfs.createFileInVfs('UserDetail.syn', vfs.vfsRoot, userDetailContent);
        }
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
