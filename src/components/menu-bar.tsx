
"use client";

import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
  } from "@/components/ui/menubar"

interface MenuBarProps {
    onNewFile: () => void;
    onNewFolder: () => void;
    onOpenFolder: () => void;
    onSaveFile: () => void;
    onDownloadZip: () => void;
    onCommandPaletteToggle: () => void;
}
  
export function MenuBar({
    onNewFile,
    onNewFolder,
    onOpenFolder,
    onSaveFile,
    onDownloadZip,
    onCommandPaletteToggle
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
                    <MenubarItem>Exit</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger>Edit</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem disabled>Undo</MenubarItem>
                    <MenubarItem disabled>Redo</MenubarItem>
                    <MenubarSeparator />
                    <MenubarItem disabled>Cut</MenubarItem>
                    <MenubarItem disabled>Copy</MenubarItem>
                    <MenubarItem disabled>Paste</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger>Selection</MenubarTrigger>
                 <MenubarContent>
                    <MenubarItem disabled>Select All</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger>View</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem onClick={onCommandPaletteToggle}>
                        Command Palette<MenubarShortcut>⌘K</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem disabled>Explorer</MenubarItem>
                    <MenubarItem disabled>Source Control</MenubarItem>
                    <MenubarItem disabled>Terminal</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
                <MenubarTrigger>Go</MenubarTrigger>
                 <MenubarContent>
                    <MenubarItem disabled>Go to File...</MenubarItem>
                    <MenubarItem disabled>Go to Symbol...</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
             <MenubarMenu>
                <MenubarTrigger>Help</MenubarTrigger>
                 <MenubarContent>
                    <MenubarItem disabled>Welcome</MenubarItem>
                    <MenubarItem disabled>Show All Commands</MenubarItem>
                    <MenubarItem disabled>Documentation</MenubarItem>
                </MenubarContent>
            </MenubarMenu>
        </Menubar>
    )
}
