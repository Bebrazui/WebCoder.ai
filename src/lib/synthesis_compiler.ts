// src/lib/synthesis_compiler.ts

// --- 1. Token Definitions ---
enum TokenType {
    Keyword, Identifier, StringLiteral, NumberLiteral,
    Punctuation, Operator, InterpolationStart, EndOfFile,
    BooleanLiteral, Comment
}
interface Token { type: TokenType; value?: string; line: number; }

// --- 2. Lexer ---
class Lexer {
    private code: string; private position: number = 0; private line: number = 1;
    private keywords = new Set(["@main", "@State", "@binding", "@effect", "func", "Window", "VStack", "HStack", "Text", "TextField", "Image", "Timer", "Button", "if", "else", "let", "in", "struct", "component", "font", "padding", "background", "foregroundColor", "cornerRadius", "shadow", "frame", "position", "onAppear", "onTap", "async", "await", "ForEach", "Checkbox", "import", "alignment", "spacing", "nil", "var"]);
    private booleanLiterals = new Set(["true", "false"]);

    constructor(code: string) { this.code = code; }
    private isWhitespace(c: string): boolean { return /\s/.test(c); }
    private isAlpha(c: string): boolean { return /[a-zA-Z_]/.test(c); }
    private isDigit(c: string): boolean { return /\d/.test(c); }
    private isAlphaNumeric(c: string): boolean { return this.isAlpha(c) || this.isDigit(c); }
    private peek(offset = 0): string | undefined { return this.code[this.position + offset]; }
    private advance(): string { const c = this.code[this.position++]; if (c === '\n') this.line++; return c; }
    private error(message: string): never { throw new Error(`Lexer Error (line ${this.line}): ${message}`); }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.position < this.code.length) {
            const startLine = this.line; let char = this.peek(); if (char === undefined) break;
            if (char === '/' && this.peek(1) === '/') {
                this.advance(); this.advance(); let value = '';
                while (this.peek() !== '\n' && this.peek() !== undefined) value += this.advance();
                tokens.push({ type: TokenType.Comment, value, line: startLine });
                continue;
            }
            if (this.isWhitespace(char)) { this.advance(); continue; }
            if (char === '"') {
                this.advance(); let value = '';
                while (this.peek() !== '"' && this.peek() !== undefined) {
                    if (this.peek() === '\\' && this.peek(1) === '(') {
                        if (value) tokens.push({ type: TokenType.StringLiteral, value, line: startLine });
                        this.advance(); this.advance(); tokens.push({ type: TokenType.InterpolationStart, line: startLine }); value = '';
                    } else value += this.advance();
                }
                if (value) tokens.push({ type: TokenType.StringLiteral, value, line: startLine });
                if(this.peek() !== '"') this.error("Unterminated string literal.");
                this.advance(); continue;
            }
            if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)!))) { let value = this.advance(); while (this.isDigit(this.peek() || '')) value += this.advance(); tokens.push({ type: TokenType.NumberLiteral, value, line: startLine }); continue; }
            if (this.isAlpha(char) || char === '@') {
                let value = ''; while (this.peek() !== undefined && (this.isAlphaNumeric(this.peek()!) || this.peek() === '@')) { value += this.advance(); }
                if (this.keywords.has(value)) tokens.push({ type: TokenType.Keyword, value, line: startLine });
                else if (this.booleanLiterals.has(value)) tokens.push({ type: TokenType.BooleanLiteral, value, line: startLine });
                else tokens.push({ type: TokenType.Identifier, value: value, line: startLine });
                continue;
            }
            const twoCharOp = char + (this.peek(1) || ''); if (['==', '!=', '<=', '>=', '->', '&&', '||'].includes(twoCharOp)) { tokens.push({ type: TokenType.Operator, value: twoCharOp, line: startLine }); this.advance(); this.advance(); continue; }
            if ("(){}[].,:".includes(char)) { tokens.push({ type: TokenType.Punctuation, value: char, line: startLine }); this.advance(); continue; }
            if (";?!<=>+-*/&|".includes(char)) { tokens.push({ type: TokenType.Operator, value: char, line: startLine }); this.advance(); continue; }
            this.error(`Unexpected character: ${char}`);
        }
        tokens.push({ type: TokenType.EndOfFile, line: this.line }); return tokens;
    }
}

