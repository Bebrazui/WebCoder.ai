
"use client";

import { useAppState } from "@/hooks/use-app-state";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "oceanic";

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const { editorSettings, setEditorSettings } = useAppState();
  const theme = editorSettings.theme;
  
  const setTheme = (newTheme: Theme) => {
    setEditorSettings({ ...editorSettings, theme: newTheme });
  };
  
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("dark", "oceanic");
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
