import { Router } from 'express';
import fs from 'node:fs/promises';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { proofUpload } from '../middleware/upload.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { isTermsAccepted } from '../utils/booking-rules.js';

const router = Router();
router.use(authenticate);

router.get('/mine', asyncRoute(async (req, res) => {
  const [bookings] = await pool.execute(
    `SELECT r.registration_id, r.total_amount, r.payment_status, r.booking_status,
            r.registered_at, r.expires_at,
            r.class_name_snapshot AS class_name,
            r.class_category_snapshot AS category,
            r.schedule_date_snapshot AS schedule_date,
            r.session_time_snapshot AS session_time,
            r.studio_name_snapshot AS studio_name,
            r.studio_address_snapshot AS studio_address,
            r.instructor_name_snapshot AS instructor_name,
            p.payment_id, p.payment_status AS proof_status, p.submitted_at
     FROM registrations r
     JOIN schedules s ON s.schedule_id = r.schedule_id
     JOIN classes c ON c.class_id = s.class_id
     JOIN studios st ON st.studio_id = s.studio_id
     JOIN instructors i ON i.instructor_id = s.instructor_id
     LEFT JOIN payments p ON p.registration_id = r.registration_id
     WHERE r.user_id = ?
     ORDER BY r.registered_at DESC`,
    [req.user.user_id]
  );
  res.json({ bookings });
}));