// --- 3. AST & Parser ---
interface Node { type: string; line?: number; }
class Parser {
    private tokens: Token[]; private position: number = 0;
    constructor(tokens: Token[]) { this.tokens = tokens.filter(t => t.type !== TokenType.Comment); }
    private peek(offset = 0): Token { return this.tokens[this.position + offset]; }
    private advance(): Token { return this.tokens[this.position++]; }
    private match(type: TokenType, value?: string): boolean { const t = this.peek(); if (t.type === TokenType.EndOfFile) return false; return t.type === type && (value === undefined || t.value === value); }
    private consume(type: TokenType, value?: string): Token { const t = this.peek(); if (t.type !== type || (value !== undefined && t.value !== value)) throw new Error(`Parser Error (line ${t.line}): Expected ${TokenType[type]} ${value || ''}, got ${TokenType[t.type]} '${t.value || ''}'`); return this.advance(); }
    private getPrecedence(op: string): number { switch (op) { case '||': return 1; case '&&': return 2; case '==': case '!=': return 3; case '<': case '>': case '<=': case '>=': return 4; case '+': case '-': return 5; case '*': case '/': return 6; default: return -1; } }

    private parsePrimary(): Node {
        const currentToken = this.peek();
        if (this.match(TokenType.NumberLiteral)) return { type: 'Literal', value: Number(this.consume(TokenType.NumberLiteral).value), line: currentToken.line };
        if (this.match(TokenType.StringLiteral)) return { type: 'Literal', value: this.consume(TokenType.StringLiteral).value, line: currentToken.line };
        if (this.match(TokenType.Keyword, 'nil')) { this.consume(TokenType.Keyword, 'nil'); return { type: 'Literal', value: null, line: currentToken.line }; }
        if (this.match(TokenType.BooleanLiteral)) return { type: 'Literal', value: this.consume(TokenType.BooleanLiteral).value === 'true', line: currentToken.line };
        if (this.match(TokenType.Punctuation, '[')) return this.parseArrayLiteral();
        if (this.match(TokenType.Operator, '!')) { this.advance(); return { type: 'UnaryExpression', operator: '!', operand: this.parsePrimary(), line: currentToken.line }; }
        if (this.match(TokenType.Punctuation, '(')) { this.advance(); const expr = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); return expr; }
        
