// src/components/synthesis-renderer.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';

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

const resolveValue = (valueNode: any, stateManager: any) => {
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
        default:
            return null;
    }
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
                const newValue = resolveValue(action.right, stateManager);
                updates[varName] = newValue;
            }
        });
        stateManager.updateState(updates);
    };
    
    // Find a custom component
    if (node.type === "Identifier" && components[node.name]) {
        const componentDef = components[node.name];
        // This is a simplification. A real implementation would map props correctly.
        return <NodeRenderer node={componentDef.body} stateManager={stateManager} components={components} />;
    }

    switch (node.type) {
        case 'VStack':
            return (
                <div className="flex flex-col items-start gap-2 p-4 border rounded-lg bg-white shadow-sm">
                    {node.children.map((child: any, index: number) => (
                        <NodeRenderer key={index} node={child} stateManager={stateManager} components={components} />
                    ))}
                </div>
            );
        case 'Text':
            return <p className="text-gray-800">{renderText(node.value)}</p>;
        case 'Button':
            return (
                <button
                    onClick={() => executeAction(node.action)}
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
            
            setCustomComponents(components);
            setMainComponent(main);
        }
    }, [uiJson]);

    const stateManager = useStateManager(mainComponent?.body?.states || []);
    
    if (!mainComponent) {
        return <div>No main window or component found in the compiled description.</div>;
    }

    return (
        <div className="font-sans">
            <h1 className="text-2xl font-bold mb-4">{mainComponent.title || 'SYNTHESIS App'}</h1>
            <NodeRenderer node={mainComponent.body} stateManager={stateManager} components={customComponents} />
        </div>
    );
}
