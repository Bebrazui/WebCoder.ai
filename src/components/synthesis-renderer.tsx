// src/components/synthesis-renderer.tsx
"use client";

import React, { useState, useEffect, useCallback, CSSProperties, useRef } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Input } from './ui/input';

const useStateManager = (initialStates: any[]) => {
    const [state, setState] = useState(() => {
        const initialState: { [key: string]: any } = {};
        if (initialStates) {
            initialStates.forEach(s => {
                const value = s.initialValue.value;
                initialState[s.name] = typeof value === 'string' && value.startsWith('data:') ? value : s.initialValue.value;
            });
        }
        return initialState;
    });

    const updateState = useCallback((updates: { [key: string]: any }) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    const getValue = (key: string) => state[key];

    return { state, updateState, getValue };
};

const resolveValue = (valueNode: any, stateManager: any): any => {
    if (!valueNode) return null;
    switch (valueNode.type) {
        case 'Interpolation':
            return stateManager.getValue(valueNode.expression.name);
        case 'Identifier':
            return stateManager.getValue(valueNode.name);
        case 'MemberAccess':
             const obj = resolveValue(valueNode.object, stateManager);
             return obj?.[valueNode.property] ?? null;
        case 'Literal':
             return valueNode.value;
        case 'BinaryExpression':
            const left = resolveValue(valueNode.left, stateManager);
            const right = resolveValue(valueNode.right, stateManager);
            switch (valueNode.operator) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return left / right;
                case '<': return left < right;
                case '>': return left > right;
                case '==': return left == right;
                case '!=': return left != right;
                default: return false;
            }
        default:
            return null;
    }
};

const applyModifiers = (modifiers: any[], stateManager: any): CSSProperties => {
    const style: CSSProperties = {};
    if (!modifiers) return style;

    modifiers.forEach(mod => {
        const args = mod.args;
        switch (mod.name) {
            case 'padding':
                style.padding = `${resolveValue(args.all, stateManager)}px`;
                break;
            case 'frame':
                if (args.width) style.width = `${resolveValue(args.width, stateManager)}px`;
                if (args.height) style.height = `${resolveValue(args.height, stateManager)}px`;
                break;
            case 'backgroundColor':
                style.backgroundColor = resolveValue(args.color, stateManager);
                break;
            case 'foregroundColor':
                style.color = resolveValue(args.color, stateManager);
                break;
            case 'font':
                const fontStyle = resolveValue(args.style, stateManager);
                if (fontStyle === 'title') { style.fontSize = '2rem'; style.fontWeight = 'bold'; }
                else if (fontStyle === 'headline') { style.fontSize = '1.5rem'; style.fontWeight = '600'; }
                break;
            case 'cornerRadius':
                style.borderRadius = `${resolveValue(args.radius, stateManager)}px`;
                break;
            case 'position':
                 style.position = 'absolute';
                 style.left = `${resolveValue(args.x, stateManager)}px`;
                 style.top = `${resolveValue(args.y, stateManager)}px`;
                 break;
            case 'onTap':
            case 'onAppear':
                break; // Handled separately
        }
    });

    return style;
};