        if (this.match(TokenType.Identifier)) { 
             let object = this.consume(TokenType.Identifier);
             let expression: Node = { type: 'Identifier', name: object.value, line: object.line };

             while (this.match(TokenType.Punctuation, '.') || this.match(TokenType.Punctuation, '(')) {
                 if (this.match(TokenType.Punctuation, '.')) {
                     this.advance();
                     const property = this.consume(TokenType.Identifier);
                     expression = { type: 'MemberAccess', object: expression, property: property.value, line: property.line };
                 } else if (this.match(TokenType.Punctuation, '(')) {
                    const args = this.parseArguments();
                    expression = { type: 'FunctionCall', callee: expression, args, line: expression.line };
                 }
             }
            return expression;
        }
        throw new Error(`Unexpected token in expression on line ${currentToken.line}: ${this.peek().value}`);
    }
    
    private parseInterpolatedString(): Node {
        const currentToken = this.peek();
        const parts: any[] = [];
        do {
            if(this.match(TokenType.StringLiteral)) parts.push({ type: 'Literal', value: this.advance().value });
            if(this.match(TokenType.InterpolationStart)) {
                this.advance();
                parts.push({ type: 'StringInterpolation', expression: this.parseExpression() });
                this.consume(TokenType.Punctuation, ')');
            }
        } while(this.match(TokenType.StringLiteral) || this.match(TokenType.InterpolationStart));
        return { type: 'StringLiteral', value: parts, line: currentToken.line };
    }

    private parseArguments() {
        const args: any[] = [];
        this.consume(TokenType.Punctuation, '(');
        while (!this.match(TokenType.Punctuation, ')')) {
            let name;
            if (this.peek(1).value === ':') {
                name = this.consume(TokenType.Identifier).value;
                this.consume(TokenType.Punctuation, ':');
            }
            const value = this.parseExpression();
            const arg:any = { type: 'Argument', value };
            if (name) arg.name = name;
            args.push(arg);
            if (this.match(TokenType.Punctuation, ',')) this.advance();
        }
        this.consume(TokenType.Punctuation, ')');
        return args;
    }
    
    private parseBinary(left: Node, minPrecedence: number): Node {
        let lookahead = this.peek();
        while (lookahead.type === TokenType.Operator && this.getPrecedence(lookahead.value!) >= minPrecedence) {
            let op = this.advance(); let right = this.parsePrimary();
            lookahead = this.peek();
            while (lookahead.type === TokenType.Operator && this.getPrecedence(lookahead.value!) > this.getPrecedence(op.value!)) {
                right = this.parseBinary(right, this.getPrecedence(lookahead.value!));
                lookahead = this.peek();
            }
            left = { type: 'BinaryExpression', operator: op.value!, left, right, line: left.line };
        }
        return left;
    }
    
    private parseExpression(): Node { 
        if(this.match(TokenType.StringLiteral) && this.peek(1).type === TokenType.InterpolationStart) {
             return this.parseInterpolatedString();
        }
        return this.parseBinary(this.parsePrimary(), 0); 
    }

    private parseArgument(): Node {
        const nameToken = this.consume(TokenType.Identifier);
        this.consume(TokenType.Punctuation, ':');
        if (this.match(TokenType.Keyword, '@binding')) {
            this.advance();
            const value = this.parseExpression();
            return { type: 'Binding', name: nameToken.value, value, line: nameToken.line };
        }
        if (this.match(TokenType.Punctuation, '{')) {
            const value = this.parseCallback();
            return { type: 'Argument', name: nameToken.value, value, isCallback: true, params: (value as any).params };
        }
        const value = this.parseExpression();
        return { type: 'Argument', name: nameToken.value, value, line: nameToken.line };
    }

    private parseAction(): Node[] { this.consume(TokenType.Punctuation, '{'); const actions = []; while (!this.match(TokenType.Punctuation, '}')) { actions.push(this.parseStatement()); } this.consume(TokenType.Punctuation, '}'); return actions; }
    
    private parseCallback(): Node { 
        const startToken = this.peek(); 
        this.consume(TokenType.Punctuation, '{'); 
        const params: any[] = [];
        if (this.match(TokenType.Punctuation, '(')) {
            this.advance();
             while(!this.match(TokenType.Punctuation, ')')) { 
                params.push({type: 'Identifier', name: this.consume(TokenType.Identifier).value!});
                if(this.match(TokenType.Punctuation,',')) this.advance();
            } 
            this.consume(TokenType.Punctuation, ')'); 
            this.consume(TokenType.Keyword, 'in'); 
        }
        const body = this.parseAction(); 
        return { type: 'Callback', params, body, line: startToken.line }; 
    }
    
    private parseStatement(): Node {
        if (this.match(TokenType.Keyword, 'let') || this.match(TokenType.Keyword, 'var')) return this.parseLet();
        if (this.match(TokenType.Keyword, 'if')) return this.parseIf();
        
        // This handles component calls as statements
        if (this.match(TokenType.Identifier) && /^[A-Z]/.test(this.peek().value!)) {
            return this.parseView();
        }
        
        const expression = this.parseExpression();
        if (expression.type === 'MemberAccess' || expression.type === 'Identifier') {
             if (this.match(TokenType.Operator, '=')) {
                this.consume(TokenType.Operator, '=');
                let isAwait = false;
                if (this.match(TokenType.Keyword, 'await')) { isAwait = true; this.advance(); }
                const right = this.parseExpression();
                return { type: 'Assignment', left: expression, right, isAwait, line: expression.line };
            }
        }
        if (expression.type === 'FunctionCall' && expression.callee.type === 'MemberAccess' && expression.callee.property === 'push') {
             return { type: 'ArrayPush', object: expression.callee.object, value: expression.args[0].value, line: expression.line };
        }

        return expression;
    }

    private parseLet(): Node { 
        const startToken = this.consume(TokenType.Keyword); 
        const name = this.consume(TokenType.Identifier).value; 
        this.consume(TokenType.Punctuation, ':'); 
        let varType = this.consume(TokenType.Identifier).value; 
        let isArray = false; 
        if (this.match(TokenType.Punctuation, '[')) { 
            this.advance(); this.consume(TokenType.Punctuation, ']'); 
            isArray = true; varType = `[${varType}]`; 
        } 
        this.consume(TokenType.Operator, '='); 
        let isAwait = false; 
        if (this.match(TokenType.Keyword, 'await')) { isAwait = true; this.advance(); } 
        const value = this.parseExpression(); 
        return { type: 'VariableDeclaration', name, value, isAwait, mutable: startToken.value === 'var', line: startToken.line }; 
    }
    
    private parseIf(): Node { const startToken = this.consume(TokenType.Keyword, 'if'); const condition = this.parseExpression(); const thenBranch = this.parseAction(); let elseBranch = null; if (this.match(TokenType.Keyword, 'else')) { this.advance(); elseBranch = this.parseAction(); } return { type: 'IfStatement', condition, thenBranch, elseBranch, line: startToken.line }; }
    private parseForEach(): Node { const startToken = this.consume(TokenType.Keyword, 'ForEach'); this.consume(TokenType.Punctuation, '('); const collection = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); this.consume(TokenType.Punctuation, '{'); const iterator = this.consume(TokenType.Identifier).value; this.consume(TokenType.Keyword, 'in'); const body = []; while(!this.match(TokenType.Punctuation, '}')) { body.push(this.parseStatement()); } this.consume(TokenType.Punctuation, '}'); return { type: 'ForEach', collection, iterator, body, line: startToken.line }; }
    
    private parseView(): Node {
        const calleeToken = this.consume(TokenType.Identifier);
        const callee = calleeToken.value!;
        
        let args: Node[] = [];
        let action: Node | Node[] | null = null;

        if (this.match(TokenType.Punctuation, '(')) {
            this.consume(TokenType.Punctuation, '(');
            while (!this.match(TokenType.Punctuation, ')')) {
                if (this.peek(1).value === ':') {
                    args.push(this.parseArgument());
                } else {
                    args.push({ type: 'Argument', value: this.parseExpression() });
                }
                if (this.match(TokenType.Punctuation, ',')) this.advance();
            }
            this.consume(TokenType.Punctuation, ')');
        }
        
        if (this.match(TokenType.Punctuation, '{')) { 
            if (this.peek(1).value === '(') {
                action = this.parseCallback();
            } else {
                 action = this.parseAction(); 
            }
        }
        
        const modifiers = this.parseModifiers();
        let children = []; 
        if (Array.isArray(action) && callee.match(/VStack|HStack|Window/)) { 
            children = action;
            action = null; 
        }

        const unnamedArg = args.find((a: any) => !a.name);

        return { 
            type: callee,
            line: calleeToken.line,
            // Extract specific properties for easier access in renderer
            text: callee === 'Text' ? (unnamedArg as any)?.value : (callee === 'Button' ? (unnamedArg as any)?.value : null),
            placeholder: callee === 'TextField' ? (unnamedArg as any)?.value : null,
            children,
            action: callee === 'Button' ? action : null, 
            modifiers, 
            // Keep original args for bindings and named properties
            args,
            // Specific argument helpers
            binding: (args.find(a => a.type === 'Binding') as any),
            checked: (args.find((a: any) => a.name === 'checked') as any)?.value,
            onToggle: (args.find((a: any) => a.name === 'onToggle') as any)?.value,
            source: (args.find((a: any) => a.name === 'source') as any)?.value,
            spacing: (args.find((a: any) => a.name === 'spacing') as any)?.value,
            alignment: (args.find((a: any) => a.name === 'alignment') as any)?.value,
        };
    }
    
    private parseModifiers(): Node[] { const modifiers = []; while (this.match(TokenType.Punctuation, '.')) { this.advance(); const name = this.consume(TokenType.Identifier).value; const args: Node[] = []; if (this.match(TokenType.Punctuation, '(')) { this.consume(TokenType.Punctuation, '('); while (!this.match(TokenType.Punctuation, ')')) { if (this.peek(1).value === ':') args.push(this.parseArgument()); else args.push({ type: 'Argument', value: this.parseExpression() }); if (this.match(TokenType.Punctuation, ',')) this.advance(); } this.consume(TokenType.Punctuation, ')'); } modifiers.push({ type: 'Modifier', name, args }); } return modifiers; }
    
    private parseArrayLiteral(): Node {
        const startToken = this.consume(TokenType.Punctuation, '[');
        const elements: Node[] = [];
        if (!this.match(TokenType.Punctuation, ']')) {
            do {
                if (this.match(TokenType.Punctuation, ',')) this.advance();
                elements.push(this.parseExpression());
            } while (this.match(TokenType.Punctuation, ','));
        }
        this.consume(TokenType.Punctuation, ']');
        return { type: 'Literal', value: elements, line: startToken.line };
    }

    private parseStateVar(): Node { 
        const startToken = this.consume(TokenType.Keyword, '@State'); 
        const name = this.consume(TokenType.Identifier).value; 
        this.consume(TokenType.Punctuation, ':'); 
        
        let varType: string;
        let isArray = false;
        if (this.match(TokenType.Punctuation, '[')) {
            this.consume(TokenType.Punctuation, '[');
            varType = this.consume(TokenType.Identifier).value!;
            this.consume(TokenType.Punctuation, ']');
            isArray = true;
        } else {
            varType = this.consume(TokenType.Identifier).value!;
        }
        
        this.consume(TokenType.Operator, '='); 
        const initialValue = this.parseExpression(); 
        return { type: 'State', name, varType: isArray ? `[${varType}]` : varType, initialValue, isArray, line: startToken.line }; 
    }
    
    private parseComponentDef(): Node {
        const startToken = this.consume(TokenType.Keyword, 'component');
        const name = this.consume(TokenType.Identifier).value;
        this.consume(TokenType.Punctuation, '(');
        const params: any[] = [];
    
        if (!this.match(TokenType.Punctuation, ')')) {
            while (true) {
                let isBinding = false;
                if (this.match(TokenType.Keyword, '@binding')) {
                    this.advance();
                    isBinding = true;
                }
                const paramName = this.consume(TokenType.Identifier).value;
                this.consume(TokenType.Punctuation, ':');

                let typeInfo: any = {};
                if (this.match(TokenType.Punctuation, '(')) {
                    typeInfo.isCallback = true;
                    this.advance(); // consume '('
                    const cbParams: any[] = [];
                    if (!this.match(TokenType.Punctuation, ')')) {
                        while(true) { 
                            const pName = this.consume(TokenType.Identifier).value;
                            this.consume(TokenType.Punctuation,':');
                            const pType = this.consume(TokenType.Identifier).value;
                            cbParams.push({ name: pName, type: pType});
                            if(!this.match(TokenType.Punctuation,',')) break;
                            this.advance();
                        }
                    }
                    this.advance(); // consume ')'
                    this.consume(TokenType.Operator, '->');
                    typeInfo.returnType = this.consume(TokenType.Identifier).value; // Allows 'Void' etc.
                    typeInfo.params = cbParams;

                } else {
                    typeInfo.typeName = this.consume(TokenType.Identifier).value;
                    if (this.match(TokenType.Punctuation, '[')) {
                        this.advance(); this.consume(TokenType.Punctuation, ']');
                        typeInfo.isArray = true;
                    }
                }
                params.push({ type: 'Parameter', name: paramName, ...typeInfo, isBinding, line: startToken.line });
                
                if (!this.match(TokenType.Punctuation, ',')) break;
                this.advance(); // consume comma
            }
        }
        this.consume(TokenType.Punctuation, ')');

        const states = []; let effects: Node[] = []; let body = [];
        this.consume(TokenType.Punctuation, '{');
        while (!this.match(TokenType.Punctuation, '}')) {
            if (this.match(TokenType.Keyword, '@State')) states.push(this.parseStateVar());
            else if (this.match(TokenType.Keyword, '@effect')) effects.push(this.parseEffect());
            else body.push(this.parseStatement());
        }
        this.consume(TokenType.Punctuation, '}');
        return { type: 'ComponentDefinition', name, params, states, effects, body, line: startToken.line };
    }
    
    private parseEffect(): Node { const startToken = this.consume(TokenType.Keyword, '@effect'); this.consume(TokenType.Punctuation, '('); const args:any[] = []; while(!this.match(TokenType.Punctuation,')')) { args.push(this.parseArgument()); } this.consume(TokenType.Punctuation, ')'); const action = this.parseAction(); return { type: 'Effect', args, action, line: startToken.line }; }

    private parseStructDef(): Node {
        const startToken = this.consume(TokenType.Keyword, 'struct');
        const name = this.consume(TokenType.Identifier).value;
        this.consume(TokenType.Punctuation, '{');
        const properties = [];
        while(!this.match(TokenType.Punctuation, '}')) {
            const propName = this.consume(TokenType.Identifier).value;
            this.consume(TokenType.Punctuation, ':');
            const propType = this.consume(TokenType.Identifier).value;
            this.consume(TokenType.Operator, ';');
            properties.push({ name: propName, type: propType });
        }
        this.consume(TokenType.Punctuation, '}');
        return { type: 'StructDefinition', name, properties, line: startToken.line };
    }

    private parseTopLevel(): Node[] {
        const nodes: Node[] = [];
        while(!this.match(TokenType.EndOfFile)) {
             if (this.match(TokenType.Keyword, 'import')) { this.advance(); this.consume(TokenType.StringLiteral); } // Skip imports
             else if (this.match(TokenType.Keyword, '@main')) { nodes.push(this.parseEntryPoint()); }
             else if (this.match(TokenType.Keyword, 'component')) { nodes.push(this.parseComponentDef()); }
             else if (this.match(TokenType.Keyword, 'struct')) { nodes.push(this.parseStructDef()); }
             else { 
                const t = this.peek();
                throw new Error(`Parser Error: Unexpected token at top level: ${TokenType[t.type]} '${t.value || ''}' on line ${t.line}`);
             }
        }
        return nodes;
    }
    
    private parseEntryPoint(): Node {
        const startToken = this.consume(TokenType.Keyword, '@main');
        this.consume(TokenType.Keyword, 'func');
        this.consume(TokenType.Identifier); // AppDelegate
        this.consume(TokenType.Punctuation, '{');
        const body = [];
        while(!this.match(TokenType.Punctuation, '}')) {
            body.push(this.parseStatement());
        }
        this.consume(TokenType.Punctuation, '}');
        return { type: 'Program', body: (body[0] as any).children, line: startToken.line };
    }

    public parse(): Node {
        const topLevelNodes = this.parseTopLevel();
        const program = topLevelNodes.find(n => n.type === 'Program') || { type: 'Program', body: [] };
        
        const allComponentDefs = topLevelNodes.filter(n => n.type === 'ComponentDefinition');
        const components = allComponentDefs.reduce((acc, curr: any) => ({ ...acc, [curr.name]: curr }), {});
        
        const mainComponentDef = allComponentDefs.find(c => (c as any).body.some((n: any) => n.type === 'VStack')); // Heuristic to find main component
        const states = mainComponentDef ? (mainComponentDef as any).states : [];
        const effects = mainComponentDef ? (mainComponentDef as any).effects : [];
        
        return { ...program, components, states, effects };
    }
}

