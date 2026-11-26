import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function required(name, minimumLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} must be configured with at least ${minimumLength} characters`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET', 32),
  uploadDirectory: path.resolve(currentDir, '..', 'uploads'),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'baking_classdwys',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true,
    timezone: 'Z'
  },
  admin: {
    name: process.env.ADMIN_NAME || 'Admin Baking',
    email: process.env.ADMIN_EMAIL || '',
    phone: process.env.ADMIN_PHONE || '',
    password: process.env.ADMIN_PASSWORD || ''
  },
  payment: {
    bankName: process.env.PAYMENT_BANK_NAME || '',
    accountName: process.env.PAYMENT_ACCOUNT_NAME || '',
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || '',
    instructions: process.env.PAYMENT_INSTRUCTIONS || ''
  }
};