router.post('/', asyncRoute(async (req, res) => {
  const classId = Number(req.body.class_id);
  const scheduleId = Number(req.body.schedule_id);
  if (!Number.isInteger(classId) || !Number.isInteger(scheduleId) || !isTermsAccepted(req.body.accepted_terms)) {
    throw new HttpError(400, 'Pilih jadwal dan setujui syarat kelas sebelum mengonfirmasi pesanan.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [scheduleRows] = await connection.execute(
      `SELECT s.schedule_id, s.class_id, s.slot_remaining, s.slot_capacity,
              s.schedule_date, s.session_time, c.class_name, c.category, c.price,
              st.studio_name, st.address AS studio_address, i.full_name AS instructor_name,
              c.terms_and_conditions
       FROM schedules s
       JOIN classes c ON c.class_id = s.class_id AND c.is_active = 1
       JOIN studios st ON st.studio_id = s.studio_id
       JOIN instructors i ON i.instructor_id = s.instructor_id
       WHERE s.schedule_id = ? AND s.class_id = ? AND s.is_active = 1
         AND TIMESTAMP(s.schedule_date, s.session_time) > UTC_TIMESTAMP() + INTERVAL 7 HOUR
       FOR UPDATE`,
      [scheduleId, classId]
    );
    const schedule = scheduleRows[0];
    if (!schedule) throw new HttpError(409, 'Jadwal tidak tersedia atau sudah berlalu.');
    if (!schedule.terms_and_conditions.trim()) {
      throw new HttpError(409, 'Syarat kelas belum tersedia. Silakan hubungi admin.');
    }

    const [expired] = await connection.execute(
      `UPDATE registrations
       SET booking_status = 'expired', payment_status = 'expired'
       WHERE schedule_id = ? AND booking_status = 'pending_payment'
         AND expires_at <= UTC_TIMESTAMP()`,
      [scheduleId]
    );
    const availableSlots = schedule.slot_remaining + expired.affectedRows;
    if (expired.affectedRows > 0) {
      await connection.execute(
        'UPDATE schedules SET slot_remaining = LEAST(slot_capacity, slot_remaining + ?) WHERE schedule_id = ?',
        [expired.affectedRows, scheduleId]
      );
    }
    if (availableSlots < 1) throw new HttpError(409, 'Kuota jadwal ini sudah penuh.');

    await connection.execute(
      'UPDATE schedules SET slot_remaining = slot_remaining - 1 WHERE schedule_id = ?',
      [scheduleId]
    );
    const [result] = await connection.execute(
      `INSERT INTO registrations
         (user_id, schedule_id, payment_status, booking_status, total_amount,
          terms_snapshot, terms_agreed_at, expires_at, class_name_snapshot,
          class_category_snapshot, schedule_date_snapshot, session_time_snapshot,
          studio_name_snapshot, studio_address_snapshot, instructor_name_snapshot)
       VALUES (?, ?, 'pending', 'pending_payment', ?, ?, UTC_TIMESTAMP(),
               DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR), ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id, scheduleId, schedule.price, schedule.terms_and_conditions,
        schedule.class_name, schedule.category, schedule.schedule_date, schedule.session_time,
        schedule.studio_name, schedule.studio_address, schedule.instructor_name
      ]
    );
    const [[savedBooking]] = await connection.execute(
      'SELECT expires_at FROM registrations WHERE registration_id = ?',
      [result.insertId]
    );
    await connection.commit();
    res.status(201).json({
      booking: {
        registration_id: result.insertId,
        class_name: schedule.class_name,
        schedule_date: schedule.schedule_date,
        session_time: schedule.session_time,
        total_amount: schedule.price,
        booking_status: 'pending_payment',
        payment_status: 'pending',
        expires_at: savedBooking.expires_at
      }
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post('/:registrationId/cancel', asyncRoute(async (req, res) => {
  const registrationId = Number(req.params.registrationId);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT schedule_id FROM registrations WHERE registration_id = ? AND user_id = ?',
      [registrationId, req.user.user_id]
    );
    if (!rows.length) throw new HttpError(404, 'Pemesanan tidak ditemukan.');
    const scheduleId = rows[0].schedule_id;
    const [[schedule]] = await connection.execute(
      'SELECT slot_remaining, slot_capacity FROM schedules WHERE schedule_id = ? FOR UPDATE',
      [scheduleId]
    );
    const [updated] = await connection.execute(
      `UPDATE registrations SET booking_status = 'cancelled', payment_status = 'cancelled'
       WHERE registration_id = ? AND user_id = ? AND booking_status = 'pending_payment'`,
      [registrationId, req.user.user_id]
    );
    if (!updated.affectedRows) throw new HttpError(409, 'Pesanan ini tidak dapat dibatalkan.');
    await connection.execute(
      'UPDATE schedules SET slot_remaining = LEAST(slot_capacity, slot_remaining + 1) WHERE schedule_id = ?',
      [scheduleId]
    );
    await connection.commit();
    res.json({ message: 'Pesanan dibatalkan dan kuota dikembalikan.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post('/:registrationId/payment-proof', proofUpload.single('proof'), asyncRoute(async (req, res) => {
  const registrationId = Number(req.params.registrationId);
  if (!req.file) throw new HttpError(400, 'Pilih gambar bukti transfer terlebih dahulu.');

  const connection = await pool.getConnection();
  let transactionOpen = true;
  let proofSaved = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT r.registration_id, r.user_id, r.schedule_id, r.total_amount,
              r.booking_status, r.expires_at
       FROM registrations r
       WHERE r.registration_id = ? AND r.user_id = ?`,
      [registrationId, req.user.user_id]
    );
    const booking = rows[0];
    if (!booking) throw new HttpError(404, 'Pemesanan tidak ditemukan.');

    await connection.execute(
      'SELECT schedule_id FROM schedules WHERE schedule_id = ? FOR UPDATE',
      [booking.schedule_id]
    );
    const [lockedRows] = await connection.execute(
      `SELECT booking_status, expires_at FROM registrations
       WHERE registration_id = ? FOR UPDATE`,
      [registrationId]
    );
    const lockedBooking = lockedRows[0];
    if (lockedBooking.booking_status !== 'pending_payment') {
      throw new HttpError(409, 'Bukti pembayaran hanya dapat diunggah untuk pesanan yang menunggu pembayaran.');
    }
    const [expired] = await connection.execute(
      `UPDATE registrations
       SET booking_status = 'expired', payment_status = 'expired'
       WHERE registration_id = ? AND expires_at <= UTC_TIMESTAMP()`,
      [registrationId]
    );
    if (expired.affectedRows) {
      await connection.execute(
        'UPDATE schedules SET slot_remaining = LEAST(slot_capacity, slot_remaining + 1) WHERE schedule_id = ?',
        [booking.schedule_id]
      );
      await connection.commit();
      transactionOpen = false;
      throw new HttpError(410, 'Batas 12 jam telah lewat. Slot dilepas; silakan pesan jadwal kembali.');
    }
    const signature = await fs.readFile(req.file.path);
    const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = signature.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    const isWebp = signature.subarray(0, 4).toString() === 'RIFF'
      && signature.subarray(8, 12).toString() === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      throw new HttpError(400, 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.');
    }
    await connection.execute(
      `INSERT INTO payments (registration_id, amount, proof_path, payment_status)
       VALUES (?, ?, ?, 'pending_review')`,
      [registrationId, booking.total_amount, req.file.filename]
    );
    await connection.execute(
      `UPDATE registrations SET booking_status = 'under_review', payment_status = 'pending_review',
       expires_at = NULL WHERE registration_id = ?`,
      [registrationId]
    );
    await connection.commit();
    transactionOpen = false;
    proofSaved = true;
    res.status(201).json({ message: 'Bukti diterima. Pesanan menunggu verifikasi admin.' });
  } catch (error) {
    if (transactionOpen) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    if (!proofSaved) await fs.unlink(req.file.path).catch((error) => {
      if (error.code !== 'ENOENT') console.error('Failed to remove unused proof:', error);
    });
  }
}));

export default router;
