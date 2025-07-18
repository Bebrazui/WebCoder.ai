// src/lib/synthesis_compiler.ts

// --- 1. Определение токенов ---
enum TokenType {
  Keyword,       // @main, @State, func, Window, VStack, HStack, Text, TextField, Image, Timer, font, color, struct, component, if, else, let, in, Button, style, padding, background, cornerRadius, shadow, alignment, spacing, frame, foregroundColor, backgroundColor, position, onAppear, onTap
  Identifier,    // Имена переменных, функций, компонентов
  StringLiteral, // "Hello World!"
  NumberLiteral, // 10, 20
  Punctuation,   // (, ), {, }, ., :, ;, =, ,, ?, !, \, <, >, =>
  Operator,      // =, ==, <, >, +, -
  InterpolationStart, // \(
  EndOfFile
}

interface Token {
  type: TokenType;
  value?: string;
  line: number;
}

// --- 2. Лексер (Токенизатор) ---
class Lexer {
  private code: string;
  private position: number = 0;
  private line: number = 1;

  constructor(code: string) {
    this.code = code;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private peek(): string | undefined {
    return this.code[this.position];
  }
  
  private peekNext(): string | undefined {
    return this.code[this.position + 1];
  }

  private advance(): string | undefined {
    const char = this.code[this.position++];
    if (char === '\n') {
      this.line++;
    }
    return char;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    const keywords = new Set([
      "@main", "@State", "func", "Window", "VStack", "HStack", "Text", "TextField", "Image", "Timer", "font", "color", "struct",
      "component", "if", "else", "let", "in", "Button", "style", "padding",
      "background", "cornerRadius", "shadow", "alignment", "spacing", "Int", "String", "Void", "Bool",
      "frame", "foregroundColor", "backgroundColor", "position", "onAppear", "onTap"
    ]);

    while (this.position < this.code.length) {
      const startLine = this.line;
      let char = this.peek();

      if (char === undefined) break;

      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }
      
      if (char === '/' && this.peekNext() === '/') {
        while(this.peek() !== '\n' && this.peek() !== undefined) this.advance();
        continue;
      }

      if (char === '"') {
        this.advance();
        let value = '';
        while (this.peek() !== '"' && this.peek() !== undefined) {
          if (this.peek() === '\\' && this.peekNext() === '(') {
             if (value) tokens.push({ type: TokenType.StringLiteral, value: value, line: startLine });
            this.advance();
            this.advance();
            tokens.push({ type: TokenType.InterpolationStart, line: this.line });
            value = '';
            continue;
          }
          value += this.advance();
        }
        if (this.peek() !== '"') {
            throw new Error(`Unterminated string literal at line ${startLine}`);
        }
        this.advance();
        if (value.length > 0 || tokens[tokens.length-1]?.type === TokenType.InterpolationStart) {
             tokens.push({ type: TokenType.StringLiteral, value: value, line: startLine });
        }
        continue;
      }

      if (this.isDigit(char) || (char === '-' && this.isDigit(this.peekNext()!))) {
        let value = this.advance()!;
        while (this.isDigit(this.peek() || '') && this.peek() !== undefined) {
          value += this.advance();
        }
        tokens.push({ type: TokenType.NumberLiteral, value: value, line: startLine });
        continue;
      }

      if (this.isAlpha(char) || char === '@') {
        let value = '';
        while (this.isAlphaNumeric(this.peek() || '') || this.peek() === '@' || this.peek() === '_') {
          value += this.advance();
        }
        if (keywords.has(value)) {
          tokens.push({ type: TokenType.Keyword, value: value, line: startLine });
        } else {
          tokens.push({ type: TokenType.Identifier, value: value, line: startLine });
        }
        continue;
      }

      if (char === '=' && this.peekNext() === '=') {
        this.advance();
        this.advance();
        tokens.push({ type: TokenType.Operator, value: '==', line: startLine });
        continue;
      }

      const punctuationAndOperators: {[key: string]: TokenType} = {
        '(': TokenType.Punctuation, ')': TokenType.Punctuation,
        '{': TokenType.Punctuation, '}': TokenType.Punctuation,
        '.': TokenType.Punctuation, ':': TokenType.Punctuation,
        ';': TokenType.Punctuation, ',': TokenType.Punctuation,
        '?': TokenType.Punctuation, '!': TokenType.Punctuation,
        '<': TokenType.Operator, '>': TokenType.Operator,
        '=': TokenType.Operator, '+': TokenType.Operator, '-': TokenType.Operator
      };
      if (char in punctuationAndOperators) {
        tokens.push({ type: punctuationAndOperators[char], value: char, line: startLine });
        this.advance();
      } else {
         throw new Error(`Unexpected character: ${char} at line ${startLine}`);
      }
    }

    tokens.push({ type: TokenType.EndOfFile, line: this.line });
    return tokens;
  }
}

