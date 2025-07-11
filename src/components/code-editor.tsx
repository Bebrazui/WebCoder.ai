"use client";

import { useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguage } from "@/lib/vfs";
import { Button } from "@/components/ui/button";
import { WandSparkles } from "lucide-react";
import { AiTransformDialog } from "./ai-transform-dialog";

interface CodeEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ path, value, onChange }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // --- Enable Rich IntelliSense and validation ---
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
      strict: true,
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      allowNonTsExtensions: true,
      esModuleInterop: true,
    });
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions({
        jsx: monacoInstance.languages.typescript.JsxEmit.React,
        strict: true,
        target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
        module: monacoInstance.languages.typescript.ModuleKind.ESNext,
        allowNonTsExtensions: true,
        esModuleInterop: true,
    });
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
  };

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
