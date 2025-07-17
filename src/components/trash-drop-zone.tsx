// src/components/trash-drop-zone.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { VFSNode } from '@/lib/vfs';

interface TrashDropZoneProps {
  onDeleteNode: (node: VFSNode) => void;
  findNodeByPath: (path: string) => VFSNode | null;
}

const ACTIVATION_AREA_WIDTH = 200; // in pixels

export function TrashDropZone({ onDeleteNode, findNodeByPath }: TrashDropZoneProps) {
  const [isActive, setIsActive] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsActive(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.clientX > window.innerWidth - ACTIVATION_AREA_WIDTH) {
      if (!isActive) {
        setIsActive(true);
      }
    } else {
      if (isActive) {
        setIsActive(false);
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isActive) { // Only delete if dropped inside the active zone
        const path = e.dataTransfer?.getData("text/plain");
        if (path && path !== '/') {
            const nodeToDelete = findNodeByPath(path);
            if (nodeToDelete) {
                if (confirm(`Are you sure you want to delete ${nodeToDelete.name}?`)) {
                    onDeleteNode(nodeToDelete);
                }
            }
        }
    }
    
    // Reset state after any drop
    setIsActive(false);
    dragCounter.current = 0;
  };

  useEffect(() => {
    // We attach listeners to the window to capture drag events globally
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, findNodeByPath, onDeleteNode]); // Re-bind if props change

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-48 bg-destructive/10 border-l-2 border-dashed border-destructive/50 text-destructive/80 transition-transform duration-300 ease-in-out z-50",
        "flex flex-col items-center justify-center gap-4 text-center p-4",
        "transform-gpu pointer-events-none", // Crucially, it's not interactive by default
        isActive ? "translate-x-0" : "translate-x-full"
      )}
    >
      <Trash2 className="h-16 w-16" />
      <p className="font-semibold">Drop here to delete</p>
    </div>
  );
}
