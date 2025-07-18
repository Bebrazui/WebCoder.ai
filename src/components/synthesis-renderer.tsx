// src/components/synthesis-renderer.tsx
"use client";

import React, { useState, useEffect, useCallback, CSSProperties } from 'react';

// A simple state manager for the renderer
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
            const expr = valueNode.expression;
            if (expr.type === 'Identifier') {
                return stateManager.getValue(expr.name);
            }
            return `{${expr.name}}`;
        case 'Identifier':
            return stateManager.getValue(valueNode.name);
        case 'Literal':
        case 'String':
             return valueNode.value;
        case 'BinaryExpression':
            const left = resolveValue(valueNode.left, stateManager);
            const right = resolveValue(valueNode.right, stateManager);
            switch (valueNode.operator) {
                case '<': return left < right;
                case '>': return left > right;
                case '==': return left == right;
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
        switch (mod.name) {
            case 'padding':
                style.padding = `${resolveValue(mod.args[0], stateManager)}px`;
                break;
            case 'backgroundColor':
                style.backgroundColor = resolveValue(mod.args[0], stateManager);
                break;
            case 'foregroundColor':
                style.color = resolveValue(mod.args[0], stateManager);
                break;
             case 'font':
                const fontStyle = resolveValue(mod.args[0], stateManager);
                if (fontStyle === 'title') {
                    style.fontSize = '24px';
                    style.fontWeight = 'bold';
                } else if (fontStyle === 'headline') {
                    style.fontSize = '18px';
                    style.fontWeight = '600';
                }
                break;
             case 'color':
                 style.color = resolveValue(mod.args[0], stateManager);
                 break;
            case 'cornerRadius':
                style.borderRadius = `${resolveValue(mod.args[0], stateManager)}px`;
                break;
        }
    });

    return style;
};


const NodeRenderer = ({ node, stateManager, components }: { node: any, stateManager: any, components: any }) => {
    if (!node) return null;

    const renderText = (parts: any[]) => {
        return parts.map((part, index) => {
            const val = resolveValue(part, stateManager);
            return <React.Fragment key={index}>{val}</React.Fragment>
        }).reduce((prev, curr) => <>{prev}{curr}</>, <></>);
    }

    const executeAction = (actions: any[]) => {
        const updates: { [key: string]: any } = {};
        actions.forEach(action => {
            if (action.type === 'Assignment') {
                const varName = action.left.name;
                const rightSide = action.right;
                let newValue;
                if (rightSide.type === 'BinaryExpression') {
                    const leftVal = resolveValue(rightSide.left, stateManager);
                    const rightVal = resolveValue(rightSide.right, stateManager);
                    if (rightSide.operator === '+') newValue = leftVal + rightVal;
                    else if (rightSide.operator === '-') newValue = leftVal - rightVal;
                } else {
                    newValue = resolveValue(action.right, stateManager);
                }
                updates[varName] = newValue;
            }
        });
        stateManager.updateState(updates);
    };
    
    // Find a custom component
    if (node.type === "ComponentCall") {
        const componentDef = components[node.name];
        if (componentDef) {
            // This is a simplification. A real implementation would map props correctly.
            return <NodeRenderer node={componentDef.body} stateManager={stateManager} components={components} />;
        }
    }

    const style = applyModifiers(node.modifiers, stateManager);

    switch (node.type) {
        case 'VStack':
            return (
                <div style={style} className="flex flex-col items-start gap-2 p-4 border rounded-lg bg-white shadow-sm">
                    {node.children.map((child: any, index: number) => (
                        <NodeRenderer key={index} node={child} stateManager={stateManager} components={components} />
                    ))}
                </div>
            );
         case 'HStack':
            return (
                <div style={style} className="flex flex-row items-center gap-4">
                    {node.children.map((child: any, index: number) => (
                        <NodeRenderer key={index} node={child} stateManager={stateManager} components={components} />
                    ))}
                </div>
            );
        case 'Text':
            return <p style={style} className="text-gray-800">{renderText(node.value)}</p>;
        case 'TextField':
            return (
                <input
                    type="text"
                    placeholder={node.placeholder}
                    value={stateManager.getValue(node.binding.name) || ''}
                    onChange={(e) => stateManager.updateState({ [node.binding.name]: e.target.value })}
                    style={style}
                    className="px-3 py-2 border rounded-md"
                />
            );
        case 'Button':
            return (
                <button
                    onClick={() => executeAction(node.action)}
                    style={style}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    {renderText(node.text)}
                </button>
            );
        case 'If':
             const conditionValue = resolveValue(node.condition, stateManager);
             if (conditionValue) {
                 return <>{node.thenBranch.map((child: any, index: number) => <NodeRenderer key={index} node={child} stateManager={stateManager} components={components} />)}</>;
             } else if(node.elseBranch) {
                 return <>{node.elseBranch.map((child: any, index: number) => <NodeRenderer key={index} node={child} stateManager={stateManager} components={components} />)}</>;
             }
             return null;
        default:
            return <div className="text-red-500">Unknown node type: {node.type}</div>;
    }
};

export function SynthesisRenderer({ uiJson }: { uiJson: any }) {
    const [mainComponent, setMainComponent] = useState<any>(null);
    const [customComponents, setCustomComponents] = useState<any>({});

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
            
            // If no window, find first component
            if (!main && Object.keys(components).length > 0) {
                const firstCompName = Object.keys(components)[0];
                main = components[firstCompName];
            }
            
            setCustomComponents(components);
            setMainComponent(main);
        }
    }, [uiJson]);

    let states: any[] = [];
    if (mainComponent) {
        if (mainComponent.type === 'Window') {
            const firstChild = mainComponent.body;
            if (firstChild && firstChild.type === 'ComponentCall') {
                const componentDef = customComponents[firstChild.name];
                if (componentDef) {
                    states = componentDef.states || [];
                }
            }
        } else if (mainComponent.type === 'ComponentDefinition') {
            states = mainComponent.states || [];
        }
    }
    
    const stateManager = useStateManager(states);
    
    if (!mainComponent) {
        return <div className="p-4">No main window or component found in the compiled description.</div>;
    }
    
    let renderBody = mainComponent.body;
    // If main is a component, its body is the thing to render
    if (mainComponent.type === 'ComponentDefinition') {
        renderBody = mainComponent.body;
    }
    // If main is a window, its body is a component call, so we need to find that component's body
    else if (mainComponent.type === 'Window' && mainComponent.body.type === 'ComponentCall') {
         const componentDef = customComponents[mainComponent.body.name];
         if (componentDef) {
             renderBody = componentDef.body;
         }
    }

    return (
        <div className="font-sans">
            <h1 className="text-2xl font-bold mb-4">{mainComponent.title || mainComponent.name || 'SYNTHESIS App'}</h1>
            <NodeRenderer node={renderBody} stateManager={stateManager} components={customComponents} />
        </div>
    );
}
