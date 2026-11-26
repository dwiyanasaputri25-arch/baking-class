USE baking_classdwys;

ALTER TABLE users
  MODIFY COLUMN phone_number VARCHAR(20) NOT NULL,
  ADD COLUMN email VARCHAR(254) NULL AFTER full_name,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD UNIQUE KEY uq_users_email (email);

ALTER TABLE classes
  ADD COLUMN terms_and_conditions TEXT NULL,
  ADD COLUMN image_url VARCHAR(500) NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

UPDATE classes SET terms_and_conditions = '' WHERE terms_and_conditions IS NULL;

ALTER TABLE classes
  MODIFY COLUMN terms_and_conditions TEXT NOT NULL;

ALTER TABLE instructors
  MODIFY COLUMN phone_number VARCHAR(20) NOT NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE studios
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(10,7) NULL;

UPDATE studios
SET latitude = ST_Latitude(location),
    longitude = ST_Longitude(location);

ALTER TABLE schedules
  ADD COLUMN slot_capacity INT NOT NULL DEFAULT 1,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

UPDATE schedules s
JOIN studios st ON st.studio_id = s.studio_id
SET s.slot_capacity = GREATEST(st.capacity, s.slot_remaining),
    s.slot_remaining = LEAST(s.slot_remaining, GREATEST(st.capacity, s.slot_remaining));

ALTER TABLE registrations
  ADD COLUMN booking_status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  ADD COLUMN terms_snapshot TEXT NULL,
  ADD COLUMN terms_agreed_at DATETIME NULL,
  ADD COLUMN expires_at DATETIME NULL,
  ADD COLUMN class_name_snapshot VARCHAR(100) NULL,
  ADD COLUMN class_category_snapshot VARCHAR(50) NULL,
  ADD COLUMN schedule_date_snapshot DATE NULL,
  ADD COLUMN session_time_snapshot TIME NULL,
  ADD COLUMN studio_name_snapshot VARCHAR(100) NULL,
  ADD COLUMN studio_address_snapshot TEXT NULL,
  ADD COLUMN instructor_name_snapshot VARCHAR(100) NULL,
  ADD KEY idx_registrations_expiry (booking_status, expires_at),
  ADD KEY idx_registrations_schedule_status (schedule_id, booking_status);

UPDATE registrations r
JOIN schedules s ON s.schedule_id = r.schedule_id
JOIN classes c ON c.class_id = s.class_id
JOIN studios st ON st.studio_id = s.studio_id
JOIN instructors i ON i.instructor_id = s.instructor_id
SET r.class_name_snapshot = c.class_name,
    r.class_category_snapshot = c.category,
    r.schedule_date_snapshot = s.schedule_date,
    r.session_time_snapshot = s.session_time,
    r.studio_name_snapshot = st.studio_name,
    r.studio_address_snapshot = st.address,
    r.instructor_name_snapshot = i.full_name;

ALTER TABLE registrations
  MODIFY COLUMN class_name_snapshot VARCHAR(100) NOT NULL,
  MODIFY COLUMN class_category_snapshot VARCHAR(50) NOT NULL,
  MODIFY COLUMN schedule_date_snapshot DATE NOT NULL,
  MODIFY COLUMN session_time_snapshot TIME NOT NULL,
  MODIFY COLUMN studio_name_snapshot VARCHAR(100) NOT NULL,
  MODIFY COLUMN studio_address_snapshot TEXT NOT NULL,
  MODIFY COLUMN instructor_name_snapshot VARCHAR(100) NOT NULL;

UPDATE registrations
SET booking_status = CASE
      WHEN payment_status = 'paid' THEN 'confirmed'
      ELSE 'pending_payment'
    END,
    expires_at = CASE
      WHEN payment_status = 'paid' THEN NULL
      ELSE DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR)
    END;

CREATE TABLE payments (
  payment_id INT NOT NULL AUTO_INCREMENT,
  registration_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  proof_path VARCHAR(500) NOT NULL,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  review_note VARCHAR(500) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_registration (registration_id),
  KEY idx_payments_status (payment_status, submitted_at),
  CONSTRAINT fk_payments_registration FOREIGN KEY (registration_id)
    REFERENCES registrations (registration_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payments_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
