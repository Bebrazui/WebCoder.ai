
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguage } from "@/lib/vfs";
import { Button } from "@/components/ui/button";
import { WandSparkles } from "lucide-react";
import { AiTransformDialog } from "./ai-transform-dialog";
import { OutlineData } from "./outline-view";
import { useDebounce } from "@/hooks/use-debounce";

interface CodeEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onEditorReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onOutlineChange: (outline: OutlineData[]) => void;
}

const mapSymbol = (symbol: monaco.languages.DocumentSymbol): OutlineData => ({
    name: symbol.name,
    kind: symbol.kind,
    range: symbol.range,
    children: symbol.children ? symbol.children.map(mapSymbol) : [],
});

export function CodeEditor({ path, value, onChange, onEditorReady, onOutlineChange }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const debouncedValue = useDebounce(value, 500);

  const updateOutline = useCallback(async () => {
    if (!editorRef.current || !monacoRef.current) return;
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
    onEditorReady(editor);

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
    // When the file path changes, we need to update the model in monaco
    // to ensure the correct language services are used.
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

  const language = getLanguage(path);

  return (
    <div className="relative h-full w-full">
      <Editor
        path={path}
        value={value}
        onChange={(v) => onChange(v || "")}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        language={language}
        loading={<Skeleton className="h-full w-full" />}
        options={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: 14,
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "bounded",
        }}
      />
      {selectedText && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button onClick={() => setIsAiDialogOpen(true)}>
            <WandSparkles className="mr-2 h-4 w-4" />
            AI Transform
          </Button>
        </div>
      )}
      <AiTransformDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        selectedCode={selectedText}
        onTransform={handleTransform}
      />
    </div>
  );
}
