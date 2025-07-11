"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { transformCode, type TransformCodeInput } from "@/ai/flows/transform-code";
import { WandSparkles, LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AiTransformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCode: string;
  onTransform: (newCode: string) => void;
}

export function AiTransformDialog({
  open,
  onOpenChange,
  selectedCode,
  onTransform,
}: AiTransformDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!instruction.trim() || !selectedCode.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Instruction and selected code cannot be empty.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const input: TransformCodeInput = {
        code: selectedCode,
        instruction,
      };
      const result = await transformCode(input);
      onTransform(result.transformedCode);
      onOpenChange(false);
      setInstruction("");
    } catch (error) {
      console.error("AI transformation failed:", error);
      toast({
        variant: "destructive",
        title: "Transformation Failed",
        description: "The AI could not transform the code. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>AI Code Transformer</DialogTitle>
          <DialogDescription>
            Describe how you want to transform the selected code.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <h3 className="font-semibold text-sm">Selected Code:</h3>
            <pre className="p-2 bg-muted rounded-md text-sm max-h-40 overflow-auto font-code">
              <code>{selectedCode}</code>
            </pre>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instruction">Instruction</Label>
            <Textarea
              id="instruction"
              placeholder="e.g., 'Convert this to an async function', 'Refactor to use arrow functions'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="min-h-[100px] font-body"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <WandSparkles />
            )}
            Transform
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
