import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { extractDocumentWithGemini } from './gemini';
import type { ExtractedDocumentResult } from '../src/shared/types';
import { uploadsDir } from './db';

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.csv',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function validateUploadedFile(originalName: string, size: number): { valid: boolean; error?: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file type "${ext}". Allowed: PDF, DOCX, DOC, TXT, CSV, XLSX, JPG, JPEG, PNG, WEBP.`,
    };
  }
  if (size <= 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds the 15 MB upload limit.' };
  }
  return { valid: true };
}

export async function processUploadedDocument(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  category: 'question_paper' | 'model_answers' | 'marking_scheme' | 'student_sheet';
  hintLanguage?: string;
}): Promise<ExtractedDocumentResult> {
  const ext = path.extname(params.originalName).toLowerCase();
  const safeName = `${Date.now()}-${params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storedPath = path.join(uploadsDir, safeName);
  fs.writeFileSync(storedPath, params.buffer);
  const storedFileUrl = `/api/uploads/${safeName}`;

  // Images: always go straight to Gemini Vision for handwriting/diagram/printed OCR
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    const resolvedMime =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const aiExtracted = await extractDocumentWithGemini({
      category: params.category,
      fileName: params.originalName,
      mimeType: resolvedMime,
      buffer: params.buffer,
      hintLanguage: params.hintLanguage,
    });
    return {
      category: params.category,
      fileName: params.originalName,
      fileSize: params.size,
      mimeType: resolvedMime,
      storedFileUrl,
      ...aiExtracted,
    };
  }

  // Extract raw text for text-based formats
  let localText = '';
  const localWarnings: string[] = [];

  if (ext === '.txt' || ext === '.csv') {
    localText = params.buffer.toString('utf-8');
  } else if (ext === '.xlsx') {
    const wb = XLSX.read(params.buffer, { type: 'buffer' });
    localText = wb.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return `--- Sheet: ${name} ---\n${csv}`;
    }).join('\n\n');
  } else if (ext === '.docx') {
    const res = await mammoth.extractRawText({ buffer: params.buffer });
    localText = res.value || '';
  } else if (ext === '.doc') {
    // Legacy binary .doc fallback: extract readable ASCII/UTF-8 runs and warn teacher to verify
    localText = params.buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t\u0900-\u0D7F]/g, ' ').replace(/\s{3,}/g, '\n');
    localWarnings.push('Legacy .doc format has limited formatting support. Please review extracted text carefully or convert to .docx/.pdf.');
  } else if (ext === '.pdf') {
    try {
      const parser = new PDFParse({ data: params.buffer });
      const pdfData = await parser.getText();
      await parser.destroy();
      localText = (pdfData.text || '').trim();
    } catch {
      localText = '';
    }

    // If PDF has little/no text layer (scanned/handwritten PDF), use Gemini multimodal PDF reader directly!
    if (localText.length < 30) {
      const aiExtracted = await extractDocumentWithGemini({
        category: params.category,
        fileName: params.originalName,
        mimeType: 'application/pdf',
        buffer: params.buffer,
        hintLanguage: params.hintLanguage,
      });
      return {
        category: params.category,
        fileName: params.originalName,
        fileSize: params.size,
        mimeType: 'application/pdf',
        storedFileUrl,
        ...aiExtracted,
      };
    }
  }

  // Structure extracted text using Gemini (detects Q&A, paper sets, student info, language, uncertain text)
  const aiStructured = await extractDocumentWithGemini({
    category: params.category,
    fileName: params.originalName,
    mimeType: params.mimeType || 'text/plain',
    extractedText: localText,
    hintLanguage: params.hintLanguage,
  });

  return {
    category: params.category,
    fileName: params.originalName,
    fileSize: params.size,
    mimeType: params.mimeType || 'text/plain',
    storedFileUrl,
    ...aiStructured,
    uncertainWarnings: [...localWarnings, ...aiStructured.uncertainWarnings],
  };
}
