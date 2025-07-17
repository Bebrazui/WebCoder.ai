// src/components/menu-bar.tsx
"use client";

import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarCheckboxItem,
  } from "@/components/ui/menubar"
import { useAppState } from "@/hooks/use-app-state";
import { Check, Settings } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

interface MenuBarProps {
    onNewFile: () => void;
    onNewFolder: () => void;
    onOpenFolder: () => void;
    onSaveFile: () => void;
    onSaveAllFiles: () => void;
    onCloseFile: () => void;
    onCloseAllFiles: () => void;
    onDownloadZip: () => void;
    onExitProject: () => void;
    onCommandPaletteToggle: () => void;
    onEditorAction: (actionId: string) => void;
    isSidebarVisible: boolean;
    onToggleSidebar: () => void;
    isTerminalVisible: boolean;
    onToggleTerminal: () => void;
    isStatusBarVisible: boolean;
    onToggleStatusBar: () => void;
    onOpenDocumentation: () => void;
}
  
export function MenuBar({
    onNewFile,
    onNewFolder,
    onOpenFolder,
    onSaveFile,
    onSaveAllFiles,
    onCloseFile,
    onCloseAllFiles,
    onDownloadZip,
    onExitProject,
    onCommandPaletteToggle,
    onEditorAction,
    isSidebarVisible,
    onToggleSidebar,
    isTerminalVisible,
    onToggleTerminal,
    isStatusBarVisible,
    onToggleStatusBar,
    onOpenDocumentation,
}: MenuBarProps) {
    const { theme, setTheme } = useTheme();
    const { setIsSettingsOpen } = useAppState();

    return (
        <div className="flex items-center justify-between border-b border-border pl-2 pr-1 h-11">
            <Menubar className="border-0 p-0 h-auto bg-transparent">
                <MenubarMenu>
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onNewFile}>New File</MenubarItem>
                        <MenubarItem onClick={onNewFolder}>New Folder</MenubarItem>
                        <MenubarItem onClick={onOpenFolder}>Open Folder...</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={onSaveFile}>
                            Save<MenubarShortcut>⌘S</MenubarShortcut>
                        </MenubarItem>
                         <MenubarItem onClick={onSaveAllFiles}>
                            Save All<MenubarShortcut>⇧⌘S</MenubarShortcut>
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={onCloseFile}>Close File</MenubarItem>
                        <MenubarItem onClick={onCloseAllFiles}>Close All Files</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={onDownloadZip}>Download as ZIP...</MenubarItem>
                        <MenubarItem onClick={onExitProject}>Exit Project</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem disabled>Exit Application</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Edit</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => onEditorAction('undo')}>Undo</MenubarItem>
                        <MenubarItem onClick={() => onEditorAction('redo')}>Redo</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={() => onEditorAction('editor.action.clipboardCutAction')}>Cut</MenubarItem>
                        <MenubarItem onClick={() => onEditorAction('editor.action.clipboardCopyAction')}>Copy</MenubarItem>
                        <MenubarItem onClick={() => onEditorAction('editor.action.clipboardPasteAction')}>Paste</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={() => onEditorAction('actions.find')}>Find</MenubarItem>
                        <MenubarItem onClick={() => onEditorAction('editor.action.startFindReplaceAction')}>Replace</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem onClick={() => onEditorAction('editor.action.commentLine')}>Toggle Line Comment</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Selection</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => onEditorAction('editor.action.selectAll')}>Select All</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>View</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onCommandPaletteToggle}>
                            Command Palette<MenubarShortcut>⌘K</MenubarShortcut>
                        </MenubarItem>
                        <MenubarSub>
                            <MenubarSubTrigger>Appearance</MenubarSubTrigger>
                             <MenubarSubContent>
                                <MenubarCheckboxItem checked={isSidebarVisible} onCheckedChange={onToggleSidebar}>
                                    Show Explorer
                                </MenubarCheckboxItem>
                                <MenubarCheckboxItem checked={isTerminalVisible} onCheckedChange={onToggleTerminal}>
                                    Show Terminal
                                </MenubarCheckboxItem>
                                <MenubarCheckboxItem checked={isStatusBarVisible} onCheckedChange={onToggleStatusBar}>
                                    Show Status Bar
                                </MenubarCheckboxItem>
                                <MenubarSeparator />
                                <MenubarItem disabled>Split Editor</MenubarItem>
                                <MenubarItem disabled>Center Layout</MenubarItem>
                            </MenubarSubContent>
                        </MenubarSub>
                         <MenubarSub>
                            <MenubarSubTrigger>Theme</MenubarSubTrigger>
                            <MenubarSubContent>
                                <MenubarItem onClick={() => setTheme('dark')}>
                                    {theme === 'dark' && <Check className="mr-2 h-4 w-4" />}
                                    <span>Dark+</span>
                                </MenubarItem>
                                <MenubarItem onClick={() => setTheme('oceanic')}>
                                    {theme === 'oceanic' && <Check className="mr-2 h-4 w-4" />}
                                    <span>Oceanic</span>
                                </MenubarItem>
                            </MenubarSubContent>
                        </MenubarSub>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Go</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onCommandPaletteToggle}>Go to File...</MenubarItem>
                        <MenubarItem disabled>Go to Symbol...</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>Help</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={onOpenDocumentation}>Documentation</MenubarItem>
                        <MenubarItem onClick={onCommandPaletteToggle}>Show All Commands</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="h-5 w-5" />
            </Button>
        </div>
    )
}
