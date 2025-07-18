
"use client";

import {
  File,
  FileText,
  FileJson,
  FileCode,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  Table,
  Terminal,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

interface FileIconProps extends LucideProps {
  filename: string;
}

export function FileIcon({ filename, ...props }: FileIconProps) {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    // Code
    case "js":
    case "jsx":
      return <FileCode {...props} color="#f7df1e" />; // Yellow for JS
    case "ts":
    case "tsx":
      return <FileCode {...props} color="#3178c6" />; // Blue for TS
    case "json":
      return <FileJson {...props} color="#facc15" />; // Amber for JSON
    case "html":
      return <FileCode {...props} color="#e34f26" />; // Orange for HTML
    case "css":
      return <FileCode {...props} color="#264de4" />; // Blue for CSS
    case "md":
    case "mdx":
      return <FileText {...props} color="#0d6efd" />; // Blue for Markdown
    case "py":
      return <FileCode {...props} color="#3776ab" />; // Python Blue
    case "java":
    case "class":
      return <FileCode {...props} color="#f89820" />; // Oracle Orange
    case "cs":
      return <FileCode {...props} color="#68217a" />; // C# Purple
    case "go":
      return <FileCode {...props} color="#00add8" />; // Go Cyan
    case "php":
      return <FileCode {...props} color="#777bb4" />; // PHP Purple
    case "rs":
      return <FileCode {...props} color="#dea584" />; // Rust Orange
    case "rb":
      return <FileCode {...props} color="#cc342d" />; // Ruby Red
    case "yaml":
    case "yml":
      return <FileText {...props} color="#cb171e" />;
    case "sh":
    case "bat":
      return <Terminal {...props} color="#4eae4a" />;

    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
    case "ico":
      return <FileImage {...props} color="#a855f7" />; // Purple for Images

    // Audio
    case "mp3":
    case "wav":
    case "ogg":
    case "aac":
    case "flac":
    case "m4a":
      return <FileAudio {...props} color="#22c55e" />; // Green for Audio

    // Video
    case "mp4":
    case "webm":
    case "mkv":
    case "mov":
      return <FileVideo {...props} color="#ef4444" />; // Red for Video

    // Data
    case "csv":
    case "xls":
    case "xlsx":
      return <Table {...props} color="#10b981" />; // Emerald for data tables

    // Archives
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <FileArchive {...props} color="#f97316" />; // Orange for Archives

    // Generic Text / Fallback
    case "txt":
      return <FileText {...props} />;
    default:
      return <File {...props} />;
  }
}
