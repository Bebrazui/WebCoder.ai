// src/lib/synthesis_compiler.ts

// --- 1. Определение токенов ---
enum TokenType {
    Keyword, Identifier, StringLiteral, NumberLiteral, Punctuation, Operator, InterpolationStart, EndOfFile
}

interface Token {
    type: TokenType;
    value?: string;
    line: number;
}

// --- 2. Лексер (Токенизатор) ---
class Lexer {
    private code: string; private position: number = 0; private line: number = 1;
    constructor(code: string) { this.code = code; }
    private isWhitespace(c: string): boolean { return /\s/.test(c); }
    private isAlpha(c: string): boolean { return /[a-zA-Z_]/.test(c); }
    private isDigit(c: string): boolean { return /\d/.test(c); }
    private isAlphaNumeric(c: string): boolean { return this.isAlpha(c) || this.isDigit(c); }
    private peek(): string | undefined { return this.code[this.position]; }
    private peekNext(): string | undefined { return this.code[this.position + 1]; }
    private advance(): string { const c = this.code[this.position++]; if (c === '\n') this.line++; return c; }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        const keywords = new Set(["@main", "@State", "func", "Window", "VStack", "HStack", "Text", "TextField", "Image", "Timer", "Button", "if", "else", "let", "in", "struct", "component", "font", "color", "padding", "background", "cornerRadius", "shadow", "Int", "String", "Void", "Bool", "frame", "foregroundColor", "backgroundColor", "position", "onAppear", "onTap"]);
        
        while (this.position < this.code.length) {
            const startLine = this.line;
            let char = this.peek();
            if (char === undefined) break;
            if (this.isWhitespace(char)) { this.advance(); continue; }
            if (char === '/' && this.peekNext() === '/') { while (this.peek() !== '\n' && this.peek() !== undefined) this.advance(); continue; }
            
            if (char === '"') {
                this.advance(); // Skip "
                let value = '';
                while (this.peek() !== '"' && this.peek() !== undefined) {
                    if (this.peek() === '\\' && this.peekNext() === '(') {
                        if (value.length > 0) tokens.push({ type: TokenType.StringLiteral, value, line: startLine });
                        this.advance(); this.advance(); // Skip \(
                        tokens.push({ type: TokenType.InterpolationStart, line: startLine });
                        value = '';
                    } else {
                        value += this.advance();
                    }
                }
                if (value.length > 0) tokens.push({ type: TokenType.StringLiteral, value, line: startLine });
                this.consume('"');
                continue;
            }

            if (this.isDigit(char) || (char === '-' && this.isDigit(this.peekNext()!))) {
                let value = this.advance();
                while (this.isDigit(this.peek() || '')) value += this.advance();
                tokens.push({ type: TokenType.NumberLiteral, value, line: startLine });
                continue;
            }

            if (this.isAlpha(char) || char === '@') {
                let value = ''; while (this.isAlphaNumeric(this.peek() || '') || this.peek() === '@' || this.peek() === '_') { value += this.advance(); }
                tokens.push({ type: keywords.has(value) ? TokenType.Keyword : TokenType.Identifier, value, line: startLine }); continue;
            }

            const twoCharOp = char + (this.peekNext() || '');
            if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoCharOp)) {
                tokens.push({ type: TokenType.Operator, value: twoCharOp, line: startLine });
                this.advance(); this.advance();
                continue;
            }

            const puncOp = "(){}.:;,?!<=>+-*/";
            if (puncOp.includes(char)) {
                tokens.push({ type: puncOp.includes(char) && '<=>+-*/'.includes(char) ? TokenType.Operator : TokenType.Punctuation, value: char, line: startLine });
                this.advance();
                continue;
            }

            throw new Error(`Unexpected character: ${char} at line ${startLine}`);
        }
        tokens.push({ type: TokenType.EndOfFile, line: this.line });
        return tokens;
    }
    private consume(char: string) { if(this.peek() !== char) throw new Error(`Expected '${char}' at line ${this.line}`); this.advance(); }
}