// --- 3. AST Nodes ---
interface Node { type: string; }
interface ProgramNode extends Node { type: "Program"; body: Node[]; }
interface ComponentDefinitionNode extends Node { type: "ComponentDefinition"; name: string; states: StateDefinitionNode[]; body: Node; }
interface StateDefinitionNode extends Node { type: "StateDefinition"; name: string; typeName: string, initialValue: Node; }
interface AssignmentNode extends Node { type: "Assignment"; left: Node; right: Node; }
interface BinaryExpressionNode extends Node { type: "BinaryExpression"; left: Node; operator: string; right: Node; }
interface WindowNode extends Node { type: "Window"; title: string; body: Node; }
interface VStackNode extends Node { type: "VStack"; children: Node[]; modifiers: ModifierNode[]; }
interface HStackNode extends Node { type: "HStack"; children: Node[]; modifiers: ModifierNode[]; }
interface TextNode extends Node { type: "Text"; value: (string | Node)[]; modifiers: ModifierNode[]; }
interface TextFieldNode extends Node { type: "TextField"; placeholder: string; binding: IdentifierNode; modifiers: ModifierNode[]; }
interface ImageNode extends Node { type: "Image"; source: Node; modifiers: ModifierNode[]; }
interface TimerNode extends Node { type: "Timer"; action: Node[]; }
interface IfNode extends Node { type: "If"; condition: Node; thenBranch: Node[]; elseBranch: Node[] | null; }
interface ButtonNode extends Node { type: "Button"; text: (string | Node)[]; action: Node[]; modifiers: ModifierNode[]; }
interface ModifierNode extends Node { type: "Modifier"; name: string; args: { [key: string]: Node }; }
interface StringInterpolationNode extends Node { type: "StringInterpolation"; expression: Node; }
interface LiteralNode extends Node { type: "Literal"; value: string | number | boolean; }
interface IdentifierNode extends Node { type: "Identifier"; name: string; }
interface MemberAccessNode extends Node { type: "MemberAccess"; object: Node; property: string; }
interface CallExpressionNode extends Node { type: "CallExpression"; callee: Node; args: Node[]; }

