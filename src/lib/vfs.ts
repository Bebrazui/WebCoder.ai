
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
    'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
    'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb', 'rs', 'swift', 'kt',
    'yml', 'yaml', 'sh', 'bat', 'toml', 'gitignore', 'npmrc', 'log', 'sql', 'csv', 'env',
    'conf', 'ini', 'cfg', 'properties'
]);

// A list of mime types that are known to be text-based
const TEXT_MIME_TYPES = new Set([
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-sh',
    'image/svg+xml'
]);

/**
 * Determines if a file should be treated as text.
 * @param file - An object with `name` and optional `type` and `content` properties.
 * @returns `true` if the file is likely text-based, `false` otherwise.
 */
export function isTextFile(file: { name: string, type?: string, content?: string }): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Check by extension
    if (extension && TEXT_EXTENSIONS.has(extension)) {
        return true;
    }
    
    // Check by known binary extensions (if not already handled by more specific checks)
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|gz|tar|rar|7z|bin|exe|dll|class|woff|woff2|eot|ttf|otf|mp4|webm|mov)$/i.test(file.name)) {
        return false;
    }
    
    // Check by mime type if available
    if (file.type) {
        if (file.type.startsWith('text/')) {
            return true;
        }
        if (TEXT_MIME_TYPES.has(file.type)) {
            return true;
        }
        if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
            // Let specific handlers for image/audio deal with them, but they are not plain text
            return isImageFile(file.name) || isAudioFile(file.name) ? false : !file.type.startsWith('application/octet-stream');
        }
    }

    // Check by content if available (for data URIs)
    if (file.content && file.content.startsWith('data:')) {
        const mime = file.content.substring(5, file.content.indexOf(';'));
        if (mime.startsWith('text/')) return true;
        if (TEXT_MIME_TYPES.has(mime)) return true;
        return false;
    }
    
    // Fallback: If no extension, assume text unless it's a known binary file
    if (!extension && !isImageFile(file.name) && !isAudioFile(file.name)) {
        return true;
    }

    // Default to false for unknown extensions not in our text list
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
