import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

export async function authenticate(req, _res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
    }

    const claims = jwt.verify(token, config.jwtSecret);
    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, phone_number, role FROM users WHERE user_id = ? AND is_active = 1',
      [claims.sub]
    );
    if (!rows.length) {
      throw new HttpError(401, 'Sesi akun tidak aktif.');
    }
    req.user = rows[0];
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.'));
    }
    return next(error);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new HttpError(403, 'Akses khusus admin.'));
  }
  return next();
}
