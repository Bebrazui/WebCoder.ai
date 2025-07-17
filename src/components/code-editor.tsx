// src/components/code-editor.tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguage, type VFSFile } from "@/lib/vfs";
import { Button } from "@/components/ui/button";
import { WandSparkles, FileCode2, LoaderCircle, Play } from "lucide-react";
import { AiTransformDialog } from "./ai-transform-dialog";
import { OutlineData } from "./outline-view";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import * as prettier from "prettier/standalone";
import * as prettierPluginBabel from "prettier/plugins/babel";
import * as prettierPluginEstree from "prettier/plugins/estree";
import * as prettierPluginHtml from "prettier/plugins/html";
import { useAppState } from "@/hooks/use-app-state";
import { LaunchConfig } from "./file-explorer";
import { useVfs } from "@/hooks/use-vfs";

interface CodeEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onOutlineChange?: (outline: OutlineData[]) => void;
  launchConfigs: LaunchConfig[];
}

const mapSymbol = (symbol: monaco.languages.DocumentSymbol): OutlineData => ({
    name: symbol.name,
    kind: symbol.kind,
    range: symbol.range,
    children: symbol.children ? symbol.children.map(mapSymbol) : [],
});

export function CodeEditor({ path, value, onChange, onEditorReady, onOutlineChange, launchConfigs }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [isFormatting, setIsFormatting] = useState(false);
  const debouncedValue = useDebounce(value, 500);
  const { toast } = useToast();
  const { editorSettings } = useAppState();
  const { vfsRoot } = useVfs();

  const handleRunScript = async (config: LaunchConfig) => {
    toast({ title: "Running script...", description: `Executing '${config.name}'... Check the Run & Debug view or terminal for output.`});
    const apiEndpoint = `/api/run-${config.type}`;
    try {
        // The RunView has more complex logic for handling args, but for this context menu, we use the default.
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectFiles: [vfsRoot],
                config: config,
            }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: `Execution Failed: ${config.name}`, description: e.message });
    }
  };

  const updateOutline = useCallback(async () => {
    if (!editorRef.current || !monacoRef.current || !onOutlineChange) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    try {
        const breadcrumbs = monacoRef.current.languages.typescript.getJavaScriptWorker().then(worker => worker(model.uri));
        const symbols = await (await monacoRef.current.editor.getDocumentSymbolProvider(model))?.provideDocumentSymbols(model, {
            dispose: () => {}
        });

        if (symbols) {
            onOutlineChange(symbols.map(mapSymbol));
        } else {
            onOutlineChange([]);
        }
    } catch (e) {
        onOutlineChange([]); // Clear outline on error
    }
  }, [onOutlineChange]);


  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    if (onEditorReady) {
        onEditorReady(editor);
    }
    
    // Custom "Run Script" action
    editor.addAction({
      id: 'run-script',
      label: 'Run Script',
      keybindings: [],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      precondition: 'true', // Always available in menu, but we'll check runnability in the `run` method.
      run: (ed: monaco.editor.ICodeEditor) => {
        const model = ed.getModel();
        if (!model) return;

        const filePath = model.uri.path.startsWith('/') ? model.uri.path.substring(1) : model.uri.path;
        
        const runnableConfig = launchConfigs.find(config => {
            const fileNode = { name: filePath.split('/').pop() || '', path: filePath };
            return config.program === filePath ||
                (config.type === 'java' && fileNode.name === `${config.mainClass}.java`) ||
                (config.type === 'rust' && fileNode.name === 'main.rs' && config.cargo?.projectPath === 'rust_apps') ||
                (config.type === 'csharp' && fileNode.name === 'Program.cs' && config.projectPath && fileNode.path.includes(config.projectPath));
        });

        if (runnableConfig) {
          handleRunScript(runnableConfig);
        } else {
          toast({ variant: 'destructive', title: "Not Runnable", description: "No launch configuration found for this file." });
        }
      },
    });

    // --- Enable Rich IntelliSense and validation ---
    const setupCompilerOptions = (defaults: monaco.languages.typescript.LanguageServiceDefaults) => {
      defaults.setCompilerOptions({
        jsx: monacoInstance.languages.typescript.JsxEmit.React,
        strict: true,
        target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
        module: monacoInstance.languages.typescript.ModuleKind.ESNext,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowJs: true,
        allowNonTsExtensions: true,
      });
    };

    setupCompilerOptions(monacoInstance.languages.typescript.typescriptDefaults);
    setupCompilerOptions(monacoInstance.languages.typescript.javascriptDefaults);
    // --- End of IntelliSense setup ---

    editor.onMouseUp(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(selection);
        if (text) {
            setSelectedText(text);
        }
      } else {
        setSelectedText("");
      }
    });
    
    updateOutline();
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      const model = editor.getModel();
      if (model && monacoRef.current) {
        monacoRef.current.editor.setModelLanguage(model, getLanguage(path));
      }
    }
    updateOutline();
  }, [path, updateOutline]);
  
  useEffect(() => {
    updateOutline();
  }, [debouncedValue, updateOutline]);

  const handleTransform = (newCode: string) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      if(selection) {
        editor.executeEdits("ai-transformer", [{
          range: selection,
          text: newCode,
          forceMoveMarkers: true
        }]);
      }
    }
  };

  const handleFormat = async () => {
    if (isFormatting) return;
    setIsFormatting(true);
    try {
        const language = getLanguage(path);
        const parser = language === 'typescript' || language === 'javascript' ? 'babel-ts' : language;
        
        const formattedCode = await prettier.format(value, {
            parser: parser,
            plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginHtml],
            // Prettier options
            semi: true,
            singleQuote: false,
            trailingComma: "es5",
        });
        onChange(formattedCode);
        toast({ title: "Code formatted", description: "Successfully formatted the code with Prettier." });
    } catch (error) {
        console.error("Formatting failed:", error);
        toast({ variant: "destructive", title: "Formatting failed", description: "Could not format the code. It may contain syntax errors." });
    } finally {
        setIsFormatting(false);
    }
  };

  const language = getLanguage(path);

  return (
    <div className="relative h-full w-full">
      <Editor
        path={path}
        value={value}
        onChange={(v) => onChange(v || "")}
        onMount={handleEditorDidMount}
        theme={editorSettings.theme === 'oceanic' ? 'oceanic' : 'vs-dark'}
        language={language}
        loading={<Skeleton className="h-full w-full" />}
        options={{
          fontFamily: editorSettings.fontFamily,
          fontSize: editorSettings.fontSize,
          wordWrap: editorSettings.wordWrap ? "on" : "off",
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <Button onClick={handleFormat} disabled={isFormatting} variant="outline">
          {isFormatting ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
              <FileCode2 className="mr-2 h-4 w-4" />
          )}
          Format Document
        </Button>
        {selectedText && (
            <Button onClick={() => setIsAiDialogOpen(true)}>
                <WandSparkles className="mr-2 h-4 w-4" />
                AI Transform
            </Button>
        )}
      </div>
      <AiTransformDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        selectedCode={selectedText}
        onTransform={handleTransform}
      />
    </div>
  );
}
