// src/components/plugins/marketplace-view.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Download, Trash, WandSparkles, ListChecks, ClipboardList, KeyRound, Copy } from 'lucide-react';
import { useAppState } from '@/hooks/use-app-state';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TodoListerView } from '@/components/plugins/marketplace/todo-lister-view';
import { ClipboardHistoryView } from '@/components/plugins/marketplace/clipboard-history-view';

interface Plugin {
  id: 'trash-can' | 'todo-lister' | 'clipboard-history' | 'random-string-generator' | 'image-base64-converter';
  name: string;
  description: string;
  author: string;
  icon: React.ElementType;
  component?: React.FC;
}

const availablePlugins: Plugin[] = [
  {
    id: 'trash-can',
    name: 'Drag & Drop Trash',
    description: 'An interactive way to delete files. Drag a file or folder to the right edge of the window to reveal a trash can for quick deletion.',
    author: 'WebCoder.ai Core',
    icon: Trash,
  },
  {
    id: 'todo-lister',
    name: 'TODO/FIXME Lister',
    description: 'Scans your project for // TODO: and // FIXME: comments and lists them in a convenient panel. Click an item to jump to the line.',
    author: 'WebCoder.ai Core',
    icon: ListChecks,
    component: TodoListerView,
  },
    {
    id: 'clipboard-history',
    name: 'Clipboard History',
    description: 'Keeps a history of items you copy to the clipboard. Click an item to copy it again or insert it into the editor.',
    author: 'WebCoder.ai Core',
    icon: ClipboardList,
    component: ClipboardHistoryView,
  },
  {
    id: 'random-string-generator',
    name: 'Random String Generator',
    description: 'Adds a "Generate UUID" command to the Command Palette (Cmd+K) to quickly insert a unique identifier into your code.',
    author: 'WebCoder.ai Core',
    icon: KeyRound,
  },
  {
    id: 'image-base64-converter',
    name: 'Image Base64 Converter',
    description: 'Adds a "Copy as Base64" option to the context menu for image files in the explorer.',
    author: 'WebCoder.ai Core',
    icon: Copy,
  }
];

export function MarketplaceView() {
  const { editorSettings, setEditorSettings } = useAppState();
  const { toast } = useToast();

  const isPluginInstalled = (pluginId: Plugin['id']) => {
    switch(pluginId) {
      case 'trash-can':
        return editorSettings.trashCanEnabled;
      case 'todo-lister':
          return editorSettings.todoListerEnabled;
      case 'clipboard-history':
          return editorSettings.clipboardHistoryEnabled;
      case 'random-string-generator':
            return editorSettings.randomStringGeneratorEnabled;
      case 'image-base64-converter':
            return editorSettings.imageBase64ConverterEnabled;
      default:
        return false;
    }
  }
  
  const handleTogglePlugin = (pluginId: Plugin['id']) => {
    let newSettings = { ...editorSettings };
    let isEnabled: boolean;

    switch(pluginId) {
      case 'trash-can':
        isEnabled = !editorSettings.trashCanEnabled;
        newSettings.trashCanEnabled = isEnabled;
        break;
      case 'todo-lister':
          isEnabled = !editorSettings.todoListerEnabled;
          newSettings.todoListerEnabled = isEnabled;
          break;
      case 'clipboard-history':
          isEnabled = !editorSettings.clipboardHistoryEnabled;
          newSettings.clipboardHistoryEnabled = isEnabled;
          break;
      case 'random-string-generator':
        isEnabled = !editorSettings.randomStringGeneratorEnabled;
        newSettings.randomStringGeneratorEnabled = isEnabled;
        break;
      case 'image-base64-converter':
        isEnabled = !editorSettings.imageBase64ConverterEnabled;
        newSettings.imageBase64ConverterEnabled = isEnabled;
        break;
      default:
        return;
    }

    setEditorSettings(newSettings);
    const pluginName = availablePlugins.find(p => p.id === pluginId)?.name || 'Plugin';
    toast({
      title: `Plugin ${isEnabled ? 'Installed' : 'Uninstalled'}`,
      description: `${pluginName} has been ${isEnabled ? 'enabled' : 'disabled'}.`
    })
  }
  
  const installedPlugins = availablePlugins.filter(p => p.component && isPluginInstalled(p.id));

  return (
    <div className="p-4 space-y-6">
      {installedPlugins.length > 0 && (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold px-2">Active Plugin Panels</h3>
            {installedPlugins.map(plugin => {
                const PluginComponent = plugin.component!;
                return <PluginComponent key={`${plugin.id}-viewer`} />;
            })}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold px-2">Available Plugins</h3>
        {availablePlugins.map(plugin => {
          const isInstalled = isPluginInstalled(plugin.id);
          const Icon = plugin.icon;
          
          return (
             <Card key={plugin.id}>
                <CardHeader className="grid grid-cols-[auto,1fr,auto] items-start gap-4 space-y-0">
                    <div className="p-3 rounded-lg bg-muted">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-grow min-w-0">
                        <CardTitle className="break-words">{plugin.name}</CardTitle>
                        <CardDescription>by {plugin.author}</CardDescription>
                    </div>
                    <div>
                      {isInstalled && <Badge variant="secondary"><Check className="mr-1 h-3 w-3" /> Installed</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{plugin.description}</p>
                </CardContent>
                <CardFooter>
                   <Button 
                      className="w-full"
                      variant={isInstalled ? "destructive" : "default"}
                      onClick={() => handleTogglePlugin(plugin.id)}
                    >
                     {isInstalled ? (
                       <>
                          <Trash className="mr-2" /> Uninstall
                       </>
                     ) : (
                       <>
                          <Download className="mr-2" /> Install
                       </>
                     )}
                   </Button>
                </CardFooter>
              </Card>
          )
        })}
      </div>
       <Card className="border-dashed">
            <CardHeader>
                <CardTitle className="text-muted-foreground">More plugins coming soon!</CardTitle>
                <CardDescription>The marketplace is under active development.</CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
