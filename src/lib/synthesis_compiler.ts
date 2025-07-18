// src/lib/synthesis_compiler.ts

// --- 1. Определение токенов ---
enum TokenType {
  Keyword,       // @main, @State, func, Window, VStack, Text, font, color, struct, component, if, else, let, in, Button, style, padding, background, cornerRadius, shadow, alignment, spacing
  Identifier,    // Имена переменных, функций, компонентов
  StringLiteral, // "Hello World!"
  NumberLiteral, // 10, 20
  Punctuation,   // (, ), {, }, ., :, ;, =, ,, ?, !, \, <, >, =>
  Operator,      // =, ==, . (для доступа к свойствам)
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
      "@main", "@State", "func", "Window", "VStack", "Text", "font", "color", "struct",
      "component", "if", "else", "let", "in", "Button", "style", "padding",
      "background", "cornerRadius", "shadow", "alignment", "spacing", "Int", "String", "Void"
    ]);

    while (this.position < this.code.length) {
      const startLine = this.line;
      let char = this.peek();

      if (char === undefined) break;

      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }
      
      if (char === '/' && this.code[this.position + 1] === '/') {
        while(this.peek() !== '\n' && this.peek() !== undefined) this.advance();
        continue;
      }

      if (char === '"') {
        this.advance();
        let value = '';
        while (this.peek() !== '"' && this.peek() !== undefined) {
          if (this.peek() === '\\' && this.code[this.position + 1] === '(') {
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

      if (this.isDigit(char)) {
        let value = '';
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

      const punctuationMap: {[key: string]: TokenType} = {
        '(': TokenType.Punctuation, ')': TokenType.Punctuation,
        '{': TokenType.Punctuation, '}': TokenType.Punctuation,
        '.': TokenType.Punctuation, ':': TokenType.Punctuation,
        ';': TokenType.Punctuation, ',': TokenType.Punctuation,
        '?': TokenType.Punctuation, '!': TokenType.Punctuation,
        '<': TokenType.Punctuation, '>': TokenType.Punctuation,
        '=': TokenType.Operator
      };
      if (char in punctuationMap) {
        tokens.push({ type: punctuationMap[char], value: char, line: startLine });
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
interface StructDefinitionNode extends Node { type: "StructDefinition"; name: string; fields: { name: string, typeName: string, isOptional: boolean }[]; }
interface ComponentDefinitionNode extends Node { type: "ComponentDefinition"; name: string; params: { name: string, typeName: string }[]; states: StateDefinitionNode[]; body: Node; }
interface StateDefinitionNode extends Node { type: "StateDefinition"; name: string, typeName: string, initialValue: Node; }
interface FuncDefinitionNode extends Node { type: "FuncDefinition"; name: string; body: Node[]; }
interface AssignmentNode extends Node { type: "Assignment"; left: Node; right: Node; }
interface WindowNode extends Node { type: "Window"; title: string; body: Node; }
interface VStackNode extends Node { type: "VStack"; props: { [key: string]: any }; children: Node[]; }
interface TextNode extends Node { type: "Text"; value: (string | Node)[]; modifiers: Node[]; }
interface IfNode extends Node { type: "If"; condition: Node; thenBranch: Node[]; elseBranch: Node[] | null; }
interface ButtonNode extends Node { type: "Button"; text: (string | Node)[]; action: Node[]; modifiers: Node[]; }
interface ModifierNode extends Node { type: "Modifier"; name: string; args: Node[]; }
interface StringInterpolationNode extends Node { type: "StringInterpolation"; expression: Node; }
interface LiteralNode extends Node { type: "Literal"; value: string | number; }
interface IdentifierNode extends Node { type: "Identifier"; name: string; }
interface MemberAccessNode extends Node { type: "MemberAccess"; object: Node; property: string; }

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
    let token = this.peek();
    let node: Node;

    if (token.type === TokenType.NumberLiteral) {
        node = { type: "Literal", value: parseInt(this.advance().value!) };
    } else if (token.type === TokenType.StringLiteral) {
        node = { type: "Literal", value: this.advance().value! };
    } else if (token.type === TokenType.Identifier) {
        node = { type: "Identifier", name: this.advance().value! };
    } else {
        throw new Error(`Unexpected token in expression: ${token.value} at line ${token.line}`);
    }
    
    while(this.match({type: TokenType.Punctuation, value: '.'})) {
      const property = this.consume(TokenType.Identifier, undefined, "Expected property name after '.'.").value!;
      node = { type: "MemberAccess", object: node, property };
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
    this.consume(TokenType.Punctuation, '(');
    const args: Node[] = [];
    if (!this.check(TokenType.Punctuation, ')')) {
      if (this.check(TokenType.Punctuation, '.')) {
         this.consume(TokenType.Punctuation, '.');
         args.push({ type: "Identifier", name: this.consume(TokenType.Identifier).value! });
      } else if (this.check(TokenType.NumberLiteral)) {
         args.push({ type: "Literal", value: parseInt(this.advance().value!) });
      } else {
        const argName = this.consume(TokenType.Identifier).value;
        this.consume(TokenType.Punctuation, ':');
        const argValue = this.consume(TokenType.NumberLiteral).value;
        args.push({type: "Literal", value: {[argName!]: parseInt(argValue!)}});
      }
    }
    this.consume(TokenType.Punctuation, ')');
    return { type: "Modifier", name, args };
  }
  
  private parseBlock(isFunc: boolean = false): Node[] {
    const nodes: Node[] = [];
    this.consume(TokenType.Punctuation, '{', "Expected '{' to start a block.");
    while(!this.check(TokenType.Punctuation, '}')) {
        if(isFunc) {
            nodes.push(this.parseAssignment());
        } else {
            nodes.push(this.parseStatement());
        }
    }
    this.consume(TokenType.Punctuation, '}', "Expected '}' to end a block.");
    return nodes;
  }

  private parseAssignment(): AssignmentNode {
    const left = this.parseExpression();
    this.consume(TokenType.Operator, '=');
    const right = this.parseExpression();
    return { type: "Assignment", left, right };
  }
  
  private parseStatement(): Node {
    let node: Node;
    if (this.match({type: TokenType.Keyword, value: 'Text'})) {
      this.consume(TokenType.Punctuation, '(');
      const value = this.parseTextContent();
      this.consume(TokenType.Punctuation, ')');
      node = { type: "Text", value, modifiers: [] } as TextNode;
    } else if (this.match({type: TokenType.Keyword, value: 'VStack'})) {
       const props = {};
       const children = this.parseBlock();
       node = { type: "VStack", props, children, modifiers: [] };
    } else if (this.match({type: TokenType.Keyword, value: 'Button'})) {
       this.consume(TokenType.Punctuation, '(');
       const text = this.parseTextContent();
       this.consume(TokenType.Punctuation, ')');
       const action = this.parseBlock(true); // Action block contains assignments
       node = { type: "Button", text, action, modifiers: [] };
    } else if (this.match({type: TokenType.Keyword, value: 'if'})) {
       this.consume(TokenType.Keyword, 'let');
       this.consume(TokenType.Identifier).value!;
       this.consume(TokenType.Operator, '=');
       const condition = this.parseExpression();
       const thenBranch = this.parseBlock();
       let elseBranch = null;
       if (this.match({type: TokenType.Keyword, value: 'else'})) {
           elseBranch = this.parseBlock();
       }
       node = { type: "If", condition, thenBranch, elseBranch };
    } else {
       const identifier = this.consume(TokenType.Identifier, undefined, "Expected component name.").value!;
       const params = this.parseComponentCallParams();
       node = { type: "Identifier", name: identifier, params };
    }
    
    const modifiers: ModifierNode[] = [];
    while(this.check(TokenType.Punctuation, '.')) {
      modifiers.push(this.parseModifier());
    }
    (node as any).modifiers = modifiers;
    return node;
  }
  
  private parseComponentCallParams(): Node[] {
      const args: Node[] = [];
      this.consume(TokenType.Punctuation, '(');
      while(!this.check(TokenType.Punctuation, ')')) {
          this.consume(TokenType.Identifier);
          this.consume(TokenType.Punctuation, ':');
          args.push(this.parseExpression());
          if(this.check(TokenType.Punctuation, ',')) this.advance();
      }
      this.consume(TokenType.Punctuation, ')');
      return args;
  }
  
  private parseTopLevel(): Node {
    if (this.check(TokenType.Keyword, 'struct')) return this.parseStruct();
    if (this.check(TokenType.Keyword, 'component')) return this.parseComponent();
    if (this.check(TokenType.Keyword, '@main')) return this.parseMainFunc();
    const token = this.peek();
    throw new Error(`Unexpected top-level token: ${token.value} at line ${token.line}`);
  }
  
  private parseStruct(): StructDefinitionNode {
      this.consume(TokenType.Keyword, 'struct');
      const name = this.consume(TokenType.Identifier).value!;
      const fields: { name: string, typeName: string, isOptional: boolean }[] = [];
      this.consume(TokenType.Punctuation, '{');
      while(!this.check(TokenType.Punctuation, '}')) {
          const fieldName = this.consume(TokenType.Identifier).value!;
          this.consume(TokenType.Punctuation, ':');
          const typeName = this.consume(TokenType.Identifier).value!;
          const isOptional = !!this.match({type: TokenType.Punctuation, value: '?'});
          fields.push({ name: fieldName, typeName, isOptional });
          this.match({type: TokenType.Punctuation, value: ';'});
      }
      this.consume(TokenType.Punctuation, '}');
      return { type: "StructDefinition", name, fields };
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
      const params: { name: string, typeName: string }[] = [];
      this.consume(TokenType.Punctuation, '(');
      while(!this.check(TokenType.Punctuation, ')')) {
          const paramName = this.consume(TokenType.Identifier).value!;
          this.consume(TokenType.Punctuation, ':');
          const typeName = this.consume(TokenType.Identifier).value!;
          params.push({ name: paramName, typeName });
          if(this.check(TokenType.Punctuation, ',')) this.advance();
      }
      this.consume(TokenType.Punctuation, ')');
      
      this.consume(TokenType.Punctuation, '{');
      const states: StateDefinitionNode[] = [];
      while(this.check(TokenType.Keyword, '@State')) {
          states.push(this.parseStateDefinition());
      }
      const body = this.parseStatement();
      this.consume(TokenType.Punctuation, '}');

      return { type: "ComponentDefinition", name, params, states, body };
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
    const mainComponent = this.ast.body.find(n => n.type === 'Window' || n.type === 'ComponentDefinition');
    if (mainComponent) {
        return this.generateNode(mainComponent);
    }
    return { type: 'Error', message: 'No main component or window found' };
  }
  
  private generateNode(node: Node): any {
    switch (node.type) {
        case 'Program':
            return {
              type: 'Program',
              body: (node as ProgramNode).body.map(n => this.generateNode(n))
            };
        case 'Window':
            const win = node as WindowNode;
            return {
                type: 'Window',
                title: win.title,
                body: this.generateNode(win.body)
            };
        case 'ComponentDefinition':
            const comp = node as ComponentDefinitionNode;
            return {
                type: 'ComponentDefinition',
                name: comp.name,
                params: comp.params,
                states: comp.states.map(s => this.generateNode(s)),
                body: this.generateNode(comp.body)
            };
        case 'StateDefinition':
            const state = node as StateDefinitionNode;
            return {
                type: 'State',
                name: state.name,
                typeName: state.typeName,
                initialValue: this.generateNode(state.initialValue)
            };
        case 'VStack':
            const vstack = node as VStackNode;
            return {
              type: "VStack",
              props: vstack.props,
              children: vstack.children.map(c => this.generateNode(c))
            };
        case 'Text':
            const text = node as TextNode;
            return { 
                type: "Text", 
                value: text.value.map(p => typeof p === 'string' ? {type: 'String', value: p} : this.generateNode(p)), 
                modifiers: text.modifiers.map(m => this.generateNode(m)) 
            };
        case 'Button':
            const button = node as ButtonNode;
            return { 
                type: "Button", 
                text: button.text.map(p => typeof p === 'string' ? {type: 'String', value: p} : this.generateNode(p)),
                action: button.action.map(a => this.generateNode(a)), 
                modifiers: button.modifiers.map(m => this.generateNode(m)) 
            };
        case 'If':
             const ifNode = node as IfNode;
             return {
                type: "If",
                condition: this.generateNode(ifNode.condition),
                thenBranch: ifNode.thenBranch.map(n => this.generateNode(n)),
                elseBranch: ifNode.elseBranch ? ifNode.elseBranch.map(n => this.generateNode(n)) : null
             };
        case 'Assignment':
            const assign = node as AssignmentNode;
            return {
                type: 'Assignment',
                left: this.generateNode(assign.left),
                right: this.generateNode(assign.right)
            };
        case 'Identifier':
             return { type: 'Identifier', name: (node as IdentifierNode).name };
        case 'MemberAccess':
             const member = node as MemberAccessNode;
             return { type: 'MemberAccess', object: this.generateNode(member.object), property: member.property };
        case 'StringInterpolation':
            return { type: 'Interpolation', expression: this.generateNode((node as StringInterpolationNode).expression) };
        case 'Literal':
            return { type: 'Literal', value: (node as LiteralNode).value };
        case 'Modifier':
            const mod = node as ModifierNode;
            return {
                type: 'Modifier',
                name: mod.name,
                args: mod.args.map(a => this.generateNode(a))
            };
        default:
            return { type: 'Unknown', nodeType: node.type };
    }
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
