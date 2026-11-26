import { Router } from 'express';
import { pool } from '../db.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { getPaymentSettings } from '../services/payment-settings.js';

const router = Router();

router.get('/settings/payment', asyncRoute(async (_req, res) => {
  res.json(await getPaymentSettings());
}));

router.get('/classes', asyncRoute(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 100);
  const category = String(req.query.category || '').trim().slice(0, 50);
  const [rows] = await pool.execute(
    `SELECT c.class_id, c.class_name, c.category, c.price, c.description,
            c.terms_and_conditions, c.image_url,
            MIN(CASE WHEN TIMESTAMP(s.schedule_date, s.session_time) > UTC_TIMESTAMP() + INTERVAL 7 HOUR
              THEN s.schedule_date END) AS next_schedule_date,
            COUNT(DISTINCT CASE WHEN TIMESTAMP(s.schedule_date, s.session_time) > UTC_TIMESTAMP() + INTERVAL 7 HOUR
              AND s.slot_remaining > 0 THEN s.schedule_id END) AS available_schedules
     FROM classes c
     LEFT JOIN schedules s ON s.class_id = c.class_id AND s.is_active = 1
     WHERE c.is_active = 1
       AND (? = '' OR c.class_name LIKE CONCAT('%', ?, '%') OR c.category LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR c.category = ?)
     GROUP BY c.class_id
     ORDER BY c.class_id DESC`,
    [search, search, search, category, category]
  );
  res.json({ classes: rows });
}));

router.get('/classes/:classId', asyncRoute(async (req, res) => {
  const classId = Number(req.params.classId);
  const [classes] = await pool.execute(
    `SELECT class_id, class_name, category, price, description,
            terms_and_conditions, image_url
     FROM classes WHERE class_id = ? AND is_active = 1`,
    [classId]
  );
  if (!classes.length) throw new HttpError(404, 'Kelas tidak ditemukan.');
  const [schedules] = await pool.execute(
    `SELECT s.schedule_id, s.schedule_date, s.session_time,
            s.slot_remaining, s.slot_capacity,
            i.full_name AS instructor_name,
            st.studio_name, st.address AS studio_address
     FROM schedules s
     JOIN instructors i ON i.instructor_id = s.instructor_id AND i.is_active = 1
     JOIN studios st ON st.studio_id = s.studio_id AND st.is_active = 1
     WHERE s.class_id = ? AND s.is_active = 1
       AND TIMESTAMP(s.schedule_date, s.session_time) > UTC_TIMESTAMP() + INTERVAL 7 HOUR
     ORDER BY s.schedule_date, s.session_time`,
    [classId]
  );
  res.json({ class: classes[0], schedules });
}));

export default router;
