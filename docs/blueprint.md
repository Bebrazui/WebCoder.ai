# **App Name**: WebCoder.ai

## Core Features:

- File Explorer: Displays a file explorer in a sidebar, mirroring VS Code, using a tree component to represent the virtual file system.
- Monaco Editor Integration: Implements a code editor using Monaco Editor, supporting syntax highlighting and basic autocompletion.
- ZIP Archive Support: Allows users to upload ZIP archives, which are then unpacked into the virtual file system using JSZip.
- File Upload: Allows users to upload files from their computer to the virtual file system.
- Find/Replace: Implements find/replace functionality for the currently opened file, or globally for the entire project.
- AI Code Transformer: Select a portion of code and instruct the AI what to do with it
- Session Persistence: Persists IDE state (open files, virtual file system) in IndexedDB to preserve data between sessions.

## Style Guidelines:

- Primary color: Dark grayish-blue (#4A6572) to establish a professional, serious tone. This will work in a dark theme.
- Background color: Dark desaturated blue (#232F34) for the main interface.
- Accent color: Analogous lighter blue (#7EA1B2) for buttons, selections, and important UI elements.
- Headline font: 'Space Grotesk' (sans-serif) for a techy, scientific feel; use for headlines.
- Body font: 'Inter' (sans-serif) for a modern, machined, objective look; use for body text.
- Code font: 'Source Code Pro' (monospace) for displaying code snippets.
- Use clean, modern icons sourced from a library like Phosphor Icons to ensure consistency.
- Adopts a layout similar to VS Code, with a sidebar for file exploration, a central editor pane, and a status bar at the bottom.