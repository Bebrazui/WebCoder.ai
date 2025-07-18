// src/lib/synthesis_compiler.ts

// --- 1. Определение токенов ---
enum TokenType {
  Keyword,       // @main, func, Window, VStack, Text, font, color, struct, component, if, else, let, in, Button, style, padding, background, cornerRadius, shadow, alignment, spacing
  Identifier,    // Имена переменных, функций, компонентов
  StringLiteral, // "Hello World!"
  NumberLiteral, // 10, 20
  Punctuation,   // (, ), {, }, ., :, ;, =, ,, ?, !, \, <, >, =>
  Operator,      // =, ==, . (для доступа к свойствам)
  InterpolationStart, // \(
  InterpolationEnd, // )
  EndOfFile
}

interface Token {
  type: TokenType;
  value?: string;
}

// --- 2. Лексер (Токенизатор) ---
class Lexer {
  private code: string;
  private position: number = 0;

  constructor(code: string) {
    this.code = code;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z]/.test(char);
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
    return this.code[this.position++];
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    const keywords = new Set([
      "@main", "func", "Window", "VStack", "Text", "font", "color", "struct",
      "component", "if", "else", "let", "in", "Button", "style", "padding",
      "background", "cornerRadius", "shadow", "alignment", "spacing", "Int", "String", "Void"
    ]);

    while (this.position < this.code.length) {
      let char = this.peek();

      if (char === undefined) break;

      if (this.isWhitespace(char)) {
        this.advance();
        continue;
      }

      // Строковые литералы
      if (char === '"') {
        this.advance(); // Пропустить начальную кавычку
        let value = '';
        while (this.peek() !== '"' && this.peek() !== undefined) {
          if (this.peek() === '\\' && this.code[this.position + 1] === '(') { // Обнаружение интерполяции
            this.advance(); // Пропустить '\'
            this.advance(); // Пропустить '('
            tokens.push({ type: TokenType.StringLiteral, value: value });
            tokens.push({ type: TokenType.InterpolationStart });
            value = ''; // Сбросить буфер для следующей части строки
            break; // Выйти из цикла, чтобы лексер продолжил с выражения
          }
          value += this.advance();
        }
        if (this.peek() !== '"') {
            throw new Error(`Unterminated string literal at position ${this.position}`);
        }
        this.advance(); // Пропустить конечную кавычку
        if (value.length > 0 || tokens[tokens.length-1]?.type === TokenType.InterpolationStart) {
             tokens.push({ type: TokenType.StringLiteral, value: value });
        }
        continue;
      }

      // Числовые литералы
      if (this.isDigit(char)) {
        let value = '';
        while (this.isDigit(this.peek() || '') && this.peek() !== undefined) {
          value += this.advance();
        }
        tokens.push({ type: TokenType.NumberLiteral, value: value });
        continue;
      }

      // Идентификаторы и ключевые слова
      if (this.isAlpha(char) || char === '@') {
        let value = '';
        while (this.isAlphaNumeric(this.peek() || '') || this.peek() === '@') {
          value += this.advance();
        }
        if (keywords.has(value)) {
          tokens.push({ type: TokenType.Keyword, value: value });
        } else {
          tokens.push({ type: TokenType.Identifier, value: value });
        }
        continue;
      }

      // Символы пунктуации и операторы
      switch (char) {
        case '(': tokens.push({ type: TokenType.Punctuation, value: '(' }); this.advance(); break;
        case ')': 
          // This logic is tricky. Let's simplify for now.
          // The closing parenthesis could be for interpolation or a function call.
          // The parser will have to decide.
          tokens.push({ type: TokenType.Punctuation, value: ')' }); 
          this.advance();
          break;
        case '{': tokens.push({ type: TokenType.Punctuation, value: '{' }); this.advance(); break;
        case '}': tokens.push({ type: TokenType.Punctuation, value: '}' }); this.advance(); break;
        case '.': tokens.push({ type: TokenType.Punctuation, value: '.' }); this.advance(); break;
        case ':': tokens.push({ type: TokenType.Punctuation, value: ':' }); this.advance(); break;
        case ';': tokens.push({ type: TokenType.Punctuation, value: ';' }); this.advance(); break;
        case '=':
            tokens.push({ type: TokenType.Operator, value: '=' });
            this.advance();
          break;
        case ',': tokens.push({ type: TokenType.Punctuation, value: ',' }); this.advance(); break;
        case '?': tokens.push({ type: TokenType.Punctuation, value: '?' }); this.advance(); break;
        case '!': tokens.push({ type: TokenType.Punctuation, value: '!' }); this.advance(); break;
        case '<': tokens.push({ type: TokenType.Punctuation, value: '<' }); this.advance(); break;
        case '>': tokens.push({ type: TokenType.Punctuation, value: '>' }); this.advance(); break;
        default:
          throw new Error(`Unexpected character: ${char} at position ${this.position}`);
      }
    }

