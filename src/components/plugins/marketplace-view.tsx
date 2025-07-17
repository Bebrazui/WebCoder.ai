// src/components/plugins/marketplace-view.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Download, Trash, WandSparkles } from 'lucide-react';
import { useAppState } from '@/hooks/use-app-state';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Plugin {
  id: 'trash-can';
  name: string;
  description: string;
  author: string;
  icon: React.ElementType;
}

const availablePlugins: Plugin[] = [
  {
    id: 'trash-can',
    name: 'Drag & Drop Trash',
    description: 'An interactive way to delete files. Drag a file or folder to the right edge of the window to reveal a trash can for quick deletion.',
    author: 'WebCoder.ai Core',
    icon: Trash,
  },
];

export function MarketplaceView() {
  const { editorSettings, setEditorSettings } = useAppState();
  const { toast } = useToast();

  const isPluginInstalled = (pluginId: Plugin['id']) => {
    switch(pluginId) {
      case 'trash-can':
        return editorSettings.trashCanEnabled;
      default:
        return false;
    }
  }
  
  const handleTogglePlugin = (pluginId: Plugin['id']) => {
    switch(pluginId) {
      case 'trash-can':
        const isEnabled = editorSettings.trashCanEnabled;
        setEditorSettings({ ...editorSettings, trashCanEnabled: !isEnabled });
        toast({
          title: `Plugin ${isEnabled ? 'Uninstalled' : 'Installed'}`,
          description: `Drag & Drop Trash has been ${isEnabled ? 'disabled' : 'enabled'}.`
        })
        break;
      default:
        break;
    }
  }

  return (
    <div className="p-4 space-y-4">
      {availablePlugins.map(plugin => {
        const isInstalled = isPluginInstalled(plugin.id);
        const Icon = plugin.icon;
        
        return (
           <Card key={plugin.id}>
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="p-3 rounded-lg bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-grow">
                      <CardTitle>{plugin.name}</CardTitle>
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
       <Card className="border-dashed">
            <CardHeader>
                <CardTitle className="text-muted-foreground">More plugins coming soon!</CardTitle>
                <CardDescription>The marketplace is under active development.</CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
