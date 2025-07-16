// src/lib/vfs.ts
export interface VFSFile {
  type: "file";
  path: string;
  name: string;
  content: string;
}

export interface VFSDirectory {
  type: "directory";
  path: string;
  name: string;
  children: VFSNode[];
}

export type VFSNode = VFSFile | VFSDirectory;

export function createDirectory(name: string, path: string): VFSDirectory {
  return { type: "directory", name, path, children: [] };
}

export const isImageFile = (filename: string) => /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(filename);
export const isAudioFile = (filename: string) => /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(filename);
export const isClassFile = (filename: string) => /\.class$/i.test(filename);
export const isSceneFile = (filename: string) => /\.scene$/i.test(filename);


// A list of extensions that are known to be text-based
const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'mdx', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
    'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'rs', 'swift', 'kt',
    'yml', 'yaml', 'sh', 'bat', 'toml', 'gitignore', 'npmrc', 'log', 'sql', 'csv', 'env',
    'conf', 'ini', 'cfg', 'properties', 'editorconfig', 'prettierrc', 'eslintrc', 'babelrc', 'mod', 'sum', 'csproj',
    'scene', 'object' // NoCodeH files are text (JSON)
]);

/**
 * Determines if a file should be treated as text based on its extension or if it's a data URI.
 * @param file - An object with a `name` and optional `content` property.
 * @returns `true` if the file extension is in the known text list or if content is not a data URI, `false` otherwise.
 */
export function isTextFile(file: { name: string, content?: string }): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Prioritize extension check
    if (extension && TEXT_EXTENSIONS.has(extension)) {
        return true;
    }
    
    // If we have content, check if it's a data URI. If not, assume text.
    if (file.content && !file.content.startsWith('data:')) {
        return true;
    }
    
    // If it is a data URI, check mime type for text.
    if(file.content && file.content.startsWith('data:text/')) {
        return true;
    }

    // Default to false for files with unknown extensions or non-text data URIs
    return false;
}


// 1x1 transparent PNG
const TRANSPARENT_PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";


export function createFile(
  name: string,
  path: string,
  content: string
): VFSFile {
  // If a new image file is being created with empty content, give it a default transparent pixel.
  if (content === "" && isImageFile(name)) {
    return { type: "file", name, path, content: TRANSPARENT_PNG_DATA_URI };
  }
  return { type: "file", name, path, content };
}

export function getLanguage(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'json':
        case 'scene':
        case 'object':
        case 'nocodeh':
            return 'json';
        case 'css':
            return 'css';
        case 'html':
            return 'html';
        case 'md':
        case 'mdx':
            return 'markdown';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'c':
        case 'h':
            return 'c';
        case 'cpp':
        case 'hpp':
            return 'cpp';
        case 'cs':
        case 'csproj':
            return 'csharp';
        case 'go':
            return 'go';
        case 'php':
            return 'php';
        case 'rb':
            return 'ruby';
        case 'rs':
            return 'rust';
        case 'swift':
            return 'swift';
        case 'kt':
            return 'kotlin';
        case 'yaml':
        case 'yml':
            return 'yaml';
        case 'sql':
            return 'sql';
        case 'sh':
        case 'bat':
            return 'shell';
        default:
            return 'plaintext';
    }
}
