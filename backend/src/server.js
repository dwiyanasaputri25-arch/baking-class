import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool, checkDatabase } from './db.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import classRoutes from './routes/classes.js';
import bookingRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import { asyncRoute, errorHandler, notFound } from './utils/errors.js';
import { expirePendingBookings } from './services/expiry.js';

async function bootstrapAdmin() {
  const { name, email, phone, password } = config.admin;
  if (!email || !phone || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_PHONE, and ADMIN_PASSWORD (minimum 12 characters) in backend/.env.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const [rows] = await pool.execute(
    'SELECT user_id, role, password_hash FROM users WHERE email = ?',
    [normalizedEmail]
  );
  if (rows[0]) {
    if (rows[0].role !== 'admin') {
      throw new Error('ADMIN_EMAIL already belongs to a non-admin user; choose another email.');
    }
    if (!rows[0].password_hash) {
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.execute(
        'UPDATE users SET password_hash = ?, full_name = ?, phone_number = ? WHERE user_id = ?',
        [passwordHash, name, phone, rows[0].user_id]
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (full_name, email, password_hash, phone_number, role)
     VALUES (?, ?, ?, ?, 'admin')`,
    [name, normalizedEmail, passwordHash, phone]
  );
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}), authRoutes);
app.use('/api', classRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

let expiryTimer;
let server;

async function start() {
  await checkDatabase();
  await bootstrapAdmin();
  await expirePendingBookings();
  expiryTimer = setInterval(() => {
    expirePendingBookings().catch((error) => console.error('Booking expiry job failed:', error));
  }, 60 * 1000);
  server = app.listen(config.port, () => {
    console.log(`Baking class API listening on http://localhost:${config.port}`);
  });
}

async function shutdown() {
  clearInterval(expiryTimer);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
}

process.once('SIGINT', () => shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().finally(() => process.exit(0)));

start().catch(async (error) => {
  console.error('API startup failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});

export { app, bootstrapAdmin };
