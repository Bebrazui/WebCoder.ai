
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function dataURIToArrayBuffer(dataURI: string): ArrayBuffer {
  if (!dataURI.startsWith('data:')) {
    // Fallback for plain text content
    const encoder = new TextEncoder();
    return encoder.encode(dataURI).buffer;
  }

  const base64Marker = ';base64,';
  const base64Index = dataURI.indexOf(base64Marker);
  if (base64Index === -1) {
    // Handle URL-encoded data URI
    const data = decodeURIComponent(dataURI.substring(dataURI.indexOf(',') + 1));
    const buffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < data.length; i++) {
      view[i] = data.charCodeAt(i);
    }
    return buffer;
  }

  const base64 = dataURI.substring(base64Index + base64Marker.length);
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));

  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array.buffer;
}
