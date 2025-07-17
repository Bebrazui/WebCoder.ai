
"use client";

import { useEffect } from 'react';
import { useAppState } from '@/hooks/use-app-state';

/**
 * A client component that adds or removes a data attribute to the root <html> element
 * based on the 'animationsEnabled' setting. This allows CSS to conditionally
 * disable animations globally. It renders nothing itself.
 */
export function AnimationDisabler() {
    const { editorSettings } = useAppState();

    useEffect(() => {
        const root = document.documentElement;
        if (editorSettings.animationsEnabled) {
            root.removeAttribute('data-animations-disabled');
        } else {
            root.setAttribute('data-animations-disabled', 'true');
        }
    }, [editorSettings.animationsEnabled]);

    return null; // This component does not render any UI
}