    tokens.push({ type: TokenType.EndOfFile });
    return tokens;
  }
}

// --- 3. Парсер (Базовый синтаксический анализатор) ---

// Упрощенные типы узлов AST
interface Node {
  type: string;
}

interface ProgramNode extends Node {
  type: "Program";
  body: Node[];
}

interface WindowNode extends Node {
  type: "Window";
  title: string;
  body: Node;
}

interface VStackNode extends Node {
  type: "VStack";
  props: { [key: string]: any }; // Упрощено
  children: Node[];
}

interface TextNode extends Node {
  type: "Text";
  value: (string | Node)[]; // Может содержать интерполяцию
  modifiers: Node[];
}

interface ModifierNode extends Node {
  type: "Modifier";
  name: string;
  args: Node[];
}

interface StringInterpolationNode extends Node {
  type: "StringInterpolation";
  expression: Node; // Здесь должно быть более сложное выражение
}

interface LiteralNode extends Node {
  type: "Literal";
  value: string | number;
}

interface IdentifierNode extends Node {
  name: string;
}


class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.position];
  }

  private advance(): Token {
    return this.tokens[this.position++];
  }

  private consume(expectedType: TokenType, expectedValue?: string): Token {
    const token = this.advance();
    if (token.type !== expectedType || (expectedValue && token.value !== expectedValue)) {
      throw new Error(`Expected token type ${TokenType[expectedType]}${expectedValue ? ` with value ${expectedValue}` : ''}, but got ${TokenType[token.type]} ${token.value || ''} at position ${this.position - 1}`);
    }
    return token;
  }

  private parseModifier(): ModifierNode {
    this.consume(TokenType.Punctuation, '.'); // Consume '.'
    const name = this.consume(TokenType.Identifier).value!; // e.g., font, color
    this.consume(TokenType.Punctuation, '('); // Consume '('

    const args: Node[] = [];
    if (this.peek().type !== TokenType.Punctuation || this.peek().value !== ')') {
        // Упрощенно: ожидаем один аргумент-идентификатор для стилей вроде .font(.title)
        this.consume(TokenType.Punctuation, '.'); // Consume '.' for enum-like values
        args.push({ type: "Identifier", name: this.consume(TokenType.Identifier).value! });
    }
    this.consume(TokenType.Punctuation, ')'); // Consume ')'
    return { type: "Modifier", name, args };
  }


  private parseExpression(): Node {
    // В реальном парсере здесь была бы логика для разбора сложных выражений.
    // Для этого демо, мы просто разбираем идентификаторы или литералы.
    const token = this.peek();
    if (token.type === TokenType.Identifier) {
      return { type: "Identifier", name: this.advance().value! };
    } else if (token.type === TokenType.NumberLiteral) {
      return { type: "Literal", value: parseInt(this.advance().value!) };
    }
    // For simplicity, we assume an expression ends with ')' here for interpolation
    if (token.type === TokenType.Punctuation && token.value === ')') {
        return { type: "Identifier", name: "unknown" } // Placeholder
    }
    throw new Error(`Unexpected token in expression: ${TokenType[token.type]} ${token.value || ''}`);
  }

  private parseStringContent(): (string | Node)[] {
    const parts: (string | Node)[] = [];
    if (this.peek().type === TokenType.StringLiteral) {
      parts.push(this.advance().value!);
    }
    // Handle interpolation start if it exists
    if (this.peek().type === TokenType.InterpolationStart) {
        this.advance(); // Consume InterpolationStart
        const expression = this.parseExpression();
        parts.push({ type: "StringInterpolation", expression: expression});
        this.consume(TokenType.Punctuation, ')'); // consume ')' that marks end of interpolation
    }
    // check for more string parts after interpolation
    if (this.peek().type === TokenType.StringLiteral) {
        parts.push(this.advance().value!);
    }
    return parts;
  }


  private parseComponentBody(): Node[] {
    const children: Node[] = [];
    this.consume(TokenType.Punctuation, '{'); // Consume '{'
    while (this.peek().type !== TokenType.Punctuation || this.peek().value !== '}') {
      const token = this.peek();

      // Очень упрощенный парсинг для Text и VStack
      if (token.type === TokenType.Keyword && token.value === 'VStack') {
        children.push(this.parseVStack());
      } else if (token.type === TokenType.Keyword && token.value === 'Text') {
        children.push(this.parseText());
      } else if (token.type === TokenType.Keyword && token.value === 'Button') {
        // Для Button просто пропустим его для демонстрации
        this.advance(); // consume Button
        this.consume(TokenType.Punctuation, '(');
        this.consume(TokenType.StringLiteral); // button text
        this.consume(TokenType.Punctuation, ')');
        this.consume(TokenType.Punctuation, '{'); // action block
        while(this.peek().type !== TokenType.Punctuation || this.peek().value !== '}') {
            this.advance(); // consume everything inside the button block for simplicity
        }
        this.consume(TokenType.Punctuation, '}');
        while(this.peek().type === TokenType.Punctuation && this.peek().value === '.') {
            this.parseModifier(); // Consume modifiers
        }

      } else {
        throw new Error(`Unexpected token in component body: ${TokenType[token.type]} ${token.value || ''}`);
      }
    }
    this.consume(TokenType.Punctuation, '}'); // Consume '}'
    return children;
  }

  private parseText(): TextNode {
    this.consume(TokenType.Keyword, 'Text');
    this.consume(TokenType.Punctuation, '(');
    const value = this.parseStringContent(); // Обрабатываем строку с интерполяцией
    this.consume(TokenType.Punctuation, ')');

    const modifiers: ModifierNode[] = [];
    while (this.peek().type === TokenType.Punctuation && this.peek().value === '.') {
      modifiers.push(this.parseModifier());
    }
    return { type: "Text", value, modifiers };
  }

  private parseVStack(): VStackNode {
    this.consume(TokenType.Keyword, 'VStack');
    const props: { [key: string]: any } = {};
    if (this.peek().type === TokenType.Punctuation && this.peek().value === '(') {
      this.consume(TokenType.Punctuation, '(');
      while (this.peek().type !== TokenType.Punctuation || this.peek().value !== ')') {
        const propName = this.consume(TokenType.Identifier).value!; // e.g., alignment
        this.consume(TokenType.Punctuation, ':');
        this.consume(TokenType.Punctuation, '.'); // For enum-like values like .leading
        const propValue = this.consume(TokenType.Identifier).value!;
        props[propName] = propValue;
        if (this.peek().type === TokenType.Punctuation && this.peek().value === ',') {
          this.consume(TokenType.Punctuation, ',');
        }
      }
      this.consume(TokenType.Punctuation, ')');
    }

    const children = this.parseComponentBody(); // Рекурсивно парсим дочерние элементы

    while (this.peek().type === TokenType.Punctuation && this.peek().value === '.') {
        this.parseModifier(); // Просто пропускаем модификаторы VStack для этого демо
    }

    return { type: "VStack", props, children };
  }

  private parseWindow(): WindowNode {
    this.consume(TokenType.Keyword, 'Window');
    this.consume(TokenType.Punctuation, '(');
    const titleToken = this.consume(TokenType.StringLiteral);
    this.consume(TokenType.Punctuation, ')');
    this.consume(TokenType.Punctuation, '{');
    const body = this.parseVStack(); // Для этого демо, ожидаем VStack как корневой элемент окна
    this.consume(TokenType.Punctuation, '}');
    return { type: "Window", title: titleToken.value!, body };
  }

  public parse(): ProgramNode {
    const program: ProgramNode = { type: "Program", body: [] };

    if (this.peek().type === TokenType.Keyword && this.peek().value === '@main') {
      this.consume(TokenType.Keyword, '@main');
      this.consume(TokenType.Keyword, 'func');
      this.consume(TokenType.Identifier, 'AppDelegate');
      this.consume(TokenType.Punctuation, '{');
      program.body.push(this.parseWindow());
      this.consume(TokenType.Punctuation, '}');
    } else {
        throw new Error("Expected '@main func AppDelegate' as program entry point.");
    }

    this.consume(TokenType.EndOfFile);
    return program;
  }
}

