// src/components/synthesis-renderer.tsx
"use client";

import React, { useState, useEffect, useCallback, CSSProperties, useRef, createContext, useContext } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';

// --- State Management & Context ---

const StateContext = createContext<{
    get: (key: string) => any;
    set: (key: string, value: any, isRoot?: boolean) => void;
    components: Record<string, any>;
    executeAsync: (action: any) => Promise<any>;
} | null>(null);

const useStateManager = (initialStates: any[]) => {
    const [state, setState] = useState(() => {
        const initialState: { [key: string]: any } = {};
        if (initialStates) {
            initialStates.forEach(s => {
                initialState[s.name] = s.initialValue.value;
            });
        }
        return initialState;
    });

    const set = useCallback((key: string, value: any) => {
        setState(prev => ({ ...prev, [key]: value }));
    }, []);

    const get = (key: string) => state[key];
    
    return { state, get, set };
};

const useRendererState = () => {
    const context = useContext(StateContext);
    if (!context) throw new Error("useRendererState must be used within a StateProvider");
    return context;
};

// --- Value & Action Resolution ---

const resolveValue = (valueNode: any, scope: any): any => {
    if (!valueNode) return null;
    switch (valueNode.type) {
        case 'Identifier': return scope.get(valueNode.name);
        case 'Literal': return valueNode.value;
        case 'MemberAccess':
             const obj = resolveValue(valueNode.object, scope);
             return obj?.[valueNode.property] ?? null;
        case 'BinaryExpression':
            const left = resolveValue(valueNode.left, scope);
            const right = resolveValue(valueNode.right, scope);
            switch (valueNode.operator) {
                case '+': return left + right; case '-': return left - right;
                case '*': return left * right; case '/': return left / right;
                case '<': return left < right; case '>': return left > right;
                case '==': return left == right; case '!=': return left != right;
                default: return false;
            }
        case 'UnaryExpression':
             const operand = resolveValue(valueNode.operand, scope);
             if (valueNode.operator === '!') return !operand;
             return operand;
        default: return null;
    }
};

const executeAction = async (action: any, scope: any): Promise<void> => {
     if (!action) return;
     if (action.type === 'Assignment') {
        const varName = action.left.name;
        const newValue = resolveValue(action.right, scope);
        scope.set(varName, newValue);
    } else if (action.type === 'FunctionCall') {
        await scope.executeAsync(action);
    } else if (Array.isArray(action)) { // For action blocks
        for (const subAction of action) {
            await executeAction(subAction, scope);
        }
    }
};

