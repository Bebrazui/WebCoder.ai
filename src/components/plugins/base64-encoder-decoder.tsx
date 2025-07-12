
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Base64EncoderDecoder() {
  const [plainText, setPlainText] = useState("");
  const [base64Text, setBase64Text] = useState("");
  const { toast } = useToast();

  const handleEncode = () => {
    if (!plainText) return;
    try {
      const encoded = btoa(unescape(encodeURIComponent(plainText)));
      setBase64Text(encoded);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Encoding Error",
        description: "Could not encode the text. Ensure it is valid UTF-8.",
      });
    }
  };
  
  const handleDecode = () => {
    if (!base64Text) return;
    try {
      const decoded = decodeURIComponent(escape(atob(base64Text)));
      setPlainText(decoded);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Decoding Error",
        description: "Invalid Base64 string.",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">Base64 Tool</h2>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="space-y-2">
            <Label htmlFor="plain-text">Plain Text</Label>
            <Textarea
              id="plain-text"
              placeholder="Type or paste text here"
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
            <Button onClick={handleEncode} className="w-full">Encode to Base64 &rarr;</Button>
          </div>
          
          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base64-text">Base64</Label>
            <Textarea
              id="base64-text"
              placeholder="Type or paste Base64 here"
              value={base64Text}
              onChange={(e) => setBase64Text(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
            <Button onClick={handleDecode} className="w-full">&larr; Decode from Base64</Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
