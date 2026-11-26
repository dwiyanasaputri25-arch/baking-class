import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPaymentExpired, isTermsAccepted, normalizePhone } from '../src/utils/booking-rules.js';

test('only unpaid bookings expire at or after their deadline', () => {
  const now = new Date('2026-11-25T10:00:00.000Z');
  assert.equal(hasPaymentExpired({
    booking_status: 'pending_payment',
    expires_at: new Date('2026-11-25T10:00:00.000Z')
  }, now), true);
  assert.equal(hasPaymentExpired({
    booking_status: 'pending_payment',
    expires_at: new Date('2026-11-25T10:00:01.000Z')
  }, now), false);
  assert.equal(hasPaymentExpired({
    booking_status: 'under_review',
    expires_at: new Date('2026-11-25T09:00:00.000Z')
  }, now), false);
});

test('terms must be explicitly accepted and phone values are normalized', () => {
  assert.equal(isTermsAccepted(true), true);
  assert.equal(isTermsAccepted('true'), false);
  assert.equal(normalizePhone(' 0812-3456 7890 '), '081234567890');
});