// --- API Bridge ---
const APIBridge = {
    'Network.get': async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Network request failed for ${url}`);
        return res.json();
    }
};

// --- Node Renderer Component ---

const NodeRenderer = ({ node }: { node: any }) => {
    const scope = useRendererState();
    
    if (!node) return null;
    
    const renderNode = (n: any, key?: number | string) => <NodeRenderer key={key} node={n} />;
    
    // --- Component Call ---
    if (node.type === "ComponentCall") {
        const componentDef = scope.components[node.name];
        if (!componentDef) return <div className="text-red-500">Component '{node.name}' not found.</div>;
        
        // Setup state for this component instance
        const { state, get, set } = useStateManager(componentDef.states || []);
        
        // Create a new scope for the component instance
        const componentScope = {
            ...scope,
            get: (key: string) => {
                // Check local state first, then props, then parent scope
                if (key in state) return state[key];
                const propNode = node.args.find((a: any) => a.name === key);
                if (propNode) {
                    if (propNode.isBinding) return scope.get(propNode.value.name);
                    return resolveValue(propNode.value, scope);
                }
                return scope.get(key);
            },
            set: (key: string, value: any) => {
                 if (key in state) {
                    set(key, value);
                } else {
                    const propNode = node.args.find((a: any) => a.name === key);
                    if (propNode?.isBinding) {
                        scope.set(propNode.value.name, value);
                    }
                }
            }
        };
        
        return (
            <StateContext.Provider value={componentScope}>
                {componentDef.body.map(renderNode)}
            </StateContext.Provider>
        );
    }

    // --- Conditional & Loops ---
    if (node.type === "IfStatement") {
        return resolveValue(node.condition, scope)
            ? <>{node.thenBranch.map(renderNode)}</>
            : <>{node.elseBranch?.map(renderNode) ?? null}</>;
    }
    
    if (node.type === 'ForEach') {
        const collection = resolveValue(node.collection, scope);
        if (!Array.isArray(collection)) return null;

        return collection.map((item, index) => {
            // Create a temporary scope for each iteration
            const loopScope = {
                ...scope,
                get: (key: string) => {
                    if (key === node.iterator) return item;
                    return scope.get(key);
                }
            };
            return <StateContext.Provider key={index} value={loopScope}>{node.body.map(renderNode)}</StateContext.Provider>;
        });
    }
    
    // --- UI Element Rendering ---
    const style = applyModifiers(node.modifiers, scope);
    const commonProps: any = { style, onClick: () => node.onTap && executeAction(node.onTap.action, scope) };
    
    const renderText = (parts: any[]) => parts.map((part, index) => {
        const val = part.type === 'StringInterpolation' ? resolveValue(part.expression, scope) : part.value;
        return <React.Fragment key={index}>{val}</React.Fragment>;
    }).reduce((prev, curr) => <>{prev}{curr}</>, <></>);

    switch (node.type) {
        case 'VStack':
            return <div {...commonProps} className="flex flex-col items-center p-4" style={{...style, gap: resolveValue(node.spacing, scope)}}>{node.children.map(renderNode)}</div>;
        case 'HStack':
            return <div {...commonProps} className="flex items-center" style={{...style, gap: resolveValue(node.spacing, scope)}}>{node.children.map(renderNode)}</div>;
        case 'Text':
            return <p {...commonProps}>{renderText(node.value)}</p>;
        case 'Image':
             return <img {...commonProps} src={resolveValue(node.source, scope)} alt="synthesis-image" />;
        case 'TextField':
            return <Input {...commonProps} type="text" placeholder={resolveValue(node.placeholder, scope)} value={scope.get(node.binding.name) || ''} onChange={(e) => scope.set(node.binding.name, e.target.value)} />;
        case 'Button':
            return <Button {...commonProps} onClick={() => executeAction(node.action, scope)}>{renderText(node.text)}</Button>;
        case 'Checkbox':
             return <Checkbox {...commonProps} checked={resolveValue(node.checked, scope)} onCheckedChange={(val) => executeAction(node.action, {...scope, get: (k:string) => k === 'newValue' ? val : scope.get(k) })} />;
        default:
            return null; // Don't render unknown or non-UI nodes
    }
};

// --- Main Renderer & Helpers ---

export function SynthesisRenderer({ uiJson }: { uiJson: any }) {
    const rootState = useStateManager(uiJson.states);
    
    const executeAsync = useCallback(async (action: any) => {
        const { callee, args } = action;
        const func = APIBridge[callee.name as keyof typeof APIBridge];
        if (func) {
            const resolvedArgs = args.map((arg: any) => resolveValue(arg.value, rootState));
            return await func(...resolvedArgs);
        }
    }, [rootState]);

    useEffect(() => {
        uiJson.effects?.forEach((effect: any) => {
            let lastDeps: any[] = [];
            const runEffect = async () => {
                const newDeps = effect.dependencies.map((d: any) => resolveValue(d, rootState));
                if (JSON.stringify(newDeps) !== JSON.stringify(lastDeps)) {
                    lastDeps = newDeps;
                    for (const action of effect.action) {
                         const result = await executeAction(action, { ...rootState, executeAsync });
                         if(action.type === 'Assignment' && result) {
                            rootState.set(action.left.name, result);
                         }
                    }
                }
            };
            
            if (effect.isOnce) {
                runEffect();
            } else {
                 // This is where a proper dependency tracking system would go.
                 // For now, we simulate with an interval for demo purposes.
                 const interval = setInterval(runEffect, 500);
                 return () => clearInterval(interval);
            }
        });
    }, [uiJson.effects, rootState, executeAsync]);


    if (!uiJson?.body) {
        return <div className="p-4">No main window found.</div>;
    }
    
    const rootScope = { ...rootState, components: uiJson.components, executeAsync };

    return (
        <div className="font-sans w-full h-full text-white bg-gray-900 flex items-center justify-center p-4">
            <StateContext.Provider value={rootScope}>
                {uiJson.body.map((node: any, i: number) => <NodeRenderer key={i} node={node} />)}
            </StateContext.Provider>
        </div>
    );
}

const applyModifiers = (modifiers: any[], scope: any): CSSProperties => {
    const style: CSSProperties = {};
    if (!modifiers) return style;

    modifiers.forEach(mod => {
        const getArg = (name: string) => mod.args.find((a:any) => a.name === name);
        switch (mod.name) {
            case 'padding': style.padding = `${resolveValue(mod.args[0].value, scope)}px`; break;
            case 'frame':
                const width = getArg('width');
                const height = getArg('height');
                if (width) style.width = `${resolveValue(width.value, scope)}px`;
                if (height) style.height = `${resolveValue(height.value, scope)}px`;
                break;
            case 'backgroundColor': style.backgroundColor = resolveValue(getArg('color').value, scope); break;
            case 'foregroundColor': style.color = resolveValue(getArg('color').value, scope); break;
            case 'font':
                const fontStyle = resolveValue(mod.args[0].value, scope);
                if (fontStyle === 'title') { style.fontSize = '2rem'; style.fontWeight = 'bold'; }
                else if (fontStyle === 'headline') { style.fontSize = '1.5rem'; style.fontWeight = '600'; }
                break;
            case 'cornerRadius': style.borderRadius = `${resolveValue(getArg('radius').value, scope)}px`; break;
            case 'position':
                 style.position = 'absolute';
                 style.left = `${resolveValue(getArg('x').value, scope)}px`;
                 style.top = `${resolveValue(getArg('y').value, scope)}px`;
                 break;
        }
    });

    return style;
};
