
"use client";

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';

interface CheerpJRunnerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  jarUrl: string;
}

declare let cheerpjInit: any;
declare let cheerpjRunJar: any;

const loadCheerpj = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Check if script already exists
        if (document.getElementById('cheerpj-loader-script')) {
            // If it exists, assume it's loaded or loading
            if (typeof cheerpjInit !== 'undefined') {
                resolve();
            } else {
                // Wait for it to load
                window.addEventListener('cheerpjready', () => resolve());
            }
            return;
        }

        const script = document.createElement('script');
        script.id = 'cheerpj-loader-script';
        script.src = 'https://cjrtnc.leaningtech.com/3.0/loader.js';
        script.async = true;
        script.onload = () => {
             // Dispatch a custom event to signal other components
            window.dispatchEvent(new Event('cheerpjready'));
            resolve();
        };
        script.onerror = (err) => {
            console.error("Failed to load CheerpJ script", err);
            reject(new Error("Failed to load CheerpJ script. Please check your network connection."));
        };
        document.head.appendChild(script);
    });
};


export function CheerpJRunnerDialog({ isOpen, onOpenChange, jarUrl }: CheerpJRunnerDialogProps) {
  const cheerpjContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isOpen && jarUrl) {
      setIsLoading(true);
      setErrorMessage(null);

      const runCheerpj = async () => {
        try {
          await loadCheerpj();
          
          if (!isMounted) return;

          // Now that script is loaded, cheerpjInit should be available
          if (typeof cheerpjInit === 'undefined') {
             throw new Error("CheerpJ initialized but `cheerpjInit` is not available. This should not happen.");
          }
          
          await cheerpjInit();

          if (!isMounted) return;

          const cheerpjGfx = document.getElementById('cheerpj-gfx');
          if (cheerpjGfx) {
             cheerpjGfx.innerHTML = ''; // Clear previous runs
          }

          console.log(`CheerpJ: Running JAR from ${jarUrl}`);
          await cheerpjRunJar(jarUrl);
          
          if (isMounted) {
            setIsLoading(false);
          }
        } catch (error: any) {
          console.error("CheerpJ failed to run:", error);
          if (isMounted) {
            setErrorMessage(`CheerpJ failed to run: ${error.message || 'Unknown error'}`);
            setIsLoading(false);
          }
        }
      };
      
      runCheerpj();
    }
    
    return () => {
        isMounted = false;
        // You might need cleanup logic here depending on CheerpJ API, 
        // e.g., cheerpjDestroy() if it exists
    }
  }, [isOpen, jarUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[80vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Java GUI Runner (CheerpJ)</DialogTitle>
          <DialogDescription>
            Running {jarUrl.split('/').pop()}... Please be patient, initial load may take a moment.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow relative bg-gray-800">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                    <LoaderCircle className="h-12 w-12 animate-spin text-white mb-4" />
                    <p className="text-white">CheerpJ is loading Java runtime...</p>
                </div>
            )}
            {errorMessage && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 text-center p-4">
                    <p className="text-red-400 font-semibold">Error:</p>
                    <p className="text-red-300">{errorMessage}</p>
                </div>
            )}
            <div 
                id="cheerpj-gfx"
                ref={cheerpjContainerRef} 
                className="w-full h-full cheerpj-container" 
            />
        </div>
        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
