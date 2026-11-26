import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { api, dateLabel, money, timeLabel } from '../api.js';

export default function CourseDetail({ classId, user, onRequireAuth, onBack }) {
  const [course, setCourse] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [scheduleId, setScheduleId] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [step, setStep] = useState('choose');
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/classes/${classId}`)
      .then((result) => {
        if (!active) return;
        setCourse(result.class);
        setSchedules(result.schedules);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId]);

  const selectedSchedule = schedules.find((item) => String(item.schedule_id) === String(scheduleId));

  async function confirmBooking() {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const settings = await api('/settings/payment');
      if (!settings.configured) {
        setPayment(settings);
        setError('Admin belum melengkapi rekening transfer. Pemesanan belum dapat dibayar; silakan hubungi admin.');
        return;
      }
      const result = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          class_id: course.class_id,
          schedule_id: Number(scheduleId),
          accepted_terms: acceptedTerms
        })
      });
      setBooking(result.booking);
      setPayment(settings);
      setStep('payment');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProof(event) {
    event.preventDefault();
    if (!proof) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('proof', proof);
      const result = await api(`/bookings/${booking.registration_id}/payment-proof`, {
        method: 'POST',
        body: form
      });
      setMessage(result.message);
      setStep('sent');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageMessage text="Menyiapkan detail kelas…" />;
  if (error && !course) return <PageMessage text={error} onBack={onBack} />;
  if (!course) return null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
      <button onClick={onBack} className="mb-7 inline-flex items-center gap-2 text-sm font-extrabold text-cocoa/60 hover:text-rose">
        <ArrowLeft size={17} /> Kembali ke kelas
      </button>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush via-orange-50 to-amber-100 sm:min-h-80">
            {course.image_url ? <img src={course.image_url} alt={course.class_name} className="absolute inset-0 h-full w-full object-cover" /> : <span className="text-8xl" aria-hidden="true">🧁</span>}
            <span className="absolute left-5 top-5 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-rose">{course.category}</span>
          </div>
          <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose">Kelas pilihanmu</p>
              <h1 className="mt-2 font-display text-4xl leading-tight text-cocoa sm:text-5xl">{course.class_name}</h1>
            </div>
            <p className="rounded-full bg-blush/70 px-4 py-2 text-base font-extrabold text-rose">{money(course.price)}</p>
          </div>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cocoa/70">{course.description}</p>

          <section className="mt-8 rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-rose"><ShieldCheck size={20} /></span>
              <div>
                <h2 className="font-display text-2xl text-cocoa">Syarat & ketentuan kelas</h2>
                <p className="mt-1 text-sm leading-6 text-cocoa/55">Baca terlebih dahulu. Persetujuan Anda akan dicatat bersama pemesanan.</p>
              </div>
            </div>
            {course.terms_and_conditions?.trim() ? (
              <div className="terms-copy mt-5 whitespace-pre-line rounded-2xl bg-cream p-5 text-sm leading-7 text-cocoa/80">
                {course.terms_and_conditions}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Syarat kelas ini belum tersedia. Silakan hubungi admin sebelum melakukan pemesanan.</p>
            )}
            <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm font-semibold leading-6 ${course.terms_and_conditions?.trim() ? 'text-cocoa/80' : 'cursor-not-allowed text-cocoa/40'}`}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                disabled={!course.terms_and_conditions?.trim()}
                className="mt-1 h-4 w-4 accent-rose"
              />
              <span>Saya telah membaca dan menyetujui syarat & ketentuan kelas ini.</span>
            </label>
          </section>
        </section>

        <aside className="space-y-5">
          {step === 'choose' && (
            <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose">Langkah 1 dari 3</p>
              <h2 className="mt-2 font-display text-2xl text-cocoa">Pilih jadwal kelas</h2>
              <div className="mt-5 space-y-3">
                {schedules.length ? schedules.map((item) => (
                  <label key={item.schedule_id} className={`block cursor-pointer rounded-2xl border p-4 transition ${String(scheduleId) === String(item.schedule_id) ? 'border-rose bg-blush/30' : 'border-cocoa/10 hover:border-caramel/50'}`}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="schedule" value={item.schedule_id} checked={String(scheduleId) === String(item.schedule_id)} onChange={(event) => setScheduleId(event.target.value)} className="mt-1 accent-rose" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-extrabold text-cocoa">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays size={16} className="text-rose" /> {dateLabel(item.schedule_date)}</span>
                          <span className="inline-flex items-center gap-1.5"><Clock3 size={15} className="text-rose" /> {timeLabel(item.session_time)} WIB</span>
                        </span>
                        <span className="mt-2 block text-sm text-cocoa/60">{item.studio_name} · {item.studio_address}</span>
                        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-caramel"><UserRound size={14} /> {item.instructor_name} · sisa {item.slot_remaining} kursi</span>
                      </span>
                    </span>
                  </label>
                )) : <p className="rounded-xl bg-cream p-4 text-sm leading-6 text-cocoa/60">Belum ada jadwal mendatang. Silakan cek kembali nanti.</p>}
              </div>
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              <button
                onClick={() => { setError(''); setStep('review'); }}
                disabled={!selectedSchedule || !acceptedTerms}
                className="button-primary mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
              >
                Tinjau pemesanan <Check size={17} />
              </button>
            </section>
          )}

          {step === 'review' && selectedSchedule && (
            <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose">Langkah 2 dari 3</p>
              <h2 className="mt-2 font-display text-2xl text-cocoa">Periksa pesananmu</h2>
              <div className="mt-5 space-y-4 rounded-2xl bg-cream p-5 text-sm">
                <ReviewRow label="Kelas" value={course.class_name} />
                <ReviewRow label="Tanggal" value={dateLabel(selectedSchedule.schedule_date)} />
                <ReviewRow label="Jam mulai" value={`${timeLabel(selectedSchedule.session_time)} WIB`} />
                <ReviewRow label="Studio" value={selectedSchedule.studio_name} />
                <ReviewRow label="Nomor kontak" value={user?.phone_number || 'Masuk atau daftar untuk melanjutkan'} />
                <div className="border-t border-cocoa/10 pt-4">
                  <ReviewRow label="Total pembayaran" value={money(course.price)} prominent />
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Setelah Anda mengonfirmasi, satu kursi ditahan selama 12 jam. Jika bukti transfer belum diunggah dalam waktu tersebut, kursi akan tersedia kembali.</p>
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => setStep('choose')} className="button-outline justify-center">Ubah pilihan</button>
                <button onClick={confirmBooking} disabled={submitting} className="button-primary flex-1 justify-center">
                  {submitting ? 'Membuat pesanan…' : 'Konfirmasi & lanjut bayar'}
                </button>
              </div>
            </section>
          )}

          {step === 'payment' && booking && (
            <PaymentCard
              booking={booking}
              payment={payment}
              proof={proof}
              setProof={setProof}
              submitting={submitting}
              error={error}
              onSubmit={submitProof}
            />
          )}

          {step === 'sent' && (
            <section className="rounded-[1.5rem] border border-emerald-200 bg-white p-7 text-center shadow-card">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck size={27} /></span>
              <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Langkah 3 dari 3</p>
              <h2 className="mt-2 font-display text-2xl text-cocoa">Bukti pembayaran terkirim</h2>
              <p className="mt-3 text-sm leading-6 text-cocoa/65">{message} Setelah admin menyetujui pembayaran, jadwal dan jam mulai kelas akan muncul di pemesanan Anda.</p>
              <button onClick={onBack} className="button-primary mt-6 justify-center">Kembali ke kelas</button>
            </section>
          )}
          {step === 'choose' && !user && (
            <p className="rounded-2xl bg-blush/50 p-4 text-sm leading-6 text-cocoa/70">Anda dapat melihat kelas tanpa akun. Untuk memesan, daftar dengan email dan nomor telepon yang bisa dihubungi.</p>
          )}
        </aside>
      </div>
    </main>
  );
}

