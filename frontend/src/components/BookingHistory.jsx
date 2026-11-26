import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Upload, XCircle } from 'lucide-react';
import { api, dateLabel, money, timeLabel } from '../api.js';

const statusNames = {
  pending_payment: 'Menunggu pembayaran',
  under_review: 'Menunggu verifikasi',
  confirmed: 'Terkonfirmasi',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
  payment_rejected: 'Pembayaran ditolak'
};

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [proofs, setProofs] = useState({});
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const [result, settings] = await Promise.all([
        api('/bookings/mine'),
        api('/settings/payment').catch((requestError) => {
          setSettingsError(requestError.message);
          return null;
        })
      ]);
      setBookings(result.bookings);
      setPaymentSettings(settings);
      if (settings) setSettingsError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function uploadProof(event, registrationId) {
    event.preventDefault();
    const file = proofs[registrationId];
    if (!file) return;
    setBusyId(registrationId);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.append('proof', file);
      const result = await api(`/bookings/${registrationId}/payment-proof`, { method: 'POST', body: form });
      setNotice(result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(registrationId) {
    if (!window.confirm('Batalkan pemesanan ini? Slot akan kembali tersedia.')) return;
    setBusyId(registrationId);
    setError('');
    try {
      await api(`/bookings/${registrationId}/cancel`, { method: 'POST' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-5 py-12 lg:px-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-rose">Ruang pribadimu</p>
      <h1 className="mt-2 font-display text-4xl text-cocoa">Pemesanan saya</h1>
      <p className="mt-2 text-cocoa/60">Pantau status pembayaran dan jadwal kelas baking yang kamu pilih.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      {loading ? <p className="mt-8 text-cocoa/60">Memuat pemesanan…</p> : bookings.length ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {bookings.map((booking) => (
            <article key={booking.registration_id} className="rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose">{booking.category}</span>
                  <h2 className="mt-1 font-display text-2xl text-cocoa">{booking.class_name}</h2>
                </div>
                <StatusBadge status={booking.booking_status} />
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl bg-cream p-4 text-sm text-cocoa/75">
                <span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-rose" /> {dateLabel(booking.schedule_date)}</span>
                <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-rose" /> Mulai {timeLabel(booking.session_time)} WIB</span>
                <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-rose" /> {booking.studio_name} · {booking.instructor_name}</span>
                <span className="border-t border-cocoa/10 pt-3 font-extrabold text-cocoa">Total {money(booking.total_amount)}</span>
              </div>
              {booking.booking_status === 'confirmed' && (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">
                  Pembayaran telah dikonfirmasi. Jadwal dan jam mulai kelas di atas sudah terdaftar untukmu.
                </p>
              )}
              {booking.booking_status === 'pending_payment' && (
                <form className="mt-4 space-y-3" onSubmit={(event) => uploadProof(event, booking.registration_id)}>
                  <p className="text-sm leading-6 text-cocoa/60">Selesaikan transfer dan unggah bukti sebelum pesanan kedaluwarsa.</p>
                  {settingsError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{settingsError}</p>}
                  {paymentSettings?.configured ? (
                    <>
                      <div className="rounded-xl bg-cream p-4 text-sm leading-6 text-cocoa/75">
                        <p className="font-extrabold text-cocoa">{paymentSettings.bank_name} · {paymentSettings.account_number}</p>
                        <p>a.n. {paymentSettings.account_name}</p>
                        {paymentSettings.instructions && <p className="mt-2 border-t border-cocoa/10 pt-2">{paymentSettings.instructions}</p>}
                        {booking.expires_at && <p className="mt-2 font-bold text-rose">Bayar sebelum {deadlineLabel(booking.expires_at)} WIB</p>}
                        <p className="mt-1 font-extrabold text-cocoa">Jumlah: {money(booking.total_amount)}</p>
                      </div>
                      <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setProofs((current) => ({ ...current, [booking.registration_id]: event.target.files?.[0] || null }))} />
                      <button className="button-primary" disabled={busyId === booking.registration_id || !proofs[booking.registration_id]}>
                        <Upload size={16} /> {busyId === booking.registration_id ? 'Mengirim…' : 'Unggah bukti'}
                      </button>
                    </>
                  ) : (
                    <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Informasi rekening belum tersedia. Hubungi admin untuk menyelesaikan pembayaran.</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="button-outline" disabled={busyId === booking.registration_id} onClick={() => cancelBooking(booking.registration_id)}>
                      <XCircle size={16} /> Batalkan
                    </button>
                  </div>
                </form>
              )}
              {booking.booking_status === 'under_review' && (
                <p className="mt-4 text-sm leading-6 text-cocoa/60">Bukti sudah dikirim. Slot tetap ditahan selama admin melakukan verifikasi.</p>
              )}
              {booking.booking_status === 'payment_rejected' && (
                <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">Pembayaran belum dapat diverifikasi. Silakan buat pemesanan baru atau hubungi admin.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className="mt-8 rounded-[1.5rem] bg-white p-10 text-center shadow-card">
          <span className="text-5xl" aria-hidden="true">🍰</span>
          <h2 className="mt-4 font-display text-2xl text-cocoa">Belum ada pemesanan</h2>
          <p className="mt-2 text-sm text-cocoa/60">Kelas favoritmu menunggu untuk dipilih.</p>
        </section>
      )}
    </main>
  );
}

function deadlineLabel(value) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta'
  }).format(new Date(`${String(value).replace(' ', 'T')}Z`));
}

function StatusBadge({ status }) {
  const classes = status === 'confirmed'
    ? 'bg-emerald-50 text-emerald-800'
    : status === 'pending_payment' || status === 'under_review'
      ? 'bg-amber-50 text-amber-800'
      : 'bg-cocoa/5 text-cocoa/55';
  return <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${classes}`}>{statusNames[status] || status}</span>;
}
