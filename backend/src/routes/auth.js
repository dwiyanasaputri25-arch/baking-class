import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError, asyncRoute } from '../utils/errors.js';
import { normalizePhone } from '../utils/booking-rules.js';

const router = Router();
const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone_number: z.string().trim().min(8).max(20).transform(normalizePhone).pipe(z.string().regex(/^\+?\d{8,15}$/)),
  password: z.string().min(10).max(128)
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});
const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone_number: z.string().trim().min(8).max(20).transform(normalizePhone).pipe(z.string().regex(/^\+?\d{8,15}$/)),
  current_password: z.string().min(1).max(128).optional(),
  new_password: z.string().min(10).max(128).optional()
}).refine((data) => Boolean(data.current_password) === Boolean(data.new_password), {
  path: ['new_password'],
  message: 'Password lama dan password baru harus diisi bersama.'
});

function createToken(userId) {
  return jwt.sign({}, config.jwtSecret, { subject: String(userId), expiresIn: '12h' });
}

router.post('/register', asyncRoute(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [result] = await pool.execute(
    `INSERT INTO users (full_name, email, password_hash, phone_number, role)
     VALUES (?, ?, ?, ?, 'peserta')`,
    [input.full_name, input.email, passwordHash, input.phone_number]
  );
  const user = {
    user_id: result.insertId,
    full_name: input.full_name,
    email: input.email,
    phone_number: input.phone_number,
    role: 'peserta'
  };
  res.status(201).json({ token: createToken(user.user_id), user });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const [rows] = await pool.execute(
    `SELECT user_id, full_name, email, phone_number, role, password_hash
     FROM users WHERE email = ? AND is_active = 1`,
    [input.email]
  );
  const user = rows[0];
  if (!user?.password_hash || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new HttpError(401, 'Email atau password salah.');
  }

  delete user.password_hash;
  res.json({ token: createToken(user.user_id), user });
}));

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.patch('/me', authenticate, asyncRoute(async (req, res) => {
  const input = profileSchema.parse(req.body);
  const [rows] = await pool.execute(
    'SELECT password_hash FROM users WHERE user_id = ? AND is_active = 1',
    [req.user.user_id]
  );
  const currentUser = rows[0];
  if (!currentUser) throw new HttpError(404, 'Akun tidak ditemukan.');

  let passwordHash = currentUser.password_hash;
  if (input.new_password) {
    if (!passwordHash || !(await bcrypt.compare(input.current_password, passwordHash))) {
      throw new HttpError(400, 'Password saat ini tidak sesuai.');
    }
    passwordHash = await bcrypt.hash(input.new_password, 12);
  }

  await pool.execute(
    'UPDATE users SET full_name = ?, phone_number = ?, password_hash = ? WHERE user_id = ?',
    [input.full_name, input.phone_number, passwordHash, req.user.user_id]
  );
  const user = {
    ...req.user,
    full_name: input.full_name,
    phone_number: input.phone_number
  };
  res.json({ user, message: 'Profil berhasil diperbarui.' });
}));

export default router;