// --- 3. AST & Parser (Simplified) ---
interface Node { type: string; }
class Parser {
    private tokens: Token[]; private position: number = 0;
    constructor(tokens: Token[]) { this.tokens = tokens; }
    private peek(offset = 0): Token { return this.tokens[this.position + offset]; }
    private advance(): Token { return this.tokens[this.position++]; }
    private match(type: TokenType, value?: string): boolean { const t = this.peek(); return t.type === type && (value === undefined || t.value === value); }
    private consume(type: TokenType, value?: string): Token { if (!this.match(type, value)) throw new Error(`Expected ${TokenType[type]}${value ? `(${value})` : ''} but got ${TokenType[this.peek().type]}(${this.peek().value}) at line ${this.peek().line}`); return this.advance(); }
    
    private parsePrimaryExpr(): Node {
        if (this.match(TokenType.Identifier)) return { type: 'Identifier', name: this.advance().value! };
        if (this.match(TokenType.NumberLiteral)) return { type: 'Literal', value: Number(this.advance().value!) };
        if (this.match(TokenType.StringLiteral)) return { type: 'Literal', value: this.advance().value! };
        if (this.match(TokenType.Punctuation, '(')) { this.advance(); const expr = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); return expr; }
        throw new Error(`Unexpected token in expression: ${this.peek().value}`);
    }
    
    private parseBinaryExpr(left: Node, minPrecedence: number): Node {
        let lookahead = this.peek();
        while (lookahead.type === TokenType.Operator && this.getPrecedence(lookahead.value!) >= minPrecedence) {
            let op = this.advance();
            let right = this.parsePrimaryExpr();
            lookahead = this.peek();
            while (lookahead.type === TokenType.Operator && this.getPrecedence(lookahead.value!) > this.getPrecedence(op.value!)) {
                right = this.parseBinaryExpr(right, this.getPrecedence(lookahead.value!));
                lookahead = this.peek();
            }
            left = { type: 'BinaryExpression', operator: op.value!, left, right };
        }
        return left;
    }

    private getPrecedence(op: string): number {
        switch (op) { case '*': case '/': return 2; case '+': case '-': return 1; case '<': case '>': case '==': case '!=': return 0; default: return -1; }
    }
    
    private parseExpression(): Node { return this.parseBinaryExpr(this.parsePrimaryExpr(), 0); }
    private parseActionBlock(): Node[] { this.consume(TokenType.Punctuation, '{'); const actions = []; while (!this.match(TokenType.Punctuation, '}')) { actions.push(this.parseStatement()); } this.consume(TokenType.Punctuation, '}'); return actions; }
    private parseStatement(): Node { if (this.peek(1).value === "=") return this.parseAssignment(); return this.parseExpression(); }
    private parseAssignment(): Node { const left = this.parseExpression(); this.consume(TokenType.Operator, '='); const right = this.parseExpression(); return { type: 'Assignment', left, right }; }
    
    private parseView(): Node {
        const keyword = this.peek().value;
        switch (keyword) {
            case 'VStack': case 'HStack': return this.parseStack();
            case 'Text': return this.parseText();
            case 'Image': return this.parseImage();
            case 'TextField': return this.parseTextField();
            case 'Button': return this.parseButton();
            case 'if': return this.parseIf();
            case 'Timer': return this.parseTimer();
            default: throw new Error(`Unknown view component ${keyword}`);
        }
    }
    
    private parseText(): Node { this.consume(TokenType.Keyword, 'Text'); this.consume(TokenType.Punctuation, '('); const parts = []; while(!this.match(TokenType.Punctuation, ')')) { if(this.match(TokenType.InterpolationStart)) { this.advance(); parts.push({ type: 'Interpolation', expression: this.parseExpression() }); this.consume(TokenType.Punctuation,')'); } else { parts.push({ type: 'Literal', value: this.advance().value! }); } } this.consume(TokenType.Punctuation, ')'); return { type: 'Text', value: parts, modifiers: this.parseModifiers() }; }
    private parseImage(): Node { this.consume(TokenType.Keyword, 'Image'); this.consume(TokenType.Punctuation, '('); this.consume(TokenType.Identifier, 'source'); this.consume(TokenType.Punctuation, ':'); const source = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); return { type: 'Image', source, modifiers: this.parseModifiers() }; }
    private parseTextField(): Node { this.consume(TokenType.Keyword, 'TextField'); this.consume(TokenType.Punctuation, '('); const placeholder = this.consume(TokenType.StringLiteral).value!; this.consume(TokenType.Punctuation, ','); this.consume(TokenType.Identifier, 'text'); this.consume(TokenType.Punctuation, ':'); const binding = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); return { type: 'TextField', placeholder, binding, modifiers: this.parseModifiers() }; }
    private parseButton(): Node { this.consume(TokenType.Keyword, 'Button'); this.consume(TokenType.Punctuation, '('); const textParts = []; while(!this.match(TokenType.Punctuation, ')')) { textParts.push(this.advance().value!); } const text = [{type: 'Literal', value: textParts.join(' ')}]; this.consume(TokenType.Punctuation, ')'); const action = this.parseActionBlock(); return { type: 'Button', text, action, modifiers: this.parseModifiers() }; }
    private parseStack(): Node { const type = this.advance().value!; const children = []; if (this.match(TokenType.Punctuation, '{')) { this.advance(); while (!this.match(TokenType.Punctuation, '}')) { children.push(this.parseView()); } this.advance(); } return { type, children, modifiers: this.parseModifiers() }; }
    private parseIf(): Node { this.consume(TokenType.Keyword, 'if'); this.consume(TokenType.Punctuation, '('); const condition = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); const thenBranch = this.parseActionBlock(); let elseBranch = null; if (this.match(TokenType.Keyword, 'else')) { this.advance(); elseBranch = this.match(TokenType.Keyword, 'if') ? [this.parseIf()] : this.parseActionBlock(); } return { type: 'If', condition, thenBranch, elseBranch }; }
    private parseTimer(): Node { this.consume(TokenType.Keyword, 'Timer'); const action = this.parseActionBlock(); return { type: 'Timer', action }; }
    
    private parseModifiers(): Node[] { const modifiers = []; while (this.match(TokenType.Punctuation, '.')) { this.advance(); const name = this.consume(TokenType.Identifier).value!; const args: {[key:string]: Node} = {}; this.consume(TokenType.Punctuation, '('); while(!this.match(TokenType.Punctuation, ')')) { const argName = this.consume(TokenType.Identifier).value!; this.consume(TokenType.Punctuation, ':'); args[argName] = this.parseExpression(); if(this.match(TokenType.Punctuation,',')) this.advance(); } this.consume(TokenType.Punctuation, ')'); modifiers.push({ type: 'Modifier', name, args }); } return modifiers; }
    
    private parseComponentDef(): Node { this.consume(TokenType.Keyword, 'component'); const name = this.consume(TokenType.Identifier).value!; this.consume(TokenType.Punctuation, '('); this.consume(TokenType.Punctuation, ')'); let states: Node[] = []; let body: Node | null = null; this.consume(TokenType.Punctuation, '{'); while (!this.match(TokenType.Punctuation, '}')) { if (this.match(TokenType.Keyword, '@State')) { states.push(this.parseStateVar()); } else { if (!body) body = this.parseView(); } } this.consume(TokenType.Punctuation, '}'); return { type: 'ComponentDefinition', name, states, body }; }
    private parseStateVar(): Node { this.consume(TokenType.Keyword, '@State'); this.consume(TokenType.Keyword, 'let'); const name = this.consume(TokenType.Identifier).value!; this.consume(TokenType.Punctuation, ':'); const varType = this.consume(TokenType.Identifier).value!; this.consume(TokenType.Operator, '='); const initialValue = this.parseExpression(); return { type: 'State', name, varType, initialValue }; }
    
    public parse(): Node { const body = []; while(!this.match(TokenType.EndOfFile)) { if(this.peek(1)?.value === 'AppDelegate') { this.advance(); this.advance(); this.consume(TokenType.Punctuation,'{'); body.push({type: 'Window', title: this.consume(TokenType.StringLiteral).value, body: this.parseView()}); this.consume(TokenType.Punctuation,'}'); } else if (this.match(TokenType.Keyword, 'component')) { body.push(this.parseComponentDef()); } else this.advance(); } return { type: 'Program', body }; }
}

export function compileSynthesis(code: string): string {
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return JSON.stringify(ast, null, 2);
  } catch (e: any) {
    console.error("SYNTHESIS Compilation Error:", e);
    return JSON.stringify({ type: 'Error', message: e.message, stack: e.stack }, null, 2);
  }
}