const NodeRenderer = ({ node, stateManager, components }: { node: any, stateManager: any, components: any }) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    const executeAction = useCallback((actions: any[]) => {
        const updates: { [key: string]: any } = {};
        actions.forEach(action => {
            if (action.type === 'Assignment') {
                const varName = action.left.name;
                const newValue = resolveValue(action.right, stateManager);
                updates[varName] = newValue;
            } else if (action.type === 'CallExpression' && action.callee.type === 'MemberAccess' && action.callee.object.name === 'Timer') {
                // Timer is handled globally, so we do nothing here.
            }
        });
        stateManager.updateState(updates);
    }, [stateManager]);

    const onAppearModifier = node.modifiers?.find((m: any) => m.name === 'onAppear');
    const onTapModifier = node.modifiers?.find((m: any) => m.name === 'onTap');

    useEffect(() => {
        if (onAppearModifier && elementRef.current && !isVisible) {
            const observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    executeAction(onAppearModifier.action);
                    observer.disconnect();
                }
            });
            observer.observe(elementRef.current);
            return () => observer.disconnect();
        }
    }, [onAppearModifier, executeAction, isVisible]);
    
    if (!node) return null;
    
    if (node.type === "ComponentCall") {
        const componentDef = components[node.name];
        if (componentDef) {
            // Create a new state manager for the component instance
            const componentStateManager = useStateManager(componentDef.states || []);
            return <NodeRenderer node={componentDef.body} stateManager={componentStateManager} components={components} />;
        }
    }

    const style = applyModifiers(node.modifiers, stateManager);

    const renderText = (parts: any[]) => {
        return parts.map((part, index) => {
            const val = resolveValue(part, stateManager);
            return <React.Fragment key={index}>{val}</React.Fragment>
        }).reduce((prev, curr) => <>{prev}{curr}</>, <></>);
    }
    
    const handleTap = () => {
        if (onTapModifier) {
            executeAction(onTapModifier.action);
        }
    }

    const commonProps: any = {
        style,
        onClick: handleTap,
        ref: elementRef,
    };

    switch (node.type) {
        case 'VStack':
            return <div {...commonProps} className="flex flex-col items-center p-4 gap-4">{node.children.map((c: any, i: number) => <NodeRenderer key={i} node={c} stateManager={stateManager} components={components} />)}</div>;
        case 'HStack':
            return <div {...commonProps} className="flex items-center gap-4">{node.children.map((c: any, i: number) => <NodeRenderer key={i} node={c} stateManager={stateManager} components={components} />)}</div>;
        case 'Text':
            return <p {...commonProps} className="text-xl">{renderText(node.value)}</p>;
        case 'Image':
             const src = resolveValue(node.source, stateManager);
             return <div {...commonProps}><img src={src} alt="synthesis-image" style={{width: '100%', height: '100%'}} /></div>;
        case 'TextField':
            return <Input {...commonProps} type="text" placeholder={node.placeholder} value={stateManager.getValue(node.binding.name) || ''} onChange={(e) => stateManager.updateState({ [node.binding.name]: e.target.value })} />;
        case 'Button':
            return <Button {...commonProps} onClick={() => executeAction(node.action)}>{renderText(node.text)}</Button>;
        case 'If':
             return resolveValue(node.condition, stateManager) ? <>{node.thenBranch.map((c: any, i: number) => <NodeRenderer key={i} node={c} stateManager={stateManager} components={components} />)}</> : <>{node.elseBranch?.map((c: any, i: number) => <NodeRenderer key={i} node={c} stateManager={stateManager} components={components} />) ?? null}</>;
        case 'Timer':
            return null; // Timer is not a rendered component
        default:
            return <div className="text-red-500">Unknown node: {node.type}</div>;
    }
};

export function SynthesisRenderer({ uiJson }: { uiJson: any }) {
    const [mainComponent, setMainComponent] = useState<any>(null);
    const [customComponents, setCustomComponents] = useState<any>({});
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (uiJson && uiJson.body) {
            const components: any = {};
            let main: any = null;

            uiJson.body.forEach((node: any) => {
                if (node.type === 'ComponentDefinition') {
                    components[node.name] = node;
                } else if (node.type === 'Window') {
                    main = node;
                }
            });
            
            if (!main && Object.keys(components).length > 0) {
                 const mainComponentName = Object.keys(components).find(name => name.toLowerCase().includes('main') || name.toLowerCase().includes('app')) || Object.keys(components)[0];
                 main = { type: "Window", title: "SYNTHESIS App", body: { type: "ComponentCall", name: mainComponentName }};
            }
            
            setCustomComponents(components);
            setMainComponent(main);
        }
    }, [uiJson]);
    
    if (!mainComponent) {
        return <div className="p-4">No main window or component found.</div>;
    }
    
    let componentDefToRender: any = null;
    let initialState: any[] = [];
    if (mainComponent.body.type === 'ComponentCall') {
        componentDefToRender = customComponents[mainComponent.body.name];
        initialState = componentDefToRender?.states || [];
    } else {
        componentDefToRender = { body: mainComponent.body, states: [] };
    }
    
    if (!componentDefToRender) {
        return <div className="p-4">Could not find component to render.</div>
    }

    const stateManager = useStateManager(initialState);

    const findTimers = (node: any): any[] => {
        let timers: any[] = [];
        if (!node) return timers;
        if (node.type === 'Timer') timers.push(node);
        if(node.type === 'ComponentCall') {
            const component = customComponents[node.name];
            if(component) {
                 timers = timers.concat(findTimers(component.body));
            }
        }
        if (node.children) {
            for (const child of node.children) {
                timers = timers.concat(findTimers(child));
            }
        }
        return timers;
    };
    
    const timers = findTimers(componentDefToRender.body);

    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (timers.length > 0) {
            const timerNode = timers[0]; // Assuming one timer for now
            const interval = 16; // 60fps
            
            timerRef.current = setInterval(() => {
                const updates: { [key: string]: any } = {};
                 timerNode.action.forEach((action: any) => {
                    if (action.type === 'Assignment') {
                        const varName = action.left.name;
                        const newValue = resolveValue(action.right, stateManager);
                        updates[varName] = newValue;
                    }
                });
                stateManager.updateState(updates);
            }, interval);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timers, stateManager]);


    return (
        <div className="font-sans w-full h-full text-white relative bg-gray-900 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                <NodeRenderer node={componentDefToRender.body} stateManager={stateManager} components={customComponents} />
            </div>
        </div>
    );
}
