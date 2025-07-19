
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
    executeAsync: (action: any, currentScope: any) => Promise<any>;
} | null>(null);

const useStateManager = (initialStates: any[], parentScope?: any) => {
    const [state, setState] = useState(() => {
        const initialState: { [key: string]: any } = {};
        if (initialStates) {
            initialStates.forEach(s => {
                initialState[s.name] = resolveValue(s.initialValue, parentScope || { get: () => null });
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

// --- API Bridge ---
const APIBridge = {
    'Network.get': async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Network request failed for ${url}`);
            return res.json();
        } catch (e) {
            console.error("APIBridge Error:", e);
            return null; // Return null on network error
        }
    },
    'Storage.get': (key: string) => {
        if (typeof window === 'undefined') return null;
        try {
            const value = localStorage.getItem(key);
            if (value === null) return null;
            // Attempt to parse as JSON, otherwise return as string
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (e) {
            console.error("Storage.get Error:", e);
            return null;
        }
    },
    'Storage.set': (key: string, value: any) => {
         if (typeof window === 'undefined') return;
         try {
            const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, valueToStore);
         } catch(e) {
            console.error("Storage.set Error:", e);
         }
    },
    'OS.platform': 'web',
    'OS.screenWidth': typeof window !== 'undefined' ? window.innerWidth : 1024,
    'OS.screenHeight': typeof window !== 'undefined' ? window.innerHeight : 768,
    'OS.randomInt': () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
};

const resolveValue = (valueNode: any, scope: any): any => {
    if (valueNode === null || valueNode === undefined) return null;
    switch (valueNode.type) {
        case 'Identifier': return scope.get(valueNode.name);
        case 'Literal': 
            if (Array.isArray(valueNode.value)) {
                return valueNode.value.map((v: any) => resolveValue(v, scope));
            }
            return valueNode.value;
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
                case '&&': return left && right; case '||': return left || right;
                default: return false;
            }
        case 'UnaryExpression':
             const operand = resolveValue(valueNode.operand, scope);
             if (valueNode.operator === '!') return !operand;
             return operand;
        case 'FunctionCall':
            const func = APIBridge[valueNode.callee.name as keyof typeof APIBridge];
            if (typeof func === 'function') {
                 const resolvedArgs = valueNode.args.map((arg: any) => resolveValue(arg.value, scope));
                 return func(...resolvedArgs);
            }
            return func; // Return property value like OS.platform
        case 'StringLiteral':
            return valueNode.value.map((part: any) => part.type === 'StringInterpolation' ? resolveValue(part.expression, scope) : part.value).join('');
        default: return null;
    }
};

const executeAction = async (action: any, scope: any): Promise<any> => {
     if (!action) return;

     if (action.type === 'Assignment') {
        let varName: string;
        if (action.left.type === 'Identifier') {
            varName = action.left.name;
        } else if (action.left.type === 'MemberAccess') {
            // This is a simplification. A real implementation would need to handle nested member access
            const obj = scope.get(action.left.object.name);
            const prop = action.left.property;
            const newObj = { ...obj, [prop]: await resolveValue(action.right, scope) };
            scope.set(action.left.object.name, newObj);
            return;
        } else {
             return;
        }

        let newValue;
        if (action.isAwait) {
            newValue = await scope.executeAsync(action.right, scope);
        } else {
            newValue = resolveValue(action.right, scope);
        }
        scope.set(varName, newValue);
        return;
    } 
    
    if (action.type === 'ArrayPush') {
        const array = scope.get(action.object.name);
        if (Array.isArray(array)) {
            const valueToPush = resolveValue(action.value, scope);
            scope.set(action.object.name, [...array, valueToPush]);
        }
        return;
    }

    if (action.type === 'FunctionCall') {
        // Handle callbacks passed as props
        const callback = scope.get(action.callee.name);
        if (typeof callback === 'function') {
            const resolvedArgs = action.args.map((arg: any) => resolveValue(arg.value, scope));
            callback(...resolvedArgs);
            return;
        }
        await scope.executeAsync(action, scope);
        return;
    }

    if (Array.isArray(action)) { // For action blocks
        let lastReturnValue;
        for (const subAction of action) {
           lastReturnValue = await executeAction(subAction, scope);
        }
        return lastReturnValue;
    }
    
    if (action.type === 'VariableDeclaration') {
        let value;
        if(action.isAwait) {
            value = await scope.executeAsync(action.value, scope);
        } else {
            value = resolveValue(action.value, scope);
        }
        scope.set(action.name, value); // Assumes scope can handle declarations
        return;
    }
};

// --- Node Renderer Component ---

const NodeRenderer = ({ node }: { node: any }) => {
    const scope = useRendererState();
    
    if (!node) return null;
    
    const renderNode = (n: any, key?: number | string) => <NodeRenderer key={key} node={n} />;
    
    if (node.type === "ComponentCall") {
        const componentDef = scope.components[node.name];
        if (!componentDef) return <div className="text-red-500">Component '{node.name}' not found.</div>;
        
        const { state, get, set } = useStateManager(componentDef.states || [], scope);
        
        const componentScope = {
            ...scope,
            get: (key: string) => {
                if (key in state) return state[key];
                const propNode = node.args.find((a: any) => a.name === key);
                if (propNode) {
                    if (propNode.isBinding) {
                        return scope.get(propNode.value.name);
                    }
                    if (propNode.isCallback) {
                        return (...args: any[]) => {
                            const cbScope = {...scope, get: (k:string) => {
                                const paramIndex = propNode.params.findIndex((p:any) => p.name === k);
                                if (paramIndex !== -1) return args[paramIndex];
                                return scope.get(k);
                            }};
                            executeAction(propNode.value.body, cbScope);
                        };
                    }
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

    if (node.type === "IfStatement") {
        return resolveValue(node.condition, scope)
            ? <>{node.thenBranch.map(renderNode)}</>
            : <>{node.elseBranch?.map(renderNode) ?? null}</>;
    }
    
    if (node.type === 'ForEach') {
        const collection = resolveValue(node.collection, scope);
        if (!Array.isArray(collection)) return null;

        return collection.map((item, index) => {
            const loopScope = {
                ...scope,
                get: (key: string) => {
                    if (key === node.iterator) return item;
                    // Allow access to item properties e.g. task.title
                    if (key.startsWith(`${node.iterator}.`)) {
                        const prop = key.split('.').slice(1).join('.');
                        let current = item;
                        for(const p of prop.split('.')) current = current?.[p];
                        return current;
                    }
                    return scope.get(key);
                },
                set: (key: string, value: any) => {
                    if (key === node.iterator) {
                         const newCollection = [...collection];
                         newCollection[index] = value;
                         scope.set(node.collection.name, newCollection);
                    } else if (key.startsWith(`${node.iterator}.`)) {
                         const prop = key.split('.')[1];
                         const newCollection = [...collection];
                         newCollection[index] = {...item, [prop]: value};
                         scope.set(node.collection.name, newCollection);
                    } else {
                        scope.set(key, value);
                    }
                }
            };
            return <StateContext.Provider key={item.id || index} value={loopScope}>{node.body.map(renderNode)}</StateContext.Provider>;
        });
    }
    
    const style = applyModifiers(node.modifiers, scope);
    const commonProps: any = { style, onClick: () => node.onTap && executeAction(node.onTap.action, scope) };
    
    const renderText = (valueNode: any) => {
        if (!valueNode) return '';
        if (valueNode.type === 'StringLiteral') {
             return valueNode.value.map((part: any, index: number) => {
                const val = part.type === 'StringInterpolation' ? resolveValue(part.expression, scope) : part.value;
                return <React.Fragment key={index}>{val}</React.Fragment>;
            }).reduce((prev: any, curr: any) => <>{prev}{curr}</>, <></>);
        }
        return resolveValue(valueNode, scope);
    }

    switch (node.type) {
        case 'VStack':
            return <div {...commonProps} className="flex flex-col" style={{...style, alignItems: style.alignItems || 'flex-start', gap: resolveValue(node.spacing, scope)}}>{node.children.map(renderNode)}</div>;
        case 'HStack':
            return <div {...commonProps} className="flex" style={{...style, alignItems: style.alignItems || 'center', gap: resolveValue(node.spacing, scope)}}>{node.children.map(renderNode)}</div>;
        case 'Text':
            return <p {...commonProps}>{renderText(node.text)}</p>;
        case 'Image':
             return <img {...commonProps} src={resolveValue(node.source, scope)} alt="synthesis-image" />;
        case 'TextField':
             const boundValue = scope.get(node.binding.value.name);
             return <Input {...commonProps} type="text" placeholder={resolveValue(node.placeholder, scope)} value={boundValue === null || boundValue === undefined ? '' : boundValue} onChange={(e) => scope.set(node.binding.value.name, e.target.value)} />;
        case 'Button':
            return <Button {...commonProps} onClick={() => executeAction(node.action.body, scope)}>{renderText(node.text)}</Button>;
        case 'Checkbox':
            const onCheckedChange = (newValue: boolean) => {
                const isBound = node.checked.type === 'Binding';
                if (isBound) {
                    scope.set(node.checked.value.name, newValue);
                } else if(node.checked.type === 'MemberAccess') {
                    const objName = node.checked.object.name;
                    const propName = node.checked.property;
                    const oldObj = scope.get(objName);
                    const newObj = {...oldObj, [propName]: newValue};
                    scope.set(objName, newObj);
                }
                
                if (node.onToggle && node.onToggle.type === 'Callback') {
                     const actionScope = { ...scope, get: (k: string) => k === node.onToggle.params[0].name ? newValue : scope.get(k) };
                     executeAction(node.onToggle.body, actionScope);
                }
            }
            return <Checkbox {...commonProps} checked={resolveValue(node.checked, scope)} onCheckedChange={onCheckedChange} />;
        default:
            // This will render component calls that were not handled by the special case above.
            if(scope.components[node.type]) {
                const componentArgs = node.args || []; // Handle case where component call has no args
                return renderNode({ type: 'ComponentCall', name: node.type, args: componentArgs, line: node.line });
            }
            return null;
    }
};

export function SynthesisRenderer({ uiJson }: { uiJson: any }) {
    const rootState = useStateManager(uiJson.states);
    const effectsRef = useRef(uiJson.effects || []);
    
    const executeAsync = useCallback(async (action: any, currentScope: any) => {
        let calleeName = '';
        if (action.callee.type === 'Identifier') {
            calleeName = action.callee.name;
        } else if (action.callee.type === 'MemberAccess') {
            calleeName = `${action.callee.object.name}.${action.callee.property}`;
        }

        const func = APIBridge[calleeName as keyof typeof APIBridge];
        if (func) {
            const resolvedArgs = action.args.map((arg: any) => resolveValue(arg.value, currentScope));
            return await func(...resolvedArgs);
        }
    }, []);

    useEffect(() => {
        const effectScope = { ...rootState, executeAsync, get: rootState.get, set: rootState.set };

        // Run 'once' effects
        const runOnceEffects = async () => {
             for (const effect of effectsRef.current.filter((e:any) => e.args.some((a:any) => a.name === 'once' && a.value.value === true))) {
                await executeAction(effect.action, effectScope);
             }
        };
        runOnceEffects();
    }, []); // Empty dependency array ensures it runs only once on mount

    useEffect(() => {
        const effectScope = { ...rootState, executeAsync, get: rootState.get, set: rootState.set };
        // Run dependency-based effects
        const runDepEffects = async () => {
             for (const effect of effectsRef.current.filter((e:any) => e.args.some((a:any) => a.name === 'dependencies'))) {
                 await executeAction(effect.action, effectScope);
             }
        };
        runDepEffects();
    }, [rootState.state, executeAsync, rootState ]); // Re-run effects when root state changes


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
            case 'background': style.backgroundColor = resolveValue(getArg('color').value, scope); break;
            case 'foregroundColor': style.color = resolveValue(getArg('color').value, scope); break;
            case 'font':
                const fontStyle = resolveValue(mod.args[0].value, scope);
                if (fontStyle === 'title') { style.fontSize = '2rem'; style.fontWeight = 'bold'; }
                else if (fontStyle === 'headline') { style.fontSize = '1.5rem'; style.fontWeight = '600'; }
                else if (fontStyle === 'caption') { style.fontSize = '0.75rem'; style.opacity = 0.8; }
                break;
            case 'alignment':
                const align = resolveValue(mod.args[0].value, scope);
                if (align === 'leading') style.alignItems = 'flex-start';
                else if (align === 'center') style.alignItems = 'center';
                else if (align === 'trailing') style.alignItems = 'flex-end';
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
