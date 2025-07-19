
// src/compiler/synthesisCompiler.ts

import * as fs from 'fs';
import * as path from 'path';

// --- 1. Определение токенов ---
enum TokenType {
  Keyword, Identifier, StringLiteral, NumberLiteral,
  Punctuation, Operator, InterpolationStart, InterpolationEnd, EndOfFile
}

interface Token {
  type: TokenType;
  value?: string;
  line: number;
  column: number;
}

// --- 2. Лексер (Токенизатор) ---
class Lexer {
  private code: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(code: string) {
    this.code = code;
  }

  private isWhitespace(char: string): boolean { return /\s/.test(char); }
  private isAlpha(char: string): boolean { return /[a-zA-Z]/.test(char); }
  private isDigit(char: string): boolean { return /\d/.test(char); }
  private isAlphaNumeric(char: string): boolean { return this.isAlpha(char) || this.isDigit(char); }

  private peek(): string | undefined { return this.code[this.position]; }

  private advance(): string | undefined {
    const char = this.code[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else if (char !== undefined) {
      this.column++;
    }
    return char;
  }

  private error(message: string): never {
    throw new Error(`Lexer Error (${this.line}:${this.column}): ${message}`);
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    const keywords = new Set([
      "@main", "func", "Window", "VStack", "Text", "font", "color", "struct",
      "component", "if", "else", "let", "in", "Button", "style", "padding",
      "background", "cornerRadius", "shadow", "alignment", "spacing",
      "Int", "String", "Bool", "Void", "true", "false", "UUID", "Date", "Point",
      "HStack", "ForEach", "Checkbox", "TextField", "@state", "@binding",
      "@entity", "@id", "@query", "@effect", "@Environment", "@external", "async", "await", "import"
    ]);

    while (this.position < this.code.length) {
      const startColumn = this.column;
      const startLine = this.line;
      let char = this.peek();

      if (char === undefined) break;

      // Пропуск комментариев //
      if (char === '/' && this.code[this.position + 1] === '/') {
          while (this.peek() !== '\n' && this.peek() !== undefined) {
              this.advance();
          }
          continue;
      }

      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }

      // Строковые литералы
      if (char === '"') {
        this.advance(); // Пропустить начальную кавычку
        let value = '';
        while (this.peek() !== '"' && this.peek() !== undefined) {
          if (this.peek() === '\\' && this.code[this.position + 1] === '(') {
            this.advance(); this.advance(); // Пропустить '\('
            tokens.push({ type: TokenType.StringLiteral, value: value, line: startLine, column: startColumn });
            tokens.push({ type: TokenType.InterpolationStart, line: startLine, column: this.column - 2 });
            value = '';
            break; 
          }
          value += this.advance();
        }
        if (this.peek() !== '"') { this.error("Незавершенный строковый литерал."); }
        this.advance(); // Пропустить конечную кавычку
        if (value.length > 0 || (tokens.length > 0 && tokens[tokens.length-1].type === TokenType.InterpolationStart)) {
             tokens.push({ type: TokenType.StringLiteral, value: value, line: startLine, column: startColumn });
        }
        continue;
      }

      // Числовые литералы
      if (this.isDigit(char)) {
        let value = '';
        while (this.isDigit(this.peek() || '') && this.peek() !== undefined) {
          value += this.advance();
        }
        tokens.push({ type: TokenType.NumberLiteral, value: value, line: startLine, column: startColumn });
        continue;
      }

      // Идентификаторы и ключевые слова (включая @-атрибуты)
      if (this.isAlpha(char) || char === '@') {
        let value = '';
        while (this.isAlphaNumeric(this.peek() || '') || this.peek() === '@') {
          value += this.advance();
        }
        if (keywords.has(value)) {
          tokens.push({ type: TokenType.Keyword, value: value, line: startLine, column: startColumn });
        } else {
          tokens.push({ type: TokenType.Identifier, value: value, line: startLine, column: startColumn });
        }
        continue;
      }

      // Символы пунктуации и операторы
      switch (char) {
        case '(': tokens.push({ type: TokenType.Punctuation, value: '(', line: startLine, column: startColumn }); this.advance(); break;
        case ')':
          const lastToken = tokens.length > 1 ? tokens[tokens.length - 2] : null;
          tokens.push({ type: TokenType.Punctuation, value: ')', line: startLine, column: startColumn });
          if (lastToken && lastToken.type === TokenType.InterpolationStart) {
              tokens.push({ type: TokenType.InterpolationEnd, line: startLine, column: startColumn + 1 });
          }
          this.advance();
          break;
        case '{': tokens.push({ type: TokenType.Punctuation, value: '{', line: startLine, column: startColumn }); this.advance(); break;
        case '}': tokens.push({ type: TokenType.Punctuation, value: '}', line: startLine, column: startColumn }); this.advance(); break;
        case '.': tokens.push({ type: TokenType.Punctuation, value: '.', line: startLine, column: startColumn }); this.advance(); break;
        case ':': tokens.push({ type: TokenType.Punctuation, value: ':', line: startLine, column: startColumn }); this.advance(); break;
        case ';': tokens.push({ type: TokenType.Punctuation, value: ';', line: startLine, column: startColumn }); this.advance(); break;
        case ',': tokens.push({ type: TokenType.Punctuation, value: ',', line: startLine, column: startColumn }); this.advance(); break;
        case '?': tokens.push({ type: TokenType.Punctuation, value: '?', line: startLine, column: startColumn }); this.advance(); break;
        case '!': tokens.push({ type: TokenType.Punctuation, value: '!', line: startLine, column: startColumn }); this.advance(); break;
        case '<': tokens.push({ type: TokenType.Punctuation, value: '<', line: startLine, column: startColumn }); this.advance(); break;
        case '>': tokens.push({ type: TokenType.Punctuation, value: '>', line: startLine, column: startColumn }); this.advance(); break;
        case '=':
          if (this.code[this.position + 1] === '=') { 
            this.advance();
            if (this.code[this.position + 1] === '=') { // ===
                tokens.push({ type: TokenType.Operator, value: '===', line: startLine, column: startColumn }); this.advance(); this.advance();
            } else {
                tokens.push({ type: TokenType.Operator, value: '==', line: startLine, column: startColumn }); this.advance();
            }
          } else if (this.code[this.position + 1] === '>') { // =>
            tokens.push({ type: TokenType.Punctuation, value: '=>', line: startLine, column: startColumn }); this.advance(); this.advance();
          } else { // =
            tokens.push({ type: TokenType.Operator, value: '=', line: startLine, column: startColumn }); this.advance();
          }
          break;
        default:
          this.error(`Неожиданный символ: '${char}'`);
      }
    }
    tokens.push({ type: TokenType.EndOfFile, line: this.line, column: this.column });
    return tokens;
  }
}