// --- 4. Генератор TypeScript-кода (очень-очень упрощенно) ---
class TypeScriptCodeGenerator {
  private ast: ProgramNode;

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  private generateComponent(node: Node): string {
    if (node.type === "VStack") {
      const vstackNode = node as VStackNode;
      const props = JSON.stringify(vstackNode.props);
      const children = vstackNode.children.map(c => this.generateComponent(c)).join(',\n        ');
      return `
      {
        type: "VStack",
        props: ${props},
        children: [
          ${children}
        ]
      }`;
    } else if (node.type === "Text") {
      const textNode = node as TextNode;
      let textValue = '';
      textNode.value.forEach(part => {
        if (typeof part === 'string') {
          textValue += part;
        } else if (part.type === 'StringInterpolation') {
          const expr = part.expression as IdentifierNode;
          textValue += `\${this.user.${expr.name}}`; // Очень упрощено
        }
      });
      
      return `{ type: "Text", props: { value: \`${textValue}\` } }`;
    } else if (node.type === "Button") {
        return `{ type: "Button", props: { text: "Edit User", style: "primary" } }`;
    }
    // Добавьте другие типы узлов по мере необходимости
    return `/* Unknown Node Type: ${node.type} */`;
  }

  public generate(): string {
    const programNode = this.ast.body[0] as WindowNode; // Ожидаем Window как корневой узел
    const bodyContent = this.generateComponent(programNode.body);

    return `
// NOTE: This is a pseudo-TS representation, not executable code.
// It demonstrates the structure derived from the SYNTHESIS source.

const appRootDescription = ${bodyContent.trim()};

// console.log(JSON.stringify(appRootDescription, null, 2));
`;
  }
}

/**
 * Compiles a string of SYNTHESIS code.
 * This is a simplified demonstration and not a real compiler.
 * @param code The SYNTHESIS code to compile.
 * @returns A string containing the compilation output (tokens and pseudo-TS).
 */
export function compileSynthesis(code: string): string {
  let output = '--- Original SYNTHESIS Code ---\n';
  output += code + '\n';
  
  try {
    // 1. Лексический анализ
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    output += '\n--- Tokens ---\n';
    tokens.forEach(token => {
      output += `${TokenType[token.type]}: ${token.value || ''}\n`
    });

    // 2. Синтаксический анализ
    const parser = new Parser(tokens);
    const ast = parser.parse();
    output += '\n--- Abstract Syntax Tree (AST) ---\n';
    output += JSON.stringify(ast, null, 2) + '\n';

    // 3. Генерация TypeScript-кода (очень упрощено)
    const tsGenerator = new TypeScriptCodeGenerator(ast);
    const generatedTsCode = tsGenerator.generate();
    output += '\n--- Generated TypeScript Description ---\n';
    output += generatedTsCode;
    
    return output;

  } catch (e: any) {
    let errorOutput = '\n--- Compilation Error ---\n';
    errorOutput += e.message;
    return output + errorOutput;
  }
}