// --- 4. Parser ---
class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) { this.tokens = tokens; }
  private peek(): Token { return this.tokens[this.position]; }
  private isAtEnd(): boolean { return this.peek().type === TokenType.EndOfFile; }
  private advance(): Token { if (!this.isAtEnd()) this.position++; return this.tokens[this.position - 1]; }
  
  private check(type: TokenType, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private match(...types: {type: TokenType, value?: string}[]): Token | null {
    for (const t of types) {
      if (this.check(t.type, t.value)) {
        return this.advance();
      }
    }
    return null;
  }
  
  private consume(type: TokenType, value?: string, errorMessage?: string): Token {
    if (this.check(type, value)) return this.advance();
    const token = this.peek();
    throw new Error(errorMessage || `Expected ${TokenType[type]}${value ? `('${value}')` : ''} but got ${TokenType[token.type]} ('${token.value || ''}') at line ${token.line}`);
  }
  
   private parseExpression(): Node {
        return this.parseBinaryExpression();
    }

    private parseBinaryExpression(parentPrecedence: number = 0): Node {
        let left = this.parsePrimaryExpression();

        while (true) {
            const token = this.peek();
            const precedence = this.getOperatorPrecedence(token);
            if (precedence === 0 || precedence <= parentPrecedence) {
                break;
            }

            this.advance();
            const right = this.parseBinaryExpression(precedence);
            left = { type: 'BinaryExpression', left, operator: token.value!, right };
        }
        return left;
    }

    private getOperatorPrecedence(token: Token): number {
        if (token.type !== TokenType.Operator) return 0;
        switch (token.value) {
            case '+':
            case '-':
                return 1;
            case '*':
            case '/':
                return 2;
            case '==':
            case '<':
            case '>':
                return 3;
            default:
                return 0;
        }
    }

  private parsePrimaryExpression(): Node {
    let token = this.peek();
    let node: Node;

    if (token.type === TokenType.NumberLiteral) {
        node = { type: "Literal", value: parseInt(this.advance().value!) };
    } else if (token.type === TokenType.StringLiteral) {
        node = { type: "Literal", value: this.advance().value! };
    } else if (token.type === TokenType.Identifier) {
        node = { type: "Identifier", name: this.advance().value! };
    } else if (this.match({type: TokenType.Punctuation, value: '('})) {
        node = this.parseExpression();
        this.consume(TokenType.Punctuation, ')');
    } else {
        throw new Error(`Unexpected token in expression: ${token.value} at line ${token.line}`);
    }
    
    while(this.match({type: TokenType.Punctuation, value: '.'})) {
      const property = this.consume(TokenType.Identifier, undefined, "Expected property name after '.'.").value!;
      node = { type: "MemberAccess", object: node, property };
    }
    
    if (this.check(TokenType.Punctuation, '(')) {
        this.advance(); // consume '('
        const args: Node[] = [];
        if (!this.check(TokenType.Punctuation, ')')) {
            do {
                args.push(this.parseExpression());
            } while(this.match({type: TokenType.Punctuation, value: ','}));
        }
        this.consume(TokenType.Punctuation, ')');
        node = { type: "CallExpression", callee: node, args };
    }
    return node;
  }
  
  private parseTextContent(): (string | Node)[] {
    const parts: (string | Node)[] = [];
    while(!this.check(TokenType.Punctuation, ')')) {
      if (this.check(TokenType.StringLiteral)) {
        parts.push(this.advance().value!);
      } else if (this.match({type: TokenType.InterpolationStart})) {
        const expression = this.parseExpression();
        this.consume(TokenType.Punctuation, ')', "Expected ')' after interpolation expression.");
        parts.push({ type: "StringInterpolation", expression });
      } else {
        throw new Error(`Unexpected token in Text content: ${this.peek().value} at line ${this.peek().line}`);
      }
    }
    return parts;
  }
  
  private parseModifier(): ModifierNode {
    this.consume(TokenType.Punctuation, '.');
    const name = this.consume(TokenType.Identifier).value!;
    const args: { [key: string]: Node } = {};
    if (this.match({type: TokenType.Punctuation, value: '('})) {
      if (!this.check(TokenType.Punctuation, ')')) {
        do {
            const argName = this.consume(TokenType.Identifier).value!;
            this.consume(TokenType.Punctuation, ':');
            args[argName] = this.parseExpression();
        } while (this.match({type: TokenType.Punctuation, value: ','}));
      }
      this.consume(TokenType.Punctuation, ')');
    }
    return { type: "Modifier", name, args };
  }
  
  private parseBlock(isFunc: boolean = false): Node[] {
    const nodes: Node[] = [];
    this.consume(TokenType.Punctuation, '{', "Expected '{' to start a block.");
    while(!this.check(TokenType.Punctuation, '}')) {
        nodes.push(this.parseStatement(isFunc));
    }
    this.consume(TokenType.Punctuation, '}', "Expected '}' to end a block.");
    return nodes;
  }

  private parseStatement(isFunc: boolean = false): Node {
    let node: Node;
    const token = this.peek();

    if (token.type === TokenType.Keyword) {
      switch (token.value) {
        case 'Text': node = this.parseText(); break;
        case 'VStack': node = this.parseVStack(); break;
        case 'HStack': node = this.parseHStack(); break;
        case 'Image': node = this.parseImage(); break;
        case 'TextField': node = this.parseTextField(); break;
        case 'Button': node = this.parseButton(); break;
        case 'if': node = this.parseIf(); break;
        case 'Timer': node = this.parseTimer(); break;
        default: throw new Error(`Unexpected keyword statement: ${token.value}`);
      }
    } else if (token.type === TokenType.Identifier) {
        node = this.parseAssignmentOrCall();
    } else {
        throw new Error(`Unexpected token at start of statement: ${token.value}`);
    }

    const modifiers: ModifierNode[] = [];
    while (this.check(TokenType.Punctuation, '.')) {
        modifiers.push(this.parseModifier());
    }
    (node as any).modifiers = modifiers;
    return node;
  }
  
  private parseAssignmentOrCall(): Node {
    const expr = this.parseExpression();
    if (expr.type === 'Identifier' && this.check(TokenType.Operator, '=')) {
        this.consume(TokenType.Operator, '=');
        const right = this.parseExpression();
        return { type: 'Assignment', left: expr, right };
    }
    return expr;
  }
  
  private parseText = (): TextNode => { this.advance(); this.consume(TokenType.Punctuation, '('); const v = this.parseTextContent(); this.consume(TokenType.Punctuation, ')'); return { type: 'Text', value: v, modifiers:[] }; }
  private parseImage = (): ImageNode => { this.advance(); this.consume(TokenType.Punctuation, '('); const s = this.parseExpression(); this.consume(TokenType.Punctuation, ')'); return { type: 'Image', source: s, modifiers:[] }; }
  private parseVStack = (): VStackNode => { this.advance(); return { type: 'VStack', children: this.parseBlock(), modifiers: [] }; }
  private parseHStack = (): HStackNode => { this.advance(); return { type: 'HStack', children: this.parseBlock(), modifiers: [] }; }
  private parseTextField = (): TextFieldNode => { this.advance(); this.consume(TokenType.Punctuation, '('); const p = this.consume(TokenType.StringLiteral).value!; this.consume(TokenType.Punctuation, ','); const b = this.parseExpression() as IdentifierNode; this.consume(TokenType.Punctuation, ')'); return { type: "TextField", placeholder: p, binding: b, modifiers: [] }; }
  private parseButton = (): ButtonNode => { this.advance(); this.consume(TokenType.Punctuation, '('); const t = this.parseTextContent(); this.consume(TokenType.Punctuation, ')'); const a = this.parseBlock(true); return { type: "Button", text: t, action: a, modifiers: [] }; }
  private parseTimer = (): TimerNode => { this.advance(); const a = this.parseBlock(true); return { type: "Timer", action: a }; }
  private parseIf = (): IfNode => { this.advance(); const c = this.parseExpression(); const t = this.parseBlock(); let e = null; if (this.match({type: TokenType.Keyword, value: 'else'})) { e = this.parseBlock(); } return { type: "If", condition: c, thenBranch: t, elseBranch: e }; }
  
  private parseTopLevel(): Node {
    if (this.check(TokenType.Keyword, 'component')) return this.parseComponent();
    if (this.check(TokenType.Keyword, '@main')) return this.parseMainFunc();
    const token = this.peek();
    throw new Error(`Unexpected top-level token: ${token.value} at line ${token.line}`);
  }
  
  private parseStateDefinition(): StateDefinitionNode {
      this.consume(TokenType.Keyword, '@State');
      this.consume(TokenType.Keyword, 'let');
      const name = this.consume(TokenType.Identifier).value!;
      this.consume(TokenType.Punctuation, ':');
      const typeName = this.consume(TokenType.Identifier).value!;
      this.consume(TokenType.Operator, '=');
      const initialValue = this.parseExpression();
      return { type: "StateDefinition", name, typeName, initialValue };
  }
  
  private parseComponent(): ComponentDefinitionNode {
      this.consume(TokenType.Keyword, 'component');
      const name = this.consume(TokenType.Identifier).value!;
      this.consume(TokenType.Punctuation, '('); this.consume(TokenType.Punctuation, ')');
      
      this.consume(TokenType.Punctuation, '{');
      const states: StateDefinitionNode[] = [];
      while(this.check(TokenType.Keyword, '@State')) {
          states.push(this.parseStateDefinition());
      }
      const body = this.parseStatement();
      this.consume(TokenType.Punctuation, '}');

      return { type: "ComponentDefinition", name, states, body };
  }
  
  private parseMainFunc(): WindowNode {
      this.consume(TokenType.Keyword, '@main');
      this.consume(TokenType.Keyword, 'func');
      this.consume(TokenType.Identifier, 'AppDelegate');
      this.consume(TokenType.Punctuation, '{');
      this.consume(TokenType.Keyword, 'Window');
      this.consume(TokenType.Punctuation, '(');
      const title = this.consume(TokenType.StringLiteral).value!;
      this.consume(TokenType.Punctuation, ')');
      const body = this.parseStatement();
      this.consume(TokenType.Punctuation, '}');
      return { type: "Window", title, body };
  }

  public parse(): ProgramNode {
    const program: ProgramNode = { type: "Program", body: [] };
    while (!this.isAtEnd()) {
      program.body.push(this.parseTopLevel());
    }
    return program;
  }
}

// --- 5. Code Generator (JSON Description) ---
class JsonDescriptionGenerator {
  constructor(private ast: ProgramNode) {}
  
  generate(): any {
    return this.generateNode(this.ast);
  }
  
  private generateNode(node: Node): any {
    const generatorMap: {[key: string]: (n: any) => any} = {
        'Program': (n) => ({ type: 'Program', body: n.body.map((b: Node) => this.generateNode(b)) }),
        'Window': (n) => ({ type: 'Window', title: n.title, body: this.generateNode(n.body) }),
        'ComponentDefinition': (n) => ({ type: 'ComponentDefinition', name: n.name, states: n.states.map((s: Node) => this.generateNode(s)), body: this.generateNode(n.body) }),
        'StateDefinition': (n) => ({ type: 'State', name: n.name, typeName: n.typeName, initialValue: this.generateNode(n.initialValue) }),
        'VStack': (n) => ({ type: 'VStack', children: n.children.map((c: Node) => this.generateNode(c)), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'HStack': (n) => ({ type: 'HStack', children: n.children.map((c: Node) => this.generateNode(c)), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'Text': (n) => ({ type: 'Text', value: n.value.map((p: string | Node) => typeof p === 'string' ? {type: 'String', value: p} : this.generateNode(p)), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'TextField': (n) => ({ type: 'TextField', placeholder: n.placeholder, binding: this.generateNode(n.binding), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'Image': (n) => ({ type: 'Image', source: this.generateNode(n.source), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'Button': (n) => ({ type: 'Button', text: n.text.map((p: string | Node) => typeof p === 'string' ? {type: 'String', value: p} : this.generateNode(p)), action: n.action.map((a: Node) => this.generateNode(a)), modifiers: n.modifiers.map((m: Node) => this.generateNode(m)) }),
        'Timer': (n) => ({ type: 'Timer', action: n.action.map((a: Node) => this.generateNode(a)) }),
        'If': (n) => ({ type: 'If', condition: this.generateNode(n.condition), thenBranch: n.thenBranch.map((b: Node) => this.generateNode(b)), elseBranch: n.elseBranch ? n.elseBranch.map((b: Node) => this.generateNode(b)) : null }),
        'Assignment': (n) => ({ type: 'Assignment', left: this.generateNode(n.left), right: this.generateNode(n.right) }),
        'BinaryExpression': (n) => ({ type: 'BinaryExpression', left: this.generateNode(n.left), operator: n.operator, right: this.generateNode(n.right) }),
        'Identifier': (n) => ({ type: 'Identifier', name: n.name }),
        'MemberAccess': (n) => ({ type: 'MemberAccess', object: this.generateNode(n.object), property: n.property }),
        'CallExpression': (n) => ({ type: 'CallExpression', callee: this.generateNode(n.callee), args: n.args.map((a: Node) => this.generateNode(a)) }),
        'StringInterpolation': (n) => ({ type: 'Interpolation', expression: this.generateNode(n.expression) }),
        'Literal': (n) => ({ type: 'Literal', value: n.value }),
        'Modifier': (n) => ({ type: 'Modifier', name: n.name, args: Object.fromEntries(Object.entries(n.args).map(([k, v]) => [k, this.generateNode(v as Node)])) }),
    };

    if(generatorMap[node.type]) {
      return generatorMap[node.type](node);
    }
    
    // Fallback for custom component call
    if ((node as any).name && (node as any).params) {
      return { type: 'ComponentCall', name: (node as any).name, params: (node as any).params.map((p: any) => this.generateNode(p)) };
    }

    throw new Error(`Unknown AST node type for generation: ${node.type}`);
  }
}

export function compileSynthesis(code: string): string {
  let outputJson: any;
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const generator = new JsonDescriptionGenerator(ast);
    outputJson = generator.generate();

  } catch (e: any) {
    outputJson = { type: 'Error', message: e.message, stack: e.stack };
  }
  return JSON.stringify(outputJson, null, 2);
}
