import { pool } from '../db.js';

export async function expirePendingBookings() {
  const [schedules] = await pool.query(
    `SELECT DISTINCT schedule_id
     FROM registrations
     WHERE booking_status = 'pending_payment' AND expires_at <= UTC_TIMESTAMP()`
  );

  for (const { schedule_id: scheduleId } of schedules) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[schedule]] = await connection.execute(
        'SELECT schedule_id, slot_remaining, slot_capacity FROM schedules WHERE schedule_id = ? FOR UPDATE',
        [scheduleId]
      );
      if (!schedule) {
        await connection.commit();
        continue;
      }

      const [result] = await connection.execute(
        `UPDATE registrations
         SET booking_status = 'expired', payment_status = 'expired'
         WHERE schedule_id = ? AND booking_status = 'pending_payment'
           AND expires_at <= UTC_TIMESTAMP()`,
        [scheduleId]
      );
      if (result.affectedRows > 0) {
        await connection.execute(
          'UPDATE schedules SET slot_remaining = LEAST(slot_capacity, slot_remaining + ?) WHERE schedule_id = ?',
          [result.affectedRows, scheduleId]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
