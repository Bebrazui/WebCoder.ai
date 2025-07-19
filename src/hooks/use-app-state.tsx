// src/hooks/use-app-state.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface EditorSettings {
  theme: 'dark' | 'oceanic';
  fontFamily: string;
  fontSize: number;
  wordWrap: boolean;
  manualJsonInput: boolean;
  animationsEnabled: boolean;
  trashCanEnabled: boolean;
  todoListerEnabled: boolean;
  clipboardHistoryEnabled: boolean;
  randomStringGeneratorEnabled: boolean;
  imageBase64ConverterEnabled: boolean;
}

interface AppState {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isDocsOpen: boolean;
  setIsDocsOpen: (isOpen: boolean) => void;
  editorSettings: EditorSettings;
  setEditorSettings: (settings: EditorSettings) => void;
  isElectron: boolean;
  setIsElectron: (isElectron: boolean) => void;
  clipboardHistory: string[];
  addToClipboardHistory: (item: string) => void;
}

const defaultEditorSettings: EditorSettings = {
  theme: 'dark',
  fontFamily: "'Source Code Pro', monospace",
  fontSize: 14,
  wordWrap: true,
  manualJsonInput: false,
  animationsEnabled: true,
  trashCanEnabled: true,
  todoListerEnabled: true,
  clipboardHistoryEnabled: true,
  randomStringGeneratorEnabled: true,
  imageBase64ConverterEnabled: true,
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [editorSettings, setEditorSettingsState] = useState<EditorSettings>(defaultEditorSettings);
  const [isElectron, setIsElectron] = useState(false);
  const [clipboardHistory, setClipboardHistory] = useState<string[]>([]);

  // Load settings from localStorage on the client side only
  useEffect(() => {
    try {
        const item = window.localStorage.getItem('webcoder-editor-settings');
        if (item) {
            const savedSettings = JSON.parse(item);
            // Merge with defaults to prevent breaking on adding new settings
            setEditorSettingsState({ ...defaultEditorSettings, ...savedSettings });
        }
    } catch (error) {
        console.error("Failed to load settings from localStorage", error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
        window.localStorage.setItem('webcoder-editor-settings', JSON.stringify(editorSettings));
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
  }, [editorSettings]);

  const setEditorSettings = (settings: EditorSettings) => {
    setEditorSettingsState(settings);
  };
  
  const addToClipboardHistory = (item: string) => {
    setClipboardHistory(prev => [item, ...prev].slice(0, 20)); // Keep last 20 items
  };

  return (
    <AppStateContext.Provider value={{ 
        isSettingsOpen, setIsSettingsOpen, 
        isDocsOpen, setIsDocsOpen,
        editorSettings, setEditorSettings,
        isElectron, setIsElectron,
        clipboardHistory, addToClipboardHistory
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
