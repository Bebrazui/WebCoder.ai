
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
  isElectron: boolean;
  setIsElectron: (isElectron: boolean) => void;
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
  const [editorSettings, setEditorSettingsState] = useState<EditorSettings>(defaultEditorSettings);
  const [isElectron, setIsElectron] = useState(false);

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
  }, []); // Empty dependency array ensures this runs only once on mount

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

  return (
    <AppStateContext.Provider value={{ 
        isSettingsOpen, setIsSettingsOpen, 
        editorSettings, setEditorSettings,
        isElectron, setIsElectron
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