// --- 3. Парсер (Базовый синтаксический анализатор) ---

interface BaseNode {
  type: string;
  loc?: { line: number; column: number };
}

interface ProgramNode extends BaseNode {
  type: "Program";
  body: BaseNode[];
}

interface StructDeclarationNode extends BaseNode {
  type: "StructDeclaration";
  name: string;
  members: PropertyDeclarationNode[];
}

interface PropertyDeclarationNode extends BaseNode {
  type: "PropertyDeclaration";
  name: string;
  typeName: string;
  isOptional: boolean;
  attributes: AttributeNode[];
}

interface AttributeNode extends BaseNode {
    type: "Attribute";
    name: string;
    args: BaseNode[];
}

interface ComponentDeclarationNode extends BaseNode {
  type: "ComponentDeclaration";
  name: string;
  params: ParameterNode[];
  body: BlockNode;
}

interface ParameterNode extends BaseNode {
  type: "Parameter";
  name: string;
  typeName: string;
  isBinding: boolean;
}

interface BlockNode extends BaseNode {
  type: "Block";
  statements: BaseNode[];
}

interface FunctionCallNode extends BaseNode {
  type: "FunctionCall";
  callee: IdentifierNode;
  args: BaseNode[];
  modifiers: ModifierNode[];
}

interface ModifierNode extends BaseNode {
  type: "Modifier";
  name: string;
  args: BaseNode[];
}

