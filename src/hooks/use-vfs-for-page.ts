// src/hooks/use-vfs-for-page.ts
"use client";

import { useState, useEffect } from "react";
import localforage from "localforage";
import type { VFSDirectory } from "@/lib/vfs";

const VFS_KEY = "webcoder-vfs-root";

/**
 * A lightweight version of the useVfs hook designed for use on
 * separate pages (like the game runner) that only need to READ
 * the current VFS state from localStorage without any of the
 * complex modification logic.
 */
export function useVfsForPage() {
  const [vfsRoot, setVfsRoot] = useState<VFSDirectory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localforage.config({
        name: 'WebCoderAI',
        storeName: 'vfs',
        description: 'Virtual File System for WebCoder.ai'
    });

    const loadVfs = async () => {
      try {
        const savedRoot = await localforage.getItem<VFSDirectory>(VFS_KEY);
        if (savedRoot && savedRoot.type === 'directory') {
          setVfsRoot(savedRoot);
        } else {
          setVfsRoot(null); // No project exists
        }
      } catch (error) {
        console.error("Failed to load VFS from IndexedDB for page", error);
        setVfsRoot(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadVfs();
  }, []);

  return { vfsRoot, loading };
}
