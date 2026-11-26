import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

fs.mkdirSync(config.uploadDirectory, { recursive: true });

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

export const proofUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${allowedTypes.get(file.mimetype) || '.upload'}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new HttpError(400, 'Bukti harus berupa gambar JPG, PNG, atau WebP.'));
    }
    return callback(null, true);
  }
});

export function getProofPath(filename) {
  const resolved = path.resolve(config.uploadDirectory, filename);
  if (path.dirname(resolved) !== config.uploadDirectory) {
    throw new HttpError(404, 'Bukti pembayaran tidak ditemukan.');
  }
  return resolved;
}