interface StringLiteralNode extends BaseNode {
  type: "StringLiteral";
  value: (string | StringInterpolationNode)[];
}

interface StringInterpolationNode extends BaseNode {
  type: "StringInterpolation";
  expression: BaseNode;
}

interface NumberLiteralNode extends BaseNode {
  type: "NumberLiteral";
  value: number;
}

interface IdentifierNode extends BaseNode {
  type: "Identifier";
  name: string;
}

interface WindowNode extends BaseNode {
  type: "Window";
  title: StringLiteralNode;
  body: BlockNode;
}

interface ProgramEntryPointNode extends BaseNode {
  type: "ProgramEntryPoint";
  name: string;
  body: BlockNode;
}


class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset: number = 0): Token {
    return this.tokens[this.position + offset];
  }

  private advance(): Token {
    return this.tokens[this.position++];
  }

  private consume(expectedType: TokenType, expectedValue?: string): Token {
    const token = this.advance();
    if (token.type !== expectedType || (expectedValue && token.value !== expectedValue)) {
      this.error(`Ожидался токен ${TokenType[expectedType]}${expectedValue ? ` со значением '${expectedValue}'` : ''}, но получен ${TokenType[token.type]} '${token.value || ''}'`, token);
    }
    return token;
  }

  private error(message: string, token: Token): never {
    throw new Error(`Parser Error (${token.line}:${token.column}): ${message}`);
  }

  private parseIdentifier(): IdentifierNode {
    const token = this.consume(TokenType.Identifier);
    return { type: "Identifier", name: token.value!, loc: { line: token.line, column: token.column } };
  }

  private parseNumberLiteral(): NumberLiteralNode {
    const token = this.consume(TokenType.NumberLiteral);
    return { type: "NumberLiteral", value: parseInt(token.value!), loc: { line: token.line, column: token.column } };
  }

  private parseStringInterpolationContent(): (string | StringInterpolationNode)[] {
    const parts: (string | StringInterpolationNode)[] = [];
    while (this.peek().type === TokenType.StringLiteral || this.peek().type === TokenType.InterpolationStart) {
        const token = this.advance();
        if (token.type === TokenType.StringLiteral) {
            parts.push(token.value!);
        } else if (token.type === TokenType.InterpolationStart) {
            const expr = this.parseExpression(); 
            this.consume(TokenType.Punctuation, ')');
            this.consume(TokenType.InterpolationEnd);
            parts.push({ type: "StringInterpolation", expression: expr, loc: { line: token.line, column: token.column } });
        } else {
            this.error("Неожиданный тип токена в строковой интерполяции.", token);
        }
    }
    return parts;
  }

  private parseStringLiteral(): StringLiteralNode {
    const startToken = this.peek();
    const value = this.parseStringInterpolationContent();
    return { type: "StringLiteral", value, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseExpression(): BaseNode {
    const token = this.peek();
    if (token.type === TokenType.Identifier) {
      return this.parseIdentifier();
    } else if (token.type === TokenType.NumberLiteral) {
      return this.parseNumberLiteral();
    } else if (token.type === TokenType.StringLiteral) {
        return this.parseStringLiteral();
    }
    this.error(`Неожиданный токен для выражения: ${TokenType[token.type]} '${token.value || ''}'`, token);
  }

  private parseFunctionCallOrComponent(): FunctionCallNode {
    const callee = this.parseIdentifier();
    const args: BaseNode[] = [];
    if (this.peek().value === '(') {
        this.consume(TokenType.Punctuation, '(');
        while (this.peek().value !== ')') {
            if (this.peek(1).value === ':') {
                const argName = this.parseIdentifier();
                this.consume(TokenType.Punctuation, ':');
                const argValue = this.peek().value === '.' ? {type: 'EnumCase', name: this.consume(TokenType.Punctuation,'.') && this.parseIdentifier().name} : this.parseExpression();
                args.push({ type: "NamedArgument", name: argName.name, value: argValue } as any);
            } else {
                 args.push(this.parseExpression());
            }

            if (this.peek().value === ',') {
                this.advance();
            }
        }
        this.consume(TokenType.Punctuation, ')');
    }

    const modifiers: ModifierNode[] = [];
    while (this.peek().value === '.') {
      modifiers.push(this.parseModifier());
    }

    return { type: "FunctionCall", callee, args, modifiers, loc: callee.loc };
  }

  private parseModifier(): ModifierNode {
    const startToken = this.consume(TokenType.Punctuation, '.');
    const name = this.parseIdentifier().name;
    const args: BaseNode[] = [];

    if (this.peek().value === '(') {
      this.consume(TokenType.Punctuation, '(');
      while (this.peek().value !== ')') {
        if (this.peek().value === '.') {
          this.consume(TokenType.Punctuation, '.');
          args.push(this.parseIdentifier());
        } else {
          args.push(this.parseExpression());
        }
        if (this.peek().value === ',') {
          this.advance();
        }
      }
      this.consume(TokenType.Punctuation, ')');
    }
    return { type: "Modifier", name, args, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseBlock(): BlockNode {
    const startToken = this.consume(TokenType.Punctuation, '{');
    const statements: BaseNode[] = [];
    while (this.peek().value !== '}') {
      statements.push(this.parseFunctionCallOrComponent());
    }
    this.consume(TokenType.Punctuation, '}');
    return { type: "Block", statements, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseWindow(): WindowNode {
    const startToken = this.consume(TokenType.Keyword, 'Window');
    this.consume(TokenType.Punctuation, '(');
    this.consume(TokenType.StringLiteral); // This is just to advance, parseStringLiteral handles the real parsing.
    this.position--; // Go back to re-parse with interpolation logic.
    const title = this.parseStringLiteral();
    this.consume(TokenType.Punctuation, ')');
    const body = this.parseBlock();
    return { type: "Window", title, body, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseEntryPoint(): ProgramEntryPointNode {
    const mainAttr = this.consume(TokenType.Keyword, '@main');
    this.consume(TokenType.Keyword, 'func');
    const name = this.consume(TokenType.Identifier, 'AppDelegate').value!;
    const body = this.parseBlock();
    return { type: "ProgramEntryPoint", name, body, loc: { line: mainAttr.line, column: mainAttr.column } };
  }

  private parseStructDeclaration(): StructDeclarationNode {
      const startToken = this.consume(TokenType.Keyword, 'struct');
      const name = this.parseIdentifier().name;
      this.consume(TokenType.Punctuation, '{');
      const members: PropertyDeclarationNode[] = [];
      while (this.peek().value !== '}') {
          const memberName = this.parseIdentifier().name;
          this.consume(TokenType.Punctuation, ':');
          const typeName = this.parseIdentifier().name;
          const isOptional = this.peek().value === '?';
          if (isOptional) this.advance();
          this.consume(TokenType.Punctuation, ';');
          members.push({ type: "PropertyDeclaration", name: memberName, typeName, isOptional, attributes: [], loc: { line: startToken.line, column: startToken.column } });
      }
      this.consume(TokenType.Punctuation, '}');
      return { type: "StructDeclaration", name, members, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseComponentDeclaration(): ComponentDeclarationNode {
    const startToken = this.consume(TokenType.Keyword, 'component');
    const name = this.parseIdentifier().name;
    this.consume(TokenType.Punctuation, '(');
    const params: ParameterNode[] = [];
    while (this.peek().value !== ')') {
        let isBinding = false;
        if (this.peek().type === TokenType.Keyword && this.peek().value === '@binding') {
            this.advance();
            isBinding = true;
        }
        const paramName = this.parseIdentifier().name;
        this.consume(TokenType.Punctuation, ':');
        const typeName = this.parseIdentifier().name;
        params.push({ type: "Parameter", name: paramName, typeName, isBinding, loc: { line: startToken.line, column: startToken.column } });
        if (this.peek().value === ',') {
            this.advance();
        }
    }
    this.consume(TokenType.Punctuation, ')');
    const body = this.parseBlock();
    return { type: "ComponentDeclaration", name, params, body, loc: { line: startToken.line, column: startToken.column } };
  }

  public parse(): ProgramNode {
    const program: ProgramNode = { type: "Program", body: [] };

    while (this.peek().type !== TokenType.EndOfFile) {
        const token = this.peek();
        if (token.type === TokenType.Keyword && token.value === '@main') {
            program.body.push(this.parseEntryPoint());
        } else if (token.type === TokenType.Keyword && token.value === 'struct') {
            program.body.push(this.parseStructDeclaration());
        } else if (token.type === TokenType.Keyword && token.value === 'component') {
            program.body.push(this.parseComponentDeclaration());
        } else {
            this.error(`Неожиданный токен на верхнем уровне программы: ${TokenType[token.type]} '${token.value || ''}'`, token);
        }
    }

    this.consume(TokenType.EndOfFile);
    return program;
  }
}

// --- 4. Генератор нативного кода (Упрощённый Swift-генератор) ---
class SwiftCodeGenerator {
  private ast: ProgramNode;
  private indentLevel: number = 0;
  private generatedCode: string[] = [];

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  private indent(): string {
    return '    '.repeat(this.indentLevel);
  }

  private emit(line: string = ''): void {
    this.generatedCode.push(this.indent() + line);
  }

  private generateType(typeName: string, isOptional: boolean): string {
    let swiftType = typeName;
    switch(typeName) {
        case "Int": swiftType = "Int"; break;
        case "String": swiftType = "String"; break;
        case "Bool": swiftType = "Bool"; break;
        case "UUID": swiftType = "UUID"; break;
        case "Date": swiftType = "Date"; break;
        case "Void": swiftType = "Void"; break;
        case "Point": swiftType = "CGPoint"; break;
        default: swiftType = typeName; 
    }
    return swiftType + (isOptional ? '?' : '');
  }

  private generateExpression(node: BaseNode): string {
    if (node.type === "Identifier") {
      return (node as IdentifierNode).name;
    } else if (node.type === "NumberLiteral") {
      return (node as NumberLiteralNode).value.toString();
    } else if (node.type === "StringLiteral") {
        const stringLiteral = node as StringLiteralNode;
        let swiftString = '"';
        stringLiteral.value.forEach(part => {
            if (typeof part === 'string') {
                swiftString += part;
            } else if (part.type === "StringInterpolation") {
                swiftString += `\\(${this.generateExpression(part.expression)})`;
            }
        });
        swiftString += '"';
        return swiftString;
    }
    return `/* UNKNOWN_EXPRESSION_TYPE_${node.type} */`;
  }

  private generateModifier(modifier: ModifierNode): string {
    let swiftArgs = '';
    if (modifier.args.length > 0) {
        swiftArgs = modifier.args.map(arg => {
            if (arg.type === "Identifier") {
                let argName = (arg as IdentifierNode).name;
                if (modifier.name === "font") return `.${argName}`;
                else if (modifier.name === "color") return `.${argName}`;
                else if (modifier.name === "alignment") return `.${argName}`;
                else if (modifier.name === "style") {
                    if (argName === "primary") return '.borderedProminent';
                    return `.${argName}`;
                }
                return argName;
            } else if (arg.type === "NumberLiteral") {
                 return (arg as NumberLiteralNode).value.toString();
            }
            return `/* UNKNOWN_MODIFIER_ARG */`;
        }).join(', ');
    }

    switch(modifier.name) {
        case "color": return `.foregroundStyle(${swiftArgs})`;
        case "padding": return `.padding(${swiftArgs})`;
        case "background": return `.background(Color${swiftArgs.length > 0 ? `.${swiftArgs}` : '.white'})`;
        case "cornerRadius": return `.cornerRadius(${swiftArgs})`;
        case "shadow": return `.shadow(radius: ${swiftArgs})`;
        case "animation": return `.animation(${swiftArgs}, value: /* value to animate */)`;
        case "transition": return `.transition(${swiftArgs})`;
        default: return `.${modifier.name}(${swiftArgs})`;
    }
  }

  private generateBlock(block: BlockNode): void {
    const generateNode = (node: BaseNode) => {
        if (node.type === "FunctionCall") {
            const call = node as FunctionCallNode;
            let callStr = `${call.callee.name}(${call.args.map(a => this.generateExpression(a)).join(', ')})`;
            
            // Check for trailing closure syntax for `Button`
            if (call.callee.name === 'Button' && call.args.length > 0) {
                 callStr = `Button(${this.generateExpression(call.args[0])})`
            }

            this.emit(callStr);
            this.indentLevel++;
            for (const mod of call.modifiers) {
                this.emit(this.generateModifier(mod));
            }
            this.indentLevel--;
        }
    };
    
    // Check for single-statement block for cleaner syntax
    if (block.statements.length === 1) {
        generateNode(block.statements[0]);
    } else {
        this.emit('{');
        this.indentLevel++;
        for (const stmt of block.statements) {
            generateNode(stmt);
        }
        this.indentLevel--;
        this.emit('}');
    }
  }
  

  private generateStruct(node: StructDeclarationNode): void {
      this.emit(`struct ${node.name}: Identifiable {`);
      this.indentLevel++;
      this.emit('let id = UUID()');
      for (const member of node.members) {
          this.emit(`var ${member.name}: ${this.generateType(member.typeName, member.isOptional)}`);
      }
      this.indentLevel--;
      this.emit('}');
      this.emit('');
  }

  private generateComponent(node: ComponentDeclarationNode): void {
      this.emit(`struct ${node.name}View: View {`);
      this.indentLevel++;
      for (const param of node.params) {
          if (param.isBinding) {
              this.emit(`@Binding var ${param.name}: ${this.generateType(param.typeName, false)}`);
          } else {
              this.emit(`let ${param.name}: ${this.generateType(param.typeName, false)}`);
          }
      }

      this.emit('');
      this.emit('var body: some View {');
      this.indentLevel++;
      if (node.body.statements.length > 0) {
        const rootComponent = node.body.statements[0];
        if (rootComponent.type === 'FunctionCall') {
            const call = rootComponent as FunctionCallNode;
            this.emit(`${call.callee.name}(${call.args.map(a => {
                if ((a as any).type === 'NamedArgument') {
                    return `${(a as any).name.name}: .${(a as any).value.name}`;
                }
                return this.generateExpression(a);
            }).join(', ')}) {`);
            this.indentLevel++;
            
            // Generate children of the root component
             if((rootComponent as any).body && (rootComponent as any).body.statements) {
                (rootComponent as any).body.statements.forEach((stmt: BaseNode) => this.generateBlock({type: 'Block', statements: [stmt]}))
            }

            this.indentLevel--;
            this.emit('}');
             this.indentLevel++;
            for (const mod of call.modifiers) {
                this.emit(this.generateModifier(mod));
            }
             this.indentLevel--;


        } else {
            this.generateBlock(node.body);
        }
      }
      this.indentLevel--;
      this.emit('}');
      this.indentLevel--;
      this.emit('}');
      this.emit('');
  }

  public generate(): string {
    this.generatedCode = [];
    this.emit('import SwiftUI');
    this.emit('import Foundation');
    this.emit('');

    for (const node of this.ast.body) {
      if (node.type === "StructDeclaration") {
          this.generateStruct(node as StructDeclarationNode);
      } else if (node.type === "ComponentDeclaration") {
          this.generateComponent(node as ComponentDeclarationNode);
      } else if (node.type === "ProgramEntryPoint") {
        const entryPoint = node as ProgramEntryPointNode;
        this.emit('@main');
        this.emit(`struct ${entryPoint.name}App: App {`);
        this.indentLevel++;
        this.emit('var body: some Scene {');
        this.indentLevel++;
        for (const stmt of entryPoint.body.statements) {
          if (stmt.type === "Window") {
            const window = stmt as WindowNode;
            this.emit(`WindowGroup(${this.generateExpression(window.title)}) {`);
            this.indentLevel++;
            // Generate window body content
            for(const innerStmt of window.body.statements) {
                 this.generateBlock({ type: "Block", statements: [innerStmt] });
            }
            this.indentLevel--;
            this.emit('}');
          }
        }
        this.indentLevel--;
        this.emit('}');
        this.indentLevel--;
        this.emit('}');
      }
    }

    return this.generatedCode.join('\n');
  }
}

interface GeneratedFile {
    fileName: string;
    content: string;
}

export async function compileSynthesisProject(
  projectRoot: string,
  outputDir: string,
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux'
): Promise<GeneratedFile[]> {
  console.log(`[SYNTHESIS Compiler] Компиляция проекта в ${projectRoot} для ${platform}...`);

  // Find all .syn files in the project
  const synFiles: string[] = [];
  const findSynFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
              findSynFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.syn')) {
              synFiles.push(fullPath);
          }
      }
  };
  
  findSynFiles(projectRoot);

  if (synFiles.length === 0) {
      throw new Error("Не найдено .syn файлов в проекте.");
  }
  
  const fullCode = synFiles.map(filePath => fs.readFileSync(filePath, 'utf-8')).join('\n\n');

  console.log('[SYNTHESIS Compiler] Лексический анализ...');
  const lexer = new Lexer(fullCode);
  const tokens = lexer.tokenize();

  console.log('[SYNTHESIS Compiler] Синтаксический анализ...');
  const parser = new Parser(tokens);
  const ast = parser.parse();

  console.log('[SYNTHESIS Compiler] Генерация нативного кода...');
  let generatedNativeCode = '';
  let generatedFileName = '';

  if (platform === 'ios' || platform === 'macos') {
    const swiftGenerator = new SwiftCodeGenerator(ast);
    generatedNativeCode = swiftGenerator.generate();
    generatedFileName = 'MainApp.swift';
  } else {
    throw new Error(`Генератор для платформы ${platform} не реализован.`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, generatedFileName);
  fs.writeFileSync(outputPath, generatedNativeCode);

  console.log(`[SYNTHESIS Compiler] Нативный код сгенерирован в: ${outputPath}`);

  return [{ fileName: generatedFileName, content: generatedNativeCode }];
}

if (require.main === module) {
  const exampleMainCode = `
@main
func AppDelegate {
  Window("Hello SYNTHESIS!") {
    VStack {
      Text("Welcome to SYNTHESIS!")
      UserDetail(user: {id: 123, name: "Alice"}, onEdit: { id in })
    }
  }
}
`;
 const exampleUserDetailCode = `
struct User {
  id: Int;
  name: String;
}
component UserDetail(user: User, onEdit: (userId: Int) => Void) {
  VStack(alignment: .leading) {
    Text("ID: \\(user.id)")
    Text("Name: \\(user.name)")
    Button("Edit") {
        onEdit(user.id)
    }
  }
}
`;

  const testProjectRoot = path.join(__dirname, '../../temp_synthesis_project');
  if (fs.existsSync(testProjectRoot)) {
    fs.rmSync(testProjectRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(testProjectRoot, { recursive: true });
  fs.writeFileSync(path.join(testProjectRoot, 'main.syn'), exampleMainCode);
  fs.writeFileSync(path.join(testProjectRoot, 'UserDetail.syn'), exampleUserDetailCode);

  const testOutputDir = path.join(testProjectRoot, 'generated', 'ios');

  console.log('\n--- Тестирование компилятора SYNTHESIS напрямую ---');
  compileSynthesisProject(testProjectRoot, testOutputDir, 'ios')
    .then(generatedFiles => {
      console.log('Компиляция прошла успешно! Сгенерированные файлы:');
      generatedFiles.forEach(file => console.log(`- ${file.fileName}`));
      console.log('\n--- Содержимое MainApp.swift ---');
      console.log(fs.readFileSync(path.join(testOutputDir, 'MainApp.swift'), 'utf-8'));
    })
    .catch(error => {
      console.error('Ошибка компиляции:', error);
    });
}

    