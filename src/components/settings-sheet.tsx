
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";
import { useTheme } from "./theme-provider";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";

export function SettingsSheet() {
  const { 
    isSettingsOpen, 
    setIsSettingsOpen, 
    editorSettings, 
    setEditorSettings 
  } = useAppState();
  
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (value: 'dark' | 'oceanic') => {
    setTheme(value);
    setEditorSettings({ ...editorSettings, theme: value });
  };

  return (
    <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Customize the look and feel of your editor.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6">
            <div className="space-y-6 py-4">
              <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-medium text-lg">Appearance</h3>
                  <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                          value={theme}
                          onValueChange={handleThemeChange}
                      >
                          <SelectTrigger id="theme" className="col-span-2">
                          <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="dark">Dark+</SelectItem>
                          <SelectItem value="oceanic">Oceanic</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="flex items-center justify-between">
                      <Label htmlFor="animations-enabled" className="">UI Animations</Label>
                       <Switch
                              id="animations-enabled"
                              checked={editorSettings.animationsEnabled}
                              onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, animationsEnabled: checked })}
                          />
                  </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-medium text-lg">Editor</h3>
                  <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="font-family">Font Family</Label>
                      <Select
                          value={editorSettings.fontFamily}
                          onValueChange={(value) => setEditorSettings({ ...editorSettings, fontFamily: value })}
                      >
                          <SelectTrigger id="font-family" className="col-span-2">
                              <SelectValue placeholder="Select font" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="'Source Code Pro', monospace">Source Code Pro</SelectItem>
                              <SelectItem value="'Fira Code', monospace">Fira Code</SelectItem>
                              <SelectItem value="'JetBrains Mono', monospace">JetBrains Mono</SelectItem>
                              <SelectItem value="'Inconsolata', monospace">Inconsolata</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="font-size">Font Size</Label>
                      <div className="flex items-center gap-2">
                          <Slider
                              id="font-size"
                              min={10}
                              max={20}
                              step={1}
                              value={[editorSettings.fontSize]}
                              onValueChange={(value) => setEditorSettings({ ...editorSettings, fontSize: value[0] })}
                          />
                          <span className="text-sm text-muted-foreground w-8 text-center">{editorSettings.fontSize}px</span>
                      </div>
                  </div>
                  <div className="flex items-center justify-between">
                      <Label htmlFor="word-wrap">Word Wrap</Label>
                      <Switch
                              id="word-wrap"
                              checked={editorSettings.wordWrap}
                              onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, wordWrap: checked })}
                          />
                  </div>
                   <div className="flex items-center justify-between">
                      <Label htmlFor="smooth-cursor">Smooth Cursor Animation</Label>
                      <Switch
                              id="smooth-cursor"
                              checked={editorSettings.animationsEnabled}
                              onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, animationsEnabled: checked })}
                          />
                  </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-medium text-lg">Features</h3>
                   <div className="flex items-center justify-between">
                      <Label htmlFor="manual-json" className="">Manual JSON Input (Debug)</Label>
                      <Switch
                              id="manual-json"
                              checked={editorSettings.manualJsonInput}
                              onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, manualJsonInput: checked })}
                          />
                  </div>
              </div>

            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
