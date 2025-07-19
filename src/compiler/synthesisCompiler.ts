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
        let isInterpolationSegment = false;
        while (this.peek() !== '"' && this.peek() !== undefined) {
          if (this.peek() === '\\' && this.code[this.position + 1] === '(') {
            this.advance(); this.advance(); // Пропустить '\('
            tokens.push({ type: TokenType.StringLiteral, value: value, line: startLine, column: startColumn });
            tokens.push({ type: TokenType.InterpolationStart, line: startLine, column: this.column - 2 });
            value = '';
            isInterpolationSegment = true;
            break; 
          }
          value += this.advance();
        }
        if (this.peek() !== '"') { this.error("Незавершенный строковый литерал."); }
        this.advance(); // Пропустить конечную кавычку
        
        if (value.length > 0 || isInterpolationSegment) {
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
          const lastRelevantToken = tokens.length > 0 ? tokens[tokens.length-1] : null;
          if (lastRelevantToken && lastRelevantToken.type === TokenType.InterpolationStart) {
             tokens.push({ type: TokenType.InterpolationEnd, line: startLine, column: startColumn });
          }
          tokens.push({ type: TokenType.Punctuation, value: ')', line: startLine, column: startColumn });
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
        case '<': tokens.push({ type: TokenType.Operator, value: '<', line: startLine, column: startColumn }); this.advance(); break;
        case '>': tokens.push({ type: TokenType.Operator, value: '>', line: startLine, column: startColumn }); this.advance(); break;
        case '+': tokens.push({ type: TokenType.Operator, value: '+', line: startLine, column: startColumn }); this.advance(); break;
        case '=':
          if (this.code[this.position + 1] === '=') { // ==
            this.advance(); this.advance();
            tokens.push({ type: TokenType.Operator, value: '==', line: startLine, column: startColumn });
          } else if (this.code[this.position + 1] === '>') { // =>
            this.advance(); this.advance();
            tokens.push({ type: TokenType.Punctuation, value: '=>', line: startLine, column: startColumn });
          } else { // =
            tokens.push({ type: TokenType.Operator, value: '=', line: startLine, column: startColumn });
            this.advance();
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

interface ProgramNode extends BaseNode { type: "Program"; body: BaseNode[];}
interface StructDeclarationNode extends BaseNode { type: "StructDeclaration"; name: string; members: PropertyDeclarationNode[];}
interface PropertyDeclarationNode extends BaseNode { type: "PropertyDeclaration"; name: string; typeName: string; isOptional: boolean; attributes: AttributeNode[];}
interface AttributeNode extends BaseNode { type: "Attribute"; name: string; args: BaseNode[];}
interface ComponentDeclarationNode extends BaseNode { type: "ComponentDeclaration"; name: string; params: ParameterNode[]; body: BlockNode; }
interface ParameterNode extends BaseNode { type: "Parameter"; name: string; typeName: string; isBinding: boolean; }
interface BlockNode extends BaseNode { type: "Block"; statements: BaseNode[]; }
interface FunctionCallNode extends BaseNode { type: "FunctionCall"; callee: IdentifierNode; args: ArgumentNode[]; modifiers: ModifierNode[]; body?: BlockNode}
interface ArgumentNode extends BaseNode { type: 'Argument'; name?: IdentifierNode, value: BaseNode }
interface ModifierNode extends BaseNode { type: "Modifier"; name: string; args: ArgumentNode[]; }
interface StringLiteralNode extends BaseNode { type: "StringLiteral"; value: (string | StringInterpolationNode)[]; }
interface StringInterpolationNode extends BaseNode { type: "StringInterpolation"; expression: BaseNode; }
interface NumberLiteralNode extends BaseNode { type: "NumberLiteral"; value: number; }
interface IdentifierNode extends BaseNode { type: "Identifier"; name: string; }
interface WindowNode extends BaseNode { type: "Window"; title: StringLiteralNode; body: BlockNode; }
interface ProgramEntryPointNode extends BaseNode { type: "ProgramEntryPoint"; name: string; body: BlockNode; }
interface EffectNode extends BaseNode { type: "Effect"; dependencies: IdentifierNode[]; body: BlockNode; }

class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset: number = 0): Token { return this.tokens[this.position + offset];}
  private advance(): Token { return this.tokens[this.position++]; }
  private match(type: TokenType, value?: string): boolean { const t = this.peek(); if (t.type === TokenType.EndOfFile) return false; return t.type === type && (value === undefined || t.value === value); }
  private consume(expectedType: TokenType, expectedValue?: string): Token {
    const token = this.advance();
    if (token.type !== expectedType || (expectedValue && token.value !== expectedValue)) {
      this.error(`Ожидался токен ${TokenType[expectedType]}${expectedValue ? ` со значением '${expectedValue}'` : ''}, но получен ${TokenType[token.type]} '${token.value || ''}'`, token);
    }
    return token;
  }
  private error(message: string, token: Token): never { throw new Error(`Parser Error (${token.line}:${token.column}): ${message}`); }
  private parseIdentifier(): IdentifierNode { const token = this.consume(TokenType.Identifier); return { type: "Identifier", name: token.value!, loc: { line: token.line, column: token.column } }; }
  private parseNumberLiteral(): NumberLiteralNode { const token = this.consume(TokenType.NumberLiteral); return { type: "NumberLiteral", value: parseInt(token.value!), loc: { line: token.line, column: token.column } };}

  private parseStringInterpolationContent(): (string | StringInterpolationNode)[] {
      const parts: (string | StringInterpolationNode)[] = [];
      if (!this.match(TokenType.StringLiteral) && !this.match(TokenType.InterpolationStart)) return [];

      const firstToken = this.advance();
      parts.push(firstToken.value!);

      while(this.peek().type === TokenType.InterpolationStart) {
          this.advance(); // consume interpolation start
          parts.push({type: 'StringInterpolation', expression: this.parseExpression()});
          this.consume(TokenType.Punctuation, ')');
          this.consume(TokenType.InterpolationEnd);
          if(this.match(TokenType.StringLiteral)){
              parts.push(this.advance().value!);
          }
      }
      return parts;
  }

  private parseStringLiteral(): StringLiteralNode {
    const startToken = this.peek();
    const parts = this.parseStringInterpolationContent();
    return { type: "StringLiteral", value: parts, loc: { line: startToken.line, column: startToken.column } };
  }

  private parseExpression(): BaseNode {
    const token = this.peek();
    if (token.type === TokenType.Identifier) { return this.parseIdentifier(); } 
    else if (token.type === TokenType.NumberLiteral) { return this.parseNumberLiteral(); }
    else if (token.type === TokenType.StringLiteral) { return this.parseStringLiteral(); }
    this.error(`Неожиданный токен для выражения: ${TokenType[token.type]} '${token.value || ''}'`, token);
  }

  private parseArguments(): ArgumentNode[] {
      const args: ArgumentNode[] = [];
      this.consume(TokenType.Punctuation, '(');
      while(!this.match(TokenType.Punctuation, ')')) {
          let name: IdentifierNode | undefined;
          if(this.peek(1).value === ':') {
              name = this.parseIdentifier();
              this.consume(TokenType.Punctuation, ':');
          }
          const value = this.parseExpression();
          args.push({type: 'Argument', name, value});
          if(this.match(TokenType.Punctuation, ',')) this.advance();
      }
      this.consume(TokenType.Punctuation, ')');
      return args;
  }
  
  private parseFunctionCallOrComponent(): FunctionCallNode {
    const callee = this.parseIdentifier();
    const args: ArgumentNode[] = this.match(TokenType.Punctuation, '(') ? this.parseArguments() : [];
    const body = this.match(TokenType.Punctuation, '{') ? this.parseBlock() : undefined;
    const modifiers: ModifierNode[] = [];
    while (this.match(TokenType.Punctuation, '.')) { modifiers.push(this.parseModifier()); }
    return { type: "FunctionCall", callee, args, modifiers, body, loc: callee.loc };
  }

  private parseModifier(): ModifierNode {
    this.consume(TokenType.Punctuation, '.');
    const name = this.parseIdentifier().name;
    const args = this.match(TokenType.Punctuation, '(') ? this.parseArguments() : [];
    return { type: "Modifier", name, args, loc: { line: this.peek().line, column: this.peek().column } };
  }

  private parseBlock(): BlockNode {
    const startToken = this.consume(TokenType.Punctuation, '{');
    const statements: BaseNode[] = [];
    while (!this.match(TokenType.Punctuation, '}')) {
        if(this.match(TokenType.Keyword, '@effect')) {
            statements.push(this.parseEffect());
        } else {
            statements.push(this.parseFunctionCallOrComponent());
        }
    }
    this.consume(TokenType.Punctuation, '}');
    return { type: "Block", statements, loc: { line: startToken.line, column: startToken.column } };
  }
  
  private parseEffect(): EffectNode {
      this.consume(TokenType.Keyword, '@effect');
      this.consume(TokenType.Punctuation, '(');
      const dependencies: IdentifierNode[] = [];
      while(!this.match(TokenType.Punctuation, ')')) {
          dependencies.push(this.parseIdentifier());
          if(this.match(TokenType.Punctuation, ',')) this.advance();
      }
      this.consume(TokenType.Punctuation, ')');
      const body = this.parseBlock();
      return { type: "Effect", dependencies, body, loc: { line: this.peek().line, column: this.peek().column } };
  }

  private parseWindow(): WindowNode {
    const startToken = this.consume(TokenType.Keyword, 'Window');
    this.consume(TokenType.Punctuation, '(');
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
      while (!this.match(TokenType.Punctuation, '}')) {
          const memberName = this.parseIdentifier().name;
          this.consume(TokenType.Punctuation, ':');
          const typeName = this.parseIdentifier().name;
          const isOptional = this.match(TokenType.Punctuation, '?');
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
    while (!this.match(TokenType.Punctuation, ')')) {
        let isBinding = false;
        if (this.match(TokenType.Keyword, '@binding')) {
            this.advance();
            isBinding = true;
        }
        const paramName = this.parseIdentifier().name;
        this.consume(TokenType.Punctuation, ':');
        const typeName = this.parseIdentifier().name;
        params.push({ type: "Parameter", name: paramName, typeName, isBinding, loc: { line: startToken.line, column: startToken.column } });
        if (this.match(TokenType.Punctuation, ',')) { this.advance(); }
    }
    this.consume(TokenType.Punctuation, ')');
    const body = this.parseBlock();
    return { type: "ComponentDeclaration", name, params, body, loc: { line: startToken.line, column: startToken.column } };
  }

  public parse(): ProgramNode {
    const program: ProgramNode = { type: "Program", body: [] };
    while (!this.match(TokenType.EndOfFile)) {
        const token = this.peek();
        if (this.match(TokenType.Keyword, '@main')) { program.body.push(this.parseEntryPoint()); }
        else if (this.match(TokenType.Keyword, 'struct')) { program.body.push(this.parseStructDeclaration()); } 
        else if (this.match(TokenType.Keyword, 'component')) { program.body.push(this.parseComponentDeclaration()); } 
        else { this.error(`Неожиданный токен на верхнем уровне программы: ${TokenType[token.type]} '${token.value || ''}'`, token); }
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
  constructor(ast: ProgramNode) { this.ast = ast; }
  private indent(): string { return '    '.repeat(this.indentLevel); }
  private emit(line: string = ''): void { this.generatedCode.push(this.indent() + line); }
  private generateType(typeName: string, isOptional: boolean): string {
    let swiftType = typeName;
    switch(typeName) {
        case "Int": swiftType = "Int"; break; case "String": swiftType = "String"; break;
        case "Bool": swiftType = "Bool"; break; case "UUID": swiftType = "UUID"; break;
        case "Date": swiftType = "Date"; break; case "Void": swiftType = "Void"; break;
        case "Point": swiftType = "CGPoint"; break; default: swiftType = typeName; 
    }
    return swiftType + (isOptional ? '?' : '');
  }

  private generateExpression(node: BaseNode): string {
    if (node.type === "Identifier") return (node as IdentifierNode).name;
    if (node.type === "NumberLiteral") return (node as NumberLiteralNode).value.toString();
    if (node.type === "StringLiteral") {
        const stringLiteral = node as StringLiteralNode;
        return `"${stringLiteral.value.map(p => (typeof p === 'string') ? p : `\\(${this.generateExpression((p as StringInterpolationNode).expression)})`).join('')}"`;
    }
    return `/* UNKNOWN_EXPRESSION */`;
  }
  
  private generateArguments(args: ArgumentNode[]): string {
      return args.map(arg => {
          const value = this.generateExpression(arg.value);
          if(arg.name) return `${arg.name.name}: ${value}`;
          return value;
      }).join(', ');
  }

  private generateModifier(modifier: ModifierNode): string {
    const args = this.generateArguments(modifier.args);
    return `.${modifier.name}(${args})`;
  }

  private generateBlock(block: BlockNode, isViewBuilder: boolean = true): void {
    if(!isViewBuilder) this.emit('{');
    this.indentLevel++;
    for (const stmt of block.statements) {
      if (stmt.type === "FunctionCall") {
        const call = stmt as FunctionCallNode;
        const args = this.generateArguments(call.args);
        let callStr = `${call.callee.name}(${args})`;
        if(call.body) {
            this.emit(callStr + ' {');
            this.indentLevel++;
            if (call.callee.name === 'ForEach') {
                this.emit(`${this.generateExpression(call.args[0].value)} in`);
            }
            this.generateBlock(call.body);
            this.indentLevel--;
            this.emit('}');
        } else {
            this.emit(callStr);
        }
        
        this.indentLevel++;
        for (const mod of call.modifiers) { this.emit(this.generateModifier(mod)); }
        this.indentLevel--;
      }
    }
    this.indentLevel--;
    if(!isViewBuilder) this.emit('}');
  }

  private generateStruct(node: StructDeclarationNode): void {
      this.emit(`struct ${node.name}: Identifiable, Codable {`);
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
      this.generateBlock(node.body);
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
      if (node.type === "StructDeclaration") { this.generateStruct(node as StructDeclarationNode); } 
      else if (node.type === "ComponentDeclaration") { this.generateComponent(node as ComponentDeclarationNode); }
      else if (node.type === "ProgramEntryPoint") {
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
            this.generateBlock(window.body);
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

interface GeneratedFile { fileName: string; content: string; }

export async function compileSynthesisProject(projectRoot: string, outputDir: string, platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux'): Promise<GeneratedFile[]> {
  console.log(`[SYNTHESIS Compiler] Компиляция проекта в ${projectRoot} для ${platform}...`);
  const synFiles: string[] = [];
  const findSynFiles = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { findSynFiles(fullPath); } 
          else if (entry.isFile() && entry.name.endsWith('.syn')) { synFiles.push(fullPath); }
      }
  };
  findSynFiles(projectRoot);
  if (synFiles.length === 0) { throw new Error("Не найдено .syn файлов в проекте."); }
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
  } else { throw new Error(`Генератор для платформы ${platform} не реализован.`); }
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, generatedFileName);
  fs.writeFileSync(outputPath, generatedNativeCode);
  console.log(`[SYNTHESIS Compiler] Нативный код сгенерирован в: ${outputPath}`);
  return [{ fileName: generatedFileName, content: generatedNativeCode }];
}

if (require.main === module) {
  const testProjectRoot = path.join(__dirname, '../../temp_synthesis_project');
  if (!fs.existsSync(testProjectRoot)) fs.mkdirSync(testProjectRoot, { recursive: true });
  fs.writeFileSync(path.join(testProjectRoot, 'main.syn'), `
    @main
    func AppDelegate { Window("Test App") { Text("Hello from Test") } }
  `);
  const testOutputDir = path.join(testProjectRoot, 'generated', 'ios');
  console.log('\n--- Тестирование компилятора SYNTHESIS напрямую ---');
  compileSynthesisProject(testProjectRoot, testOutputDir, 'ios')
    .then(files => console.log('Компиляция тестового файла прошла успешно.'))
    .catch(e => console.error('Ошибка компиляции тестового файла:', e.message));
}

    