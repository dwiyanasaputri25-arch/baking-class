export function hasPaymentExpired(booking, now = new Date()) {
  return booking.booking_status === 'pending_payment'
    && booking.expires_at !== null
    && new Date(booking.expires_at).getTime() <= now.getTime();
}

export function isTermsAccepted(acceptedTerms) {
  return acceptedTerms === true;
}

export function normalizePhone(phone) {
  return phone.trim().replace(/[^\d+]/g, '');
}
