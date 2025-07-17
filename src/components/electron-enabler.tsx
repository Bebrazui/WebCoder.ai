
"use client";

import { useEffect } from 'react';
import { useAppState } from '@/hooks/use-app-state';
import { useVfs } from '@/hooks/use-vfs';
import { useToast } from '@/hooks/use-toast';

export function ElectronEnabler() {
    const { setIsElectron } = useAppState();
    const { openPathWithApi } = useVfs();
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            setIsElectron(true);
            document.body.classList.add('electron-app');
            document.body.classList.add('has-[[data-is-electron=true]]:bg-transparent');

            const onOpenPath = async (path: string) => {
                toast({ title: 'Opening Path...', description: path });
                await openPathWithApi(path);
            };

            const cleanup = (window as any).electronAPI.onOpenPath(onOpenPath);

            return () => {
                // In a real scenario, the cleanup function returned by onOpenPath
                // would unregister the listener.
                // For now, this structure is prepared for that.
            };
        }
    }, [setIsElectron, openPathWithApi, toast]);

    return null; // This component doesn't render anything
}
