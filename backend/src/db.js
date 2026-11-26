import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool(config.database);

export async function checkDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
    const [tables] = await connection.query(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users', 'classes', 'instructors', 'studios', 'schedules', 'registrations', 'payments', 'app_settings')"
    );
    if (tables[0].count !== 8) {
      throw new Error('Database schema incomplete. Import the supplied SQL and apply migrations 001_app_extensions.sql and 002_payment_settings.sql.');
    }
  } finally {
    connection.release();
  }
}
