
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
export const isJavaClassFile = (filename: string) => /\.class$/i.test(filename);

// A list of extensions that are known to be text-based
const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'mdx', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
    'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'rs', 'swift', 'kt',
    'yml', 'yaml', 'sh', 'bat', 'toml', 'gitignore', 'npmrc', 'log', 'sql', 'csv', 'env',
    'conf', 'ini', 'cfg', 'properties', 'editorconfig', 'prettierrc', 'eslintrc', 'babelrc'
]);

/**
 * Determines if a file should be treated as text based on its extension.
 * @param file - An object with a `name` property.
 * @returns `true` if the file extension is in the known text list, `false` otherwise.
 */
export function isTextFile(file: { name: string }): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension) {
        return TEXT_EXTENSIONS.has(extension);
    }
    
    // If there's no extension, default to treating it as non-text to be safe
    // and avoid trying to render binary files as strings.
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
            return 'json';
        case 'css':
            return 'css';
        case 'html':
            return 'html';
        case 'md':
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