export function compileSynthesis(code: string, allFiles: VFSNode[]): string {
  try {
    // Basic import handling
    const importRegex = /import\s+"([^"]+)"/g;
    let fullCode = code;
    let match;
    const processedImports = new Set<string>();

    const processCode = (codeToProcess: string) => {
        let currentCode = codeToProcess;
        while((match = importRegex.exec(currentCode)) !== null) {
            const importPath = `/${match[1]}`;
            if (processedImports.has(importPath)) continue;
            processedImports.add(importPath);

            const fileContent = findFileContentRecursive(allFiles, importPath);
            if(fileContent) {
                fullCode += `\n${fileContent}`;
                processCode(fileContent); // Recursively process imports
            } else {
                console.warn(`Warning: Could not resolve import for "${importPath}"`);
            }
        }
    }
    processCode(code);
    
    const lexer = new Lexer(fullCode);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return JSON.stringify(ast, (key, value) => (key === 'line' ? undefined : value), 2);
  } catch (e: any) {
    console.error("SYNTHESIS Compilation Error:", e);
    return JSON.stringify({ type: 'Error', message: e.message, stack: e.stack }, null, 2);
  }
}

const findFileContentRecursive = (nodes: VFSNode[], targetPath: string): string | null => {
    for(const node of nodes) {
        // Adjust path to always start with /
        const nodePath = node.path.startsWith('/') ? node.path : `/${node.path}`;
        const searchPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
        
        if (node.type === 'file' && nodePath === searchPath) {
            return node.content;
        }
        if (node.type === 'directory') {
            const found = findFileContentRecursive(node.children, searchPath);
            if (found) return found;
        }
    }
    return null;
}
