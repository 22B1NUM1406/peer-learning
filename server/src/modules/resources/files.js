import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { badRequest } from '../../lib/errors.js';

// FR-23: файлыг Railway volume (UPLOAD_DIR) дээр хадгална.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (NFR-04)

// Файлын төрлийг хэрэглэгчийн илгээсэн нэр, Content-Type-д биш, файлын эхний байтад
// (magic bytes) үндэслэн тодорхойлно. Ингэснээр .pdf гэж нэрлэсэн өөр файл нэвтрэхгүй.
const SIGNATURES = [
  { mime: 'application/pdf', ext: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] },             // %PDF
  { mime: 'image/png', ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
];

export function detectType(buffer) {
  return SIGNATURES.find((s) => s.bytes.every((b, i) => buffer[i] === b)) ?? null;
}

const uploadDir = () => path.resolve(config.uploadDir);

// Дискэн дээрх нэрийг санамсаргүй үүсгэнэ: хэрэглэгчийн нэрээс үүдэх
// давхцал, "../" гэх мэт замын халдлагаас (path traversal) хамгаална.
export async function saveFile(buffer) {
  const type = detectType(buffer);
  if (!type) throw badRequest('Зөвхөн PDF, PNG, JPG файл байршуулна');
  await fs.mkdir(uploadDir(), { recursive: true });
  const name = `${crypto.randomUUID()}${type.ext}`;
  await fs.writeFile(path.join(uploadDir(), name), buffer, { flag: 'wx' });
  return { filePath: name, mimeType: type.mime, fileSize: buffer.length };
}

export function absolutePath(filePath) {
  // Өгөгдлийн сангаас ирсэн нэрийг ч дахин шалгана
  const p = path.join(uploadDir(), path.basename(filePath));
  return p;
}

export async function removeFile(filePath) {
  if (!filePath) return;
  await fs.rm(absolutePath(filePath), { force: true });
}

export const extensionFor = (mime) => SIGNATURES.find((s) => s.mime === mime)?.ext ?? '';
