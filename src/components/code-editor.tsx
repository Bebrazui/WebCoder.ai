// src/components/code-editor.tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguage, type VFSFile } from "@/lib/vfs";
import { Button } from "@/components/ui/button";
import { WandSparkles, FileCode2, LoaderCircle, Play, Atom } from "lucide-react";
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

// Custom language definition for SYNTHESIS
const registerSynthesisLanguage = (monacoInstance: typeof monaco) => {
    const langId = 'synthesis';

    // Check if the language is already registered
    if (monacoInstance.languages.getLanguages().some(lang => lang.id === langId)) {
        return;
    }

    monacoInstance.languages.register({ id: langId });

    monacoInstance.languages.setMonarchTokensProvider(langId, {
        keywords: [
            'struct', 'component', 'func', 'if', 'else', 'let', 'return',
            '@main', '@state', '@binding', '@effect', 'in', 'async', 'await',
            'Window', 'VStack', 'HStack', 'Text', 'Button', 'TextField', 
            'Checkbox', 'ForEach'
        ],
        typeKeywords: [
            'Int', 'String', 'Void', 'Bool', 'Date', 'UUID'
        ],
        operators: [
            '=', '>', '<', '!', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '+', '-', '*', '/'
        ],
        // C-style strings
        symbols: /[=><!?:&|+\-*/^%]+/,
        // C-style strings
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        tokenizer: {
            root: [
                // identifiers and keywords
                [/[a-zA-Z_@][\w$]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@typeKeywords': 'type',
                        '@default': 'identifier'
                    }
                }],
                // whitespace
                { include: '@whitespace' },
                // delimiters and operators
                [/[{}()\[\]]/, '@brackets'],
                [/[<>](?!@symbols)/, '@brackets'],
                [/@symbols/, {
                    cases: {
                        '@operators': 'operator',
                        '@default': ''
                    }
                }],
                // numbers
                [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                [/\d+/, 'number'],
                // delimiter: after number because of .\d floats
                [/[;,.]/, 'delimiter'],
                // strings
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            ],
            comment: [
                [/[^\/*]+/, 'comment'],
                [/\/\*/, 'comment', '@push'], // nested comment
                ["\\*/", 'comment', '@pop'],
                [/[\/*]/, 'comment']
            ],
            string: [
                [/[^"\\]+/, 'string'],
                [/\\\(.*?\)/, 'string.escape'], // Interpolation
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],
            whitespace: [
                [/[ \t\r\n]+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/\/\/.*$/, 'comment'],
            ],
        },
    });
};


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
  const { vfsRoot, findFileByPath } = useVfs();
  const [languageServiceReady, setLanguageServiceReady] = useState(false);

  useEffect(() => {
    // This ensures monaco is loaded and configured before we use it
    loader.init().then(monacoInstance => {
        // Register our custom language
        registerSynthesisLanguage(monacoInstance);

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
        setLanguageServiceReady(true);
    });
  }, []);

  const handleRunScript = useCallback(async (config: LaunchConfig | null) => {
    const launchFile = findFileByPath('launch.json');
    if (!config) {
        if (window.confirm(`No launch configuration found for this file. Would you like to open 'launch.json' to add one?`)) {
           // This requires a way to signal the parent to open the file.
           // For now, we just log it. A better solution would use a callback.
           console.log("User wants to open launch.json");
           if (launchFile) {
                // onSelectFile(launchFile) // This needs to be passed in
           }
        }
        return;
    }

    toast({ title: "Running script...", description: `Executing '${config.name}'... Check the Run & Debug view or terminal for output.`});
    const apiEndpoint = `/api/run-${config.type}`;
    try {
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
  }, [toast, vfsRoot, findFileByPath]);


  const updateOutline = useCallback(async () => {
    if (!editorRef.current || !monacoRef.current || !onOutlineChange || !languageServiceReady) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    try {
        // Use the getDocumentSymbolProvider for a more reliable way to get symbols
        const provider = monacoRef.current.languages.typescript.getTypeScriptWorker
          ? await monacoRef.current.languages.typescript.getTypeScriptWorker()
          : null;
          
        if (provider) {
             const symbols = await (await monacoRef.current.editor.getDocumentSymbolProvider(model))?.provideDocumentSymbols(model, {
                dispose: () => {}
            });
            if (symbols) {
                onOutlineChange(symbols.map(mapSymbol));
            } else {
                onOutlineChange([]);
            }
        } else {
            onOutlineChange([]);
        }

    } catch (e) {
        console.warn("Could not get document symbols:", e);
        onOutlineChange([]); // Clear outline on error
    }
  }, [onOutlineChange, languageServiceReady]);

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

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    if (onEditorReady) {
        onEditorReady(editor);
    }
    
    // --- Add Context Menu Actions ---
    const addAction = (id: string, label: string, keybindings: number[] | undefined, contextMenuGroupId: string, contextMenuOrder: number) => {
        editor.addAction({
            id,
            label,
            keybindings,
            contextMenuGroupId,
            contextMenuOrder,
            run: (ed) => ed.trigger('contextmenu', id, {}),
        });
    };

    // Navigation Group
    addAction('editor.action.revealDefinition', 'Go to Definition', [monacoInstance.KeyCode.F12], 'navigation', 1.1);
    addAction('editor.action.findReferences', 'Find All References', undefined, 'navigation', 1.2);

    // Refactoring Group
    addAction('editor.action.rename', 'Rename Symbol', [monacoInstance.KeyCode.F2], '2_refactor', 2.1);
    addAction('editor.action.changeAll', 'Change All Occurrences', undefined, '2_refactor', 2.2);
    editor.addAction({
        id: 'format-document-action',
        label: 'Format Document',
        keybindings: [],
        contextMenuGroupId: '2_refactor',
        contextMenuOrder: 2.3,
        run: () => handleFormat(),
    });

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

  // Apply editor settings when they change
  useEffect(() => {
    if (editorRef.current) {
        editorRef.current.updateOptions({
            fontFamily: editorSettings.fontFamily,
            fontSize: editorSettings.fontSize,
            wordWrap: editorSettings.wordWrap ? "on" : "off",
            cursorSmoothCaretAnimation: editorSettings.smoothCursor ? 'on' : 'off',
        });
    }
  }, [editorSettings]);

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
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordBasedSuggestions: true,
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
          },
          snippetSuggestions: 'top',
          // Initial settings are applied here
          fontFamily: editorSettings.fontFamily,
          fontSize: editorSettings.fontSize,
          wordWrap: editorSettings.wordWrap ? "on" : "off",
          cursorSmoothCaretAnimation: editorSettings.smoothCursor ? 'on' : 'off',
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

    