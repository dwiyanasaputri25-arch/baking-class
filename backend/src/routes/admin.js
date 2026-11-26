import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getProofPath } from '../middleware/upload.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { getPaymentSettings, updatePaymentSettings } from '../services/payment-settings.js';

const router = Router();
router.use(authenticate, requireAdmin);

const idFrom = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'ID tidak valid.');
  return id;
};
const classInput = z.object({
  class_name: z.string().trim().min(3).max(100),
  category: z.string().trim().min(2).max(50),
  price: z.coerce.number().positive().max(100000000),
  description: z.string().trim().max(5000).default(''),
  terms_and_conditions: z.string().trim().min(10).max(10000),
  image_url: z.union([z.string().url().max(500), z.literal(''), z.null()]).optional()
});
const instructorInput = z.object({
  full_name: z.string().trim().min(2).max(100),
  expertise: z.string().trim().min(2).max(100),
  phone_number: z.string().trim().min(8).max(20)
});
const studioInput = z.object({
  studio_name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(1000),
  capacity: z.coerce.number().int().min(1).max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
const scheduleInput = z.object({
  studio_id: z.coerce.number().int().positive(),
  instructor_id: z.coerce.number().int().positive(),
  class_id: z.coerce.number().int().positive(),
  schedule_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  slot_capacity: z.coerce.number().int().min(1).max(500)
});
const paymentSettingsInput = z.object({
  bank_name: z.string().trim().min(2).max(100),
  account_name: z.string().trim().min(2).max(100),
  account_number: z.string().trim().regex(/^[0-9 -]{4,40}$/),
  instructions: z.string().trim().max(1000).default('')
});

router.get('/settings/payment', asyncRoute(async (_req, res) => {
  res.json(await getPaymentSettings());
}));

router.put('/settings/payment', asyncRoute(async (req, res) => {
  const data = paymentSettingsInput.parse(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await updatePaymentSettings(connection, data, req.user.user_id);
    await connection.commit();
    res.json({
      message: 'Informasi transfer berhasil diperbarui.',
      payment: await getPaymentSettings()
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/classes', asyncRoute(async (_req, res) => {
  const [classes] = await pool.query('SELECT * FROM classes ORDER BY class_id DESC');
  res.json({ classes });
}));

router.post('/classes', asyncRoute(async (req, res) => {
  const data = classInput.parse(req.body);
  const [result] = await pool.execute(
    `INSERT INTO classes (class_name, category, price, description, terms_and_conditions, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.class_name, data.category, data.price, data.description, data.terms_and_conditions, data.image_url || null]
  );
  res.status(201).json({ class_id: result.insertId });
}));

router.put('/classes/:classId', asyncRoute(async (req, res) => {
  const id = idFrom(req.params.classId);
  const data = classInput.parse(req.body);
  const [result] = await pool.execute(
    `UPDATE classes SET class_name = ?, category = ?, price = ?, description = ?,
       terms_and_conditions = ?, image_url = ? WHERE class_id = ?`,
    [data.class_name, data.category, data.price, data.description, data.terms_and_conditions, data.image_url || null, id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Kelas tidak ditemukan.');
  res.json({ message: 'Kelas diperbarui.' });
}));

router.delete('/classes/:classId', asyncRoute(async (req, res) => {
  const [result] = await pool.execute('UPDATE classes SET is_active = 0 WHERE class_id = ?', [idFrom(req.params.classId)]);
  if (!result.affectedRows) throw new HttpError(404, 'Kelas tidak ditemukan.');
  res.json({ message: 'Kelas dinonaktifkan; riwayat pendaftaran tetap tersimpan.' });
}));

router.get('/instructors', asyncRoute(async (_req, res) => {
  const [instructors] = await pool.query('SELECT * FROM instructors ORDER BY instructor_id DESC');
  res.json({ instructors });
}));

router.post('/instructors', asyncRoute(async (req, res) => {
  const data = instructorInput.parse(req.body);
  const [result] = await pool.execute(
    'INSERT INTO instructors (full_name, expertise, phone_number) VALUES (?, ?, ?)',
    [data.full_name, data.expertise, data.phone_number]
  );
  res.status(201).json({ instructor_id: result.insertId });
}));

router.put('/instructors/:instructorId', asyncRoute(async (req, res) => {
  const data = instructorInput.parse(req.body);
  const [result] = await pool.execute(
    'UPDATE instructors SET full_name = ?, expertise = ?, phone_number = ? WHERE instructor_id = ?',
    [data.full_name, data.expertise, data.phone_number, idFrom(req.params.instructorId)]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Instruktur tidak ditemukan.');
  res.json({ message: 'Instruktur diperbarui.' });
}));

router.delete('/instructors/:instructorId', asyncRoute(async (req, res) => {
  const [result] = await pool.execute('UPDATE instructors SET is_active = 0 WHERE instructor_id = ?', [idFrom(req.params.instructorId)]);
  if (!result.affectedRows) throw new HttpError(404, 'Instruktur tidak ditemukan.');
  res.json({ message: 'Instruktur dinonaktifkan.' });
}));

router.get('/studios', asyncRoute(async (_req, res) => {
  const [studios] = await pool.query('SELECT * FROM studios ORDER BY studio_id DESC');
  res.json({ studios });
}));

function studioGeometry(latitude, longitude) {
  const offset = 0.0005;
  const west = longitude - offset;
  const east = longitude + offset;
  const south = latitude - offset;
  const north = latitude + offset;
  const boundary = `POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`;
  const location = `POINT(${longitude} ${latitude})`;
  return { boundary, location };
}

router.post('/studios', asyncRoute(async (req, res) => {
  const data = studioInput.parse(req.body);
  const geometry = studioGeometry(data.latitude, data.longitude);
  const [result] = await pool.execute(
    `INSERT INTO studios (studio_name, address, capacity, boundary, location, latitude, longitude)
     VALUES (?, ?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'),
             ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?, ?)`,
    [data.studio_name, data.address, data.capacity, geometry.boundary, geometry.location, data.latitude, data.longitude]
  );
  res.status(201).json({ studio_id: result.insertId });
}));

router.put('/studios/:studioId', asyncRoute(async (req, res) => {
  const id = idFrom(req.params.studioId);
  const data = studioInput.parse(req.body);
  const [[largerSchedule]] = await pool.execute(
    'SELECT schedule_id FROM schedules WHERE studio_id = ? AND is_active = 1 AND slot_capacity > ? LIMIT 1',
    [id, data.capacity]
  );
  if (largerSchedule) {
    throw new HttpError(409, 'Kapasitas studio tidak boleh lebih kecil dari kuota jadwal aktif.');
  }
  const geometry = studioGeometry(data.latitude, data.longitude);
  const [result] = await pool.execute(
    `UPDATE studios
     SET studio_name = ?, address = ?, capacity = ?, latitude = ?, longitude = ?,
         boundary = ST_GeomFromText(?, 4326, 'axis-order=long-lat'),
         location = ST_GeomFromText(?, 4326, 'axis-order=long-lat')
     WHERE studio_id = ?`,
    [data.studio_name, data.address, data.capacity, data.latitude, data.longitude, geometry.boundary, geometry.location, id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Studio tidak ditemukan.');
  res.json({ message: 'Studio diperbarui.' });
}));

router.delete('/studios/:studioId', asyncRoute(async (req, res) => {
  const [result] = await pool.execute('UPDATE studios SET is_active = 0 WHERE studio_id = ?', [idFrom(req.params.studioId)]);
  if (!result.affectedRows) throw new HttpError(404, 'Studio tidak ditemukan.');
  res.json({ message: 'Studio dinonaktifkan.' });
}));

router.get('/schedules', asyncRoute(async (_req, res) => {
  const [schedules] = await pool.query(
    `SELECT s.*, c.class_name, i.full_name AS instructor_name, st.studio_name
     FROM schedules s
     JOIN classes c ON c.class_id = s.class_id
     JOIN instructors i ON i.instructor_id = s.instructor_id
     JOIN studios st ON st.studio_id = s.studio_id
     ORDER BY s.schedule_date DESC, s.session_time`
  );
  res.json({ schedules });
}));

async function saveSchedule(connection, data, scheduleId = null) {
  const [[studio]] = await connection.execute(
    'SELECT capacity FROM studios WHERE studio_id = ? AND is_active = 1',
    [data.studio_id]
  );
  if (!studio) throw new HttpError(400, 'Studio tidak aktif atau tidak ditemukan.');
  if (data.slot_capacity > studio.capacity) {
    throw new HttpError(400, 'Kuota jadwal tidak boleh melebihi kapasitas studio.');
  }
  const [[instructor]] = await connection.execute(
    'SELECT instructor_id FROM instructors WHERE instructor_id = ? AND is_active = 1',
    [data.instructor_id]
  );
  const [[course]] = await connection.execute(
    'SELECT class_id FROM classes WHERE class_id = ? AND is_active = 1 AND terms_and_conditions <> \'\'',
    [data.class_id]
  );
  if (!instructor || !course) throw new HttpError(400, 'Kelas dengan syarat terisi dan instruktur aktif wajib dipilih.');

  if (!scheduleId) {
    const [result] = await connection.execute(
      `INSERT INTO schedules
       (studio_id, instructor_id, class_id, schedule_date, session_time, slot_remaining, slot_capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.studio_id, data.instructor_id, data.class_id, data.schedule_date, data.session_time, data.slot_capacity, data.slot_capacity]
    );
    return result.insertId;
  }

  const [[current]] = await connection.execute(
    `SELECT slot_remaining, slot_capacity, class_id, instructor_id, studio_id,
            schedule_date, session_time
     FROM schedules WHERE schedule_id = ? FOR UPDATE`,
    [scheduleId]
  );
  if (!current) throw new HttpError(404, 'Jadwal tidak ditemukan.');
  const [[bookingCount]] = await connection.execute(
    'SELECT COUNT(*) AS count FROM registrations WHERE schedule_id = ?',
    [scheduleId]
  );
  const changedSession = Number(current.class_id) !== data.class_id
    || Number(current.instructor_id) !== data.instructor_id
    || Number(current.studio_id) !== data.studio_id
    || String(current.schedule_date).slice(0, 10) !== data.schedule_date
    || String(current.session_time).slice(0, 5) !== data.session_time.slice(0, 5);
  if (bookingCount.count > 0 && changedSession) {
    throw new HttpError(409, 'Jadwal dengan riwayat pendaftaran tidak dapat dipindah atau diubah. Buat jadwal baru.');
  }
  const reserved = current.slot_capacity - current.slot_remaining;
  if (data.slot_capacity < reserved) {
    throw new HttpError(409, 'Kuota baru lebih kecil dari jumlah slot yang sudah terpakai.');
  }
  await connection.execute(
    `UPDATE schedules
     SET studio_id = ?, instructor_id = ?, class_id = ?, schedule_date = ?,
         session_time = ?, slot_capacity = ?, slot_remaining = ?
     WHERE schedule_id = ?`,
    [data.studio_id, data.instructor_id, data.class_id, data.schedule_date, data.session_time,
      data.slot_capacity, data.slot_capacity - reserved, scheduleId]
  );
  return scheduleId;
}

router.post('/schedules', asyncRoute(async (req, res) => {
  const data = scheduleInput.parse(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const scheduleId = await saveSchedule(connection, data);
    await connection.commit();
    res.status(201).json({ schedule_id: scheduleId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.put('/schedules/:scheduleId', asyncRoute(async (req, res) => {
  const data = scheduleInput.parse(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await saveSchedule(connection, data, idFrom(req.params.scheduleId));
    await connection.commit();
    res.json({ message: 'Jadwal diperbarui.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete('/schedules/:scheduleId', asyncRoute(async (req, res) => {
  const [result] = await pool.execute(
    'UPDATE schedules SET is_active = 0 WHERE schedule_id = ?',
    [idFrom(req.params.scheduleId)]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Jadwal tidak ditemukan.');
  res.json({ message: 'Jadwal dinonaktifkan; pemesanan yang sudah ada tetap tercatat.' });
}));

router.get('/bookings', asyncRoute(async (_req, res) => {
  const [bookings] = await pool.query(
    `SELECT r.registration_id, r.total_amount, r.payment_status, r.booking_status,
            r.registered_at, r.expires_at, u.full_name AS participant_name,
            u.email, u.phone_number,
            r.class_name_snapshot AS class_name,
            r.schedule_date_snapshot AS schedule_date,
            r.session_time_snapshot AS session_time,
            r.studio_name_snapshot AS studio_name,
            r.instructor_name_snapshot AS instructor_name,
            p.payment_id, p.payment_status AS proof_status, p.submitted_at,
            p.review_note
     FROM registrations r
     JOIN users u ON u.user_id = r.user_id
     JOIN schedules s ON s.schedule_id = r.schedule_id
     JOIN classes c ON c.class_id = s.class_id
     JOIN studios st ON st.studio_id = s.studio_id
     JOIN instructors i ON i.instructor_id = s.instructor_id
     LEFT JOIN payments p ON p.registration_id = r.registration_id
     ORDER BY r.registered_at DESC`
  );
  res.json({ bookings });
}));

router.get('/payments/:paymentId/proof', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT proof_path FROM payments WHERE payment_id = ?',
    [idFrom(req.params.paymentId)]
  );
  if (!rows.length) throw new HttpError(404, 'Bukti pembayaran tidak ditemukan.');
  const filename = path.basename(rows[0].proof_path);
  res.sendFile(getProofPath(filename), (error) => {
    if (error && !res.headersSent) res.status(error.statusCode || 404).json({ error: 'Bukti pembayaran tidak ditemukan.' });
  });
}));

router.post('/payments/:paymentId/review', asyncRoute(async (req, res) => {
  const paymentId = idFrom(req.params.paymentId);
  const decision = z.object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).optional().default('')
  }).parse(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [initialRows] = await connection.execute(
      `SELECT r.schedule_id FROM payments p
       JOIN registrations r ON r.registration_id = p.registration_id
       WHERE p.payment_id = ?`,
      [paymentId]
    );
    if (!initialRows.length) throw new HttpError(404, 'Pembayaran tidak ditemukan.');
    const scheduleId = initialRows[0].schedule_id;
    await connection.execute(
      'SELECT schedule_id FROM schedules WHERE schedule_id = ? FOR UPDATE',
      [scheduleId]
    );
    const [rows] = await connection.execute(
      `SELECT p.payment_status, p.registration_id, r.booking_status
       FROM payments p
       JOIN registrations r ON r.registration_id = p.registration_id
       WHERE p.payment_id = ? FOR UPDATE`,
      [paymentId]
    );
    const payment = rows[0];
    if (payment.payment_status !== 'pending_review' || payment.booking_status !== 'under_review') {
      throw new HttpError(409, 'Pembayaran ini sudah diproses.');
    }

    const approved = decision.decision === 'approve';
    await connection.execute(
      `UPDATE payments SET payment_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
       WHERE payment_id = ?`,
      [approved ? 'approved' : 'rejected', decision.note || null, req.user.user_id, paymentId]
    );
    await connection.execute(
      `UPDATE registrations SET booking_status = ?, payment_status = ?
       WHERE registration_id = ?`,
      [approved ? 'confirmed' : 'payment_rejected', approved ? 'paid' : 'rejected', payment.registration_id]
    );
    if (!approved) {
      await connection.execute(
        'UPDATE schedules SET slot_remaining = LEAST(slot_capacity, slot_remaining + 1) WHERE schedule_id = ?',
        [scheduleId]
      );
    }
    await connection.commit();
    res.json({ message: approved ? 'Pembayaran disetujui; pendaftaran dikonfirmasi.' : 'Pembayaran ditolak; slot jadwal dilepas.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

export default router;
