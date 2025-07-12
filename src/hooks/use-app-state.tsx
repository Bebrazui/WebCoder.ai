
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface EditorSettings {
  theme: 'dark' | 'oceanic';
  fontFamily: string;
  fontSize: number;
  wordWrap: boolean;
  manualJsonInput: boolean;
}

interface AppState {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  editorSettings: EditorSettings;
  setEditorSettings: (settings: EditorSettings) => void;
}

const defaultEditorSettings: EditorSettings = {
  theme: 'dark',
  fontFamily: "'Source Code Pro', monospace",
  fontSize: 14,
  wordWrap: true,
  manualJsonInput: false,
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editorSettings, setEditorSettingsState] = useState<EditorSettings>(() => {
    if (typeof window === 'undefined') {
        return defaultEditorSettings;
    }
    try {
        const item = window.localStorage.getItem('webcoder-editor-settings');
        // Make sure to merge with defaults to not break on adding new settings
        const savedSettings = item ? JSON.parse(item) : {};
        return { ...defaultEditorSettings, ...savedSettings };
    } catch (error) {
        console.error(error);
        return defaultEditorSettings;
    }
  });


  useEffect(() => {
    try {
        window.localStorage.setItem('webcoder-editor-settings', JSON.stringify(editorSettings));
    } catch (error) {
        console.error(error);
    }
  }, [editorSettings]);

  const setEditorSettings = (settings: EditorSettings) => {
    setEditorSettingsState(settings);
  };

  return (
    <AppStateContext.Provider value={{ isSettingsOpen, setIsSettingsOpen, editorSettings, setEditorSettings }}>
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