function PaymentCard({ booking, payment, proof, setProof, submitting, error, onSubmit }) {
  const deadline = booking.expires_at
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${booking.expires_at.replace(' ', 'T')}Z`))
    : '12 jam setelah pemesanan';
  return (
    <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose">Langkah 3 dari 3</p>
      <h2 className="mt-2 font-display text-2xl text-cocoa">Selesaikan pembayaran</h2>
      <p className="mt-2 text-sm leading-6 text-cocoa/65">Transfer sesuai jumlah berikut. Kursi Anda ditahan sampai <strong>{deadline} WIB</strong>.</p>
      {payment?.configured ? <div className="mt-5 rounded-2xl bg-cream p-5">
        <p className="text-sm font-bold text-cocoa/60">{payment?.bank_name || 'Transfer bank'}</p>
        <p className="mt-1 text-lg font-extrabold text-cocoa">{payment?.account_number || 'Informasi rekening belum diatur'}</p>
        <p className="mt-1 text-sm text-cocoa/65">a.n. {payment?.account_name || 'Hubungi admin untuk detail pembayaran'}</p>
        {payment.instructions && <p className="mt-3 border-t border-cocoa/10 pt-3 text-sm leading-6 text-cocoa/70">{payment.instructions}</p>}
        <p className="mt-4 border-t border-cocoa/10 pt-4 text-sm font-bold text-cocoa/70">Jumlah transfer</p>
        <p className="mt-1 text-2xl font-extrabold text-rose">{money(booking.total_amount)}</p>
      </div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Informasi rekening belum diatur oleh admin. Hubungi admin sebelum melakukan pembayaran.</p>}
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <label className="field-label">
          Unggah bukti transfer (JPG, PNG, atau WebP · maksimal 5 MB)
          <input className="file-input mt-2" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setProof(event.target.files?.[0] || null)} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={!proof || submitting || !payment?.configured} className="button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-45">
          {submitting ? 'Mengirim bukti…' : 'Kirim bukti untuk diverifikasi'}
        </button>
      </form>
      <p className="mt-4 text-xs leading-5 text-cocoa/50">Bukti pembayaran hanya dapat dilihat admin untuk proses verifikasi.</p>
    </section>
  );
}

function ReviewRow({ label, value, prominent = false }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${prominent ? 'text-base font-extrabold text-rose' : ''}`}>
      <span className="shrink-0 text-cocoa/55">{label}</span>
      <span className="text-right font-bold text-cocoa">{value}</span>
    </div>
  );
}

function PageMessage({ text, onBack }) {
  return (
    <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-16 text-center">
      <p className="rounded-2xl bg-white p-8 text-base font-semibold text-cocoa shadow-card">{text}</p>
      {onBack && <button onClick={onBack} className="button-primary mt-5 justify-center">Kembali</button>}
    </main>
  );
}
