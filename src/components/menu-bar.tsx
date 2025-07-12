
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
import { Check } from "lucide-react";

interface MenuBarProps {
    onNewFile: () => void;
    onNewFolder: () => void;
    onOpenFolder: () => void;
    onSaveFile: () => void;
    onDownloadZip: () => void;
    onCommandPaletteToggle: () => void;
    onEditorAction: (actionId: string) => void;
    isSidebarVisible: boolean;
    onToggleSidebar: () => void;
    isTerminalVisible: boolean;
    onToggleTerminal: () => void;
    isStatusBarVisible: boolean;
    onToggleStatusBar: () => void;
    theme: string;
    onThemeChange: (theme: string) => void;
}
  
export function MenuBar({
    onNewFile,
    onNewFolder,
    onOpenFolder,
    onSaveFile,
    onDownloadZip,
    onCommandPaletteToggle,
    onEditorAction,
    isSidebarVisible,
    onToggleSidebar,
    isTerminalVisible,
    onToggleTerminal,
    isStatusBarVisible,
    onToggleStatusBar,
    theme,
    onThemeChange,
}: MenuBarProps) {
    return (
        <Menubar className="rounded-none border-b border-border px-2 lg:px-4">
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
                    <MenubarSeparator />
                    <MenubarItem onClick={onDownloadZip}>Download as ZIP...</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem disabled>Exit</MenubarItem>
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
                        <MenubarSubTrigger>Theme</MenubarSubTrigger>
                        <MenubarSubContent>
                             <MenubarItem onClick={() => onThemeChange('dark')}>
                                {theme === 'dark' && <Check className="mr-2 h-4 w-4" />}
                                <span>Dark</span>
                            </MenubarItem>
                            <MenubarItem onClick={() => onThemeChange('oceanic')}>
                                {theme === 'oceanic' && <Check className="mr-2 h-4 w-4" />}
                                <span>Oceanic</span>
                            </MenubarItem>
                        </MenubarSubContent>
                    </MenubarSub>
                    <MenubarSeparator />
                    <MenubarCheckboxItem checked={isSidebarVisible} onCheckedChange={onToggleSidebar}>
                        Show Explorer
                    </MenubarCheckboxItem>
                     <MenubarCheckboxItem checked={isTerminalVisible} onCheckedChange={onToggleTerminal}>
                        Show Terminal
                    </MenubarCheckboxItem>
                     <MenubarCheckboxItem checked={isStatusBarVisible} onCheckedChange={onToggleStatusBar}>
                        Show Status Bar
                    </MenubarCheckboxItem>
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
                    <MenubarItem disabled>Welcome</MenubarItem>
                    <MenubarItem onClick={onCommandPaletteToggle}>Show All Commands</MenubarItem>
                    <MenubarItem disabled>Documentation</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </Menubar>
    )
}
