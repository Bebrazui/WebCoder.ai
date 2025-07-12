
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UrlEncoderDecoder() {
  const [decodedUrl, setDecodedUrl] = useState("");
  const [encodedUrl, setEncodedUrl] = useState("");
  const { toast } = useToast();

  const handleEncode = () => {
    if (!decodedUrl) return;
    try {
      const encoded = encodeURIComponent(decodedUrl);
      setEncodedUrl(encoded);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Encoding Error",
        description: "Could not encode the URL.",
      });
    }
  };
  
  const handleDecode = () => {
    if (!encodedUrl) return;
    try {
      const decoded = decodeURIComponent(encodedUrl);
      setDecodedUrl(decoded);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Decoding Error",
        description: "Invalid URL-encoded string.",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 border-b border-border">
        <h2 className="text-lg font-headline font-semibold">URL Encoder/Decoder</h2>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="space-y-2">
            <Label htmlFor="decoded-url">Decoded URL</Label>
            <Textarea
              id="decoded-url"
              placeholder="https://example.com/a b"
              value={decodedUrl}
              onChange={(e) => setDecodedUrl(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
            <Button onClick={handleEncode} className="w-full">Encode &rarr;</Button>
          </div>
          
          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="encoded-url">Encoded URL</Label>
            <Textarea
              id="encoded-url"
              placeholder="https://example.com/a%20b"
              value={encodedUrl}
              onChange={(e) => setEncodedUrl(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
            <Button onClick={handleDecode} className="w-full">&larr; Decode</Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
