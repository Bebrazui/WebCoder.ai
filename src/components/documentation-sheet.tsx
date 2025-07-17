// src/components/documentation-sheet.tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { useAppState } from "@/hooks/use-app-state";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from 'react-markdown';

const documentationContent = `
# WebCoder.ai - Ваша Персональная AI-Powered IDE

WebCoder.ai - это многофункциональная, кроссплатформенная интегрированная среда разработки (IDE), созданная с использованием Next.js, Electron и TypeScript. Она предоставляет гибкую среду для написания, запуска и отладки кода на различных языках, а также уникальные инструменты, такие как встроенный No-Code редактор игр.

## Ключевые возможности

- **Мультиязычная среда выполнения:** Запускайте код на **Java, Python, Go, C#, Rust, PHP и Ruby** прямо из IDE. Конфигурация запуска определяется файлом \`launch.json\`.
- **Интерактивный терминал:** В десктопной версии Electron доступен полноценный системный терминал для выполнения команд, таких как \`npm install\`, \`git status\` и других.
- **Интеграция с Git:** Панель "Source Control" позволяет отслеживать изменения, делать коммиты и отправлять их на GitHub (требуется Personal Access Token).
- **Редактор No-Code игр:** Создавайте простые 2D-игры без единой строчки кода!
  - Перейдите на страницу \`/nocode\`.
  - Используйте палитру для "рисования" уровня: добавляйте игрока, стены, монеты и врагов.
  - Загружайте собственные PNG/JPG изображения в качестве текстур для игровых объектов.
  - Нажмите "Launch Game", чтобы мгновенно протестировать свой уровень в новой вкладке.
- **Расширяемость через "Плагины":** Включайте и выключайте дополнительные инструменты через "Marketplace", чтобы настроить IDE под себя.
- **Работа с файловой системой:** Открывайте локальные папки, работайте с файлами через Drag & Drop, загружайте и скачивайте проекты в формате \`.zip\`.
- **AI-ассистент:** Используйте встроенный AI для трансформации и рефакторинга кода по текстовым инструкциям.

## Начало работы

### Как веб-приложение

Чтобы запустить приложение в браузере для стандартной веб-разработки:

\`\`\`bash
npm run dev
\`\`\`

### Как десктопное приложение (Electron)

**1. Запуск в режиме разработки:**

Эта команда запустит сервер разработки Next.js и откроет его в окне Electron. Это идеально подходит для тестирования и отладки.

\`\`\`bash
npm run electron:dev
\`\`\`

**2. Сборка для продакшена:**

Эта команда сначала соберет ваше Next.js-приложение в статические файлы, а затем упакует его в исполняемый файл для вашей текущей операционной системы (например, \`.exe\` для Windows, \`.dmg\` для macOS).

\`\`\`bash
npm run electron:build
\`\`\`

После завершения сборки вы найдете готовое приложение в каталоге \`dist\`.

> **Примечание:** При первой сборке может потребоваться несколько минут для загрузки необходимых бинарных файлов Electron.

`;


export function DocumentationSheet() {
  const { 
    isDocsOpen, 
    setIsDocsOpen,
  } = useAppState();

  return (
    <Sheet open={isDocsOpen} onOpenChange={setIsDocsOpen}>
      <SheetContent className="w-[600px] sm:w-[800px]">
        <SheetHeader>
          <SheetTitle>Документация по WebCoder.ai</SheetTitle>
          <SheetDescription>
            Вся необходимая информация для работы с IDE.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100%-80px)] mt-4">
            <div className="prose dark:prose-invert prose-lg p-4 max-w-full">
                <ReactMarkdown>{documentationContent}</ReactMarkdown>
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
