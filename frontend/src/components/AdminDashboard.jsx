import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, CreditCard, MapPin, Pencil, Plus, Settings, Store, Users, X } from 'lucide-react';
import { API_URL, api, dateLabel, getToken, money, timeLabel } from '../api.js';

const emptyClass = { class_name: '', category: 'Basic', price: '', description: '', terms_and_conditions: '', image_url: '' };
const emptyInstructor = { full_name: '', expertise: '', phone_number: '' };
const emptyStudio = { studio_name: '', address: '', capacity: '', latitude: '', longitude: '' };
const emptySchedule = { class_id: '', instructor_id: '', studio_id: '', schedule_date: '', session_time: '', slot_capacity: '' };
const tabs = [
  { id: 'overview', label: 'Ringkasan', icon: ClipboardList },
  { id: 'classes', label: 'Kelas & syarat', icon: Store },
  { id: 'schedules', label: 'Jadwal & kuota', icon: CalendarIcon },
  { id: 'instructors', label: 'Instruktur', icon: Users },
  { id: 'studios', label: 'Studio', icon: MapPin },
  { id: 'payments', label: 'Pembayaran', icon: CreditCard },
  { id: 'settings', label: 'Rekening transfer', icon: Settings }
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({ classes: [], instructors: [], studios: [], schedules: [], bookings: [] });
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClass);
  const [reviewNote, setReviewNote] = useState('');
  const [proofPreview, setProofPreview] = useState(null);

  async function reload() {
    setError('');
    try {
      const [classes, instructors, studios, schedules, bookings, settings] = await Promise.all([
        api('/admin/classes'), api('/admin/instructors'), api('/admin/studios'),
        api('/admin/schedules'), api('/admin/bookings'), api('/admin/settings/payment')
      ]);
      setData({
        classes: classes.classes,
        instructors: instructors.instructors,
        studios: studios.studios,
        schedules: schedules.schedules,
        bookings: bookings.bookings
      });
      setPaymentSettings(settings);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const counts = useMemo(() => ({
    classes: data.classes.filter((item) => item.is_active).length,
    schedules: data.schedules.filter((item) => item.is_active).length,
    participants: new Set(data.bookings.map((item) => item.email)).size,
    pending: data.bookings.filter((item) => item.proof_status === 'pending_review').length
  }), [data]);

  function startCreate(type) {
    setEditing({ type, id: null });
    setForm(type === 'classes' ? emptyClass : type === 'instructors' ? emptyInstructor : type === 'studios' ? emptyStudio : emptySchedule);
    setError('');
    setNotice('');
  }

  function cancelEdit() {
    setEditing(null);
  }

  function startEdit(type, item) {
    const id = type === 'classes' ? item.class_id
      : type === 'instructors' ? item.instructor_id
        : type === 'studios' ? item.studio_id : item.schedule_id;
    setEditing({ type, id });
    setForm(type === 'classes'
      ? { class_name: item.class_name, category: item.category, price: item.price, description: item.description || '', terms_and_conditions: item.terms_and_conditions || '', image_url: item.image_url || '' }
      : type === 'instructors'
        ? { full_name: item.full_name, expertise: item.expertise, phone_number: item.phone_number }
        : type === 'studios'
          ? { studio_name: item.studio_name, address: item.address, capacity: item.capacity, latitude: item.latitude ?? '', longitude: item.longitude ?? '' }
          : { class_id: item.class_id, instructor_id: item.instructor_id, studio_id: item.studio_id, schedule_date: String(item.schedule_date).slice(0, 10), session_time: String(item.session_time).slice(0, 5), slot_capacity: item.slot_capacity }
    );
    setError('');
    setNotice('');
  }

  async function saveForm(event) {
    event.preventDefault();
    const type = editing.type;
    const base = type === 'classes' ? 'classes'
      : type === 'instructors' ? 'instructors'
        : type === 'studios' ? 'studios' : 'schedules';
    const payload = { ...form };
    if (type === 'schedules' && payload.session_time.length === 5) payload.session_time += ':00';
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/admin/${base}${editing.id ? `/${editing.id}` : ''}`, {
        method: editing.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      setNotice(editing.id ? 'Perubahan berhasil disimpan.' : 'Data baru berhasil ditambahkan.');
      setEditing(null);
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(type, item) {
    const id = item.class_id || item.instructor_id || item.studio_id || item.schedule_id;
    if (!window.confirm('Nonaktifkan data ini? Riwayat yang sudah ada tetap tersimpan.')) return;
    const base = type === 'classes' ? 'classes'
      : type === 'instructors' ? 'instructors'
        : type === 'studios' ? 'studios' : 'schedules';
    setError('');
    try {
      await api(`/admin/${base}/${id}`, { method: 'DELETE' });
      setNotice('Data berhasil dinonaktifkan.');
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function reviewPayment(paymentId, decision) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api(`/admin/payments/${paymentId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: reviewNote })
      });
      setNotice(result.message);
      setReviewNote('');
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePaymentSettings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/admin/settings/payment', {
        method: 'PUT',
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      setNotice(result.message);
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function openProof(paymentId) {
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/payments/${paymentId}/proof`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Bukti tidak dapat dibuka.');
      }
      const url = URL.createObjectURL(await response.blob());
      setProofPreview(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function closeProof() {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-rose">Ruang pengelola</p>
          <h1 className="mt-2 font-display text-4xl text-cocoa">Dashboard admin</h1>
          <p className="mt-2 text-sm text-cocoa/60">Kelola kelas, jadwal, kuota, peserta, dan verifikasi transfer.</p>
        </div>
        <button onClick={reload} className="button-outline">Muat ulang data</button>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setEditing(null); }} className={`admin-tab ${tab === id ? 'admin-tab-active' : ''}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      {loading ? <p className="mt-8 text-cocoa/60">Memuat dashboard…</p> : (
        <section className="mt-5">
          {tab === 'overview' && <Overview counts={counts} bookings={data.bookings} onTab={setTab} />}
          {tab === 'classes' && <ClassesPanel classes={data.classes} editing={editing} form={form} setForm={setForm} onCreate={() => startCreate('classes')} onCancel={cancelEdit} onEdit={(item) => startEdit('classes', item)} onDeactivate={(item) => deactivate('classes', item)} onSave={saveForm} busy={busy} />}
          {tab === 'instructors' && <InstructorsPanel instructors={data.instructors} editing={editing} form={form} setForm={setForm} onCreate={() => startCreate('instructors')} onCancel={cancelEdit} onEdit={(item) => startEdit('instructors', item)} onDeactivate={(item) => deactivate('instructors', item)} onSave={saveForm} busy={busy} />}
          {tab === 'studios' && <StudiosPanel studios={data.studios} editing={editing} form={form} setForm={setForm} onCreate={() => startCreate('studios')} onCancel={cancelEdit} onEdit={(item) => startEdit('studios', item)} onDeactivate={(item) => deactivate('studios', item)} onSave={saveForm} busy={busy} />}
          {tab === 'schedules' && <SchedulesPanel schedules={data.schedules} classes={data.classes} instructors={data.instructors} studios={data.studios} editing={editing} form={form} setForm={setForm} onCreate={() => startCreate('schedules')} onCancel={cancelEdit} onEdit={(item) => startEdit('schedules', item)} onDeactivate={(item) => deactivate('schedules', item)} onSave={saveForm} busy={busy} />}
          {tab === 'payments' && <PaymentsPanel bookings={data.bookings} note={reviewNote} setNote={setReviewNote} onReview={reviewPayment} onProof={openProof} busy={busy} />}
          {tab === 'settings' && <PaymentSettingsPanel settings={paymentSettings} onSave={savePaymentSettings} busy={busy} />}
        </section>
      )}
      {proofPreview && <ProofModal src={proofPreview} onClose={closeProof} />}
    </main>
  );
}

function Overview({ counts, bookings, onTab }) {
  const cards = [
    { label: 'Kelas aktif', value: counts.classes, icon: Store },
    { label: 'Jadwal aktif', value: counts.schedules, icon: CalendarIcon },
    { label: 'Peserta terdaftar', value: counts.participants, icon: Users },
    { label: 'Perlu verifikasi', value: counts.pending, icon: CreditCard }
  ];
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-cocoa/10 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-cocoa/55">{label}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-rose"><Icon size={18} /></span>
            </div>
            <p className="mt-3 font-display text-4xl text-cocoa">{value}</p>
          </article>
        ))}
      </div>
      <article className="mt-6 rounded-[1.5rem] border border-cocoa/10 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-2xl text-cocoa">Pemesanan terbaru</h2><p className="mt-1 text-sm text-cocoa/55">Peserta, kontak, jadwal, dan status transaksi.</p></div>
          <button className="button-outline" onClick={() => onTab('payments')}>Buka pembayaran</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <BookingTable bookings={bookings.slice(0, 6)} />
        </div>
      </article>
    </div>
  );
}

function ClassesPanel({ classes, editing, form, setForm, onCreate, onCancel, onEdit, onDeactivate, onSave, busy }) {
  return (
    <ManagementPanel title="Kelas dan syarat" description="Syarat & ketentuan kelas ditampilkan sebelum peserta memilih jadwal." editing={editing?.type === 'classes'} onCreate={onCreate} onSave={onSave} busy={busy}>
      {editing?.type === 'classes' && (
        <FormGrid onSubmit={onSave} busy={busy}>
          <Field label="Nama kelas"><input required minLength={3} maxLength={100} value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} /></Field>
          <Field label="Kategori / tingkat"><input required maxLength={50} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Harga (Rp)"><input required type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="URL gambar (opsional)"><input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
          <Field label="Deskripsi" wide><textarea rows="3" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Syarat & ketentuan (minimal 10 karakter)" wide><textarea required minLength={10} maxLength={10000} rows="5" value={form.terms_and_conditions} onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })} /></Field>
          <FormActions editing={Boolean(editing.id)} onCancel={onCancel} busy={busy} />
        </FormGrid>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((item) => (
          <article key={item.class_id} className="rounded-2xl border border-cocoa/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-display text-xl text-cocoa">{item.class_name}</h3><p className="mt-1 text-sm text-cocoa/55">{item.category} · {money(item.price)}</p></div>
              <ActiveBadge active={item.is_active} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-cocoa/60">{item.description || 'Belum ada deskripsi.'}</p>
            <p className="mt-3 rounded-xl bg-cream p-3 text-xs leading-5 text-cocoa/60">{item.terms_and_conditions ? `${item.terms_and_conditions.slice(0, 180)}${item.terms_and_conditions.length > 180 ? '…' : ''}` : 'Syarat belum diisi'}</p>
            <RowActions onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} disabled={!item.is_active} />
          </article>
        ))}
      </div>
    </ManagementPanel>
  );
}

function InstructorsPanel({ instructors, editing, form, setForm, onCreate, onCancel, onEdit, onDeactivate, onSave, busy }) {
  return (
    <ManagementPanel title="Instruktur" description="Perbarui profil chef yang mengajar di setiap sesi." editing={editing?.type === 'instructors'} onCreate={onCreate} onSave={onSave} busy={busy}>
      {editing?.type === 'instructors' && (
        <FormGrid onSubmit={onSave} busy={busy}>
          <Field label="Nama lengkap"><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Keahlian"><input required value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} /></Field>
          <Field label="Nomor telepon"><input required type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></Field>
          <FormActions editing={Boolean(editing.id)} onCancel={onCancel} busy={busy} />
        </FormGrid>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {instructors.map((item) => (
          <article key={item.instructor_id} className="rounded-2xl border border-cocoa/10 p-5">
            <div className="flex justify-between gap-2"><h3 className="font-display text-xl text-cocoa">{item.full_name}</h3><ActiveBadge active={item.is_active} /></div>
            <p className="mt-2 text-sm text-cocoa/60">{item.expertise}</p><p className="mt-1 text-sm text-cocoa/60">{item.phone_number}</p>
            <RowActions onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} disabled={!item.is_active} />
          </article>
        ))}
      </div>
    </ManagementPanel>
  );
}

function StudiosPanel({ studios, editing, form, setForm, onCreate, onCancel, onEdit, onDeactivate, onSave, busy }) {
  return (
    <ManagementPanel title="Studio" description="Atur nama, alamat, kapasitas, dan lokasi studio." editing={editing?.type === 'studios'} onCreate={onCreate} onSave={onSave} busy={busy}>
      {editing?.type === 'studios' && (
        <FormGrid onSubmit={onSave} busy={busy}>
          <Field label="Nama studio"><input required value={form.studio_name} onChange={(e) => setForm({ ...form, studio_name: e.target.value })} /></Field>
          <Field label="Kapasitas maksimal"><input required type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Alamat" wide><textarea required rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Latitude"><input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
          <Field label="Longitude"><input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
          <FormActions editing={Boolean(editing.id)} onCancel={onCancel} busy={busy} />
        </FormGrid>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((item) => (
          <article key={item.studio_id} className="rounded-2xl border border-cocoa/10 p-5">
            <div className="flex items-start justify-between gap-3"><h3 className="font-display text-xl text-cocoa">{item.studio_name}</h3><ActiveBadge active={item.is_active} /></div>
            <p className="mt-2 text-sm leading-6 text-cocoa/60">{item.address}</p>
            <p className="mt-2 text-sm font-bold text-caramel">Kapasitas {item.capacity} peserta · {item.latitude}, {item.longitude}</p>
            <RowActions onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} disabled={!item.is_active} />
          </article>
        ))}
      </div>
    </ManagementPanel>
  );
}

function SchedulesPanel({ schedules, classes, instructors, studios, editing, form, setForm, onCreate, onCancel, onEdit, onDeactivate, onSave, busy }) {
  const activeClasses = classes.filter((item) => item.is_active && item.terms_and_conditions);
  const activeInstructors = instructors.filter((item) => item.is_active);
  const activeStudios = studios.filter((item) => item.is_active);
  return (
    <ManagementPanel title="Jadwal dan kuota" description="Slot tersedia akan berkurang otomatis saat peserta mengonfirmasi pesanan." editing={editing?.type === 'schedules'} onCreate={onCreate} onSave={onSave} busy={busy}>
      {editing?.type === 'schedules' && (
        <FormGrid onSubmit={onSave} busy={busy}>
          <Field label="Kelas"><select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}><option value="">Pilih kelas</option>{activeClasses.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}</select></Field>
          <Field label="Instruktur"><select required value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}><option value="">Pilih instruktur</option>{activeInstructors.map((item) => <option key={item.instructor_id} value={item.instructor_id}>{item.full_name}</option>)}</select></Field>
          <Field label="Studio"><select required value={form.studio_id} onChange={(e) => setForm({ ...form, studio_id: e.target.value })}><option value="">Pilih studio</option>{activeStudios.map((item) => <option key={item.studio_id} value={item.studio_id}>{item.studio_name} (maks. {item.capacity})</option>)}</select></Field>
          <Field label="Kuota jadwal"><input required type="number" min="1" max="500" value={form.slot_capacity} onChange={(e) => setForm({ ...form, slot_capacity: e.target.value })} /></Field>
          <Field label="Tanggal"><input required type="date" value={form.schedule_date} onChange={(e) => setForm({ ...form, schedule_date: e.target.value })} /></Field>
          <Field label="Jam mulai"><input required type="time" value={form.session_time} onChange={(e) => setForm({ ...form, session_time: e.target.value })} /></Field>
          <FormActions editing={Boolean(editing.id)} onCancel={onCancel} busy={busy} />
        </FormGrid>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {schedules.map((item) => (
          <article key={item.schedule_id} className="rounded-2xl border border-cocoa/10 p-5">
            <div className="flex items-start justify-between gap-3"><h3 className="font-display text-xl text-cocoa">{item.class_name}</h3><ActiveBadge active={item.is_active} /></div>
            <p className="mt-2 text-sm font-semibold text-cocoa/65">{dateLabel(item.schedule_date)} · {timeLabel(item.session_time)} WIB</p>
            <p className="mt-2 text-sm text-cocoa/60">{item.instructor_name} · {item.studio_name}</p>
            <p className="mt-2 text-sm font-extrabold text-rose">Tersedia {item.slot_remaining} dari {item.slot_capacity} kursi</p>
            <RowActions onEdit={() => onEdit(item)} onDeactivate={() => onDeactivate(item)} disabled={!item.is_active} />
          </article>
        ))}
      </div>
    </ManagementPanel>
  );
}

function PaymentsPanel({ bookings, note, setNote, onReview, onProof, busy }) {
  const pending = bookings.filter((item) => item.proof_status === 'pending_review');
  return (
    <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush text-rose"><CreditCard size={20} /></span>
        <div><h2 className="font-display text-2xl text-cocoa">Verifikasi pembayaran</h2><p className="text-sm text-cocoa/55">{pending.length} bukti menunggu peninjauan</p></div>
      </div>
      {pending.length ? <div className="mt-6 grid gap-5 lg:grid-cols-2">{pending.map((booking) => (
        <article key={booking.payment_id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div><span className="text-xs font-extrabold uppercase tracking-wide text-rose">Pesanan #{booking.registration_id}</span><h3 className="mt-1 font-display text-xl text-cocoa">{booking.class_name}</h3></div>
            <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900">Perlu verifikasi</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-cocoa/70">
            <p><strong className="text-cocoa">Peserta:</strong> {booking.participant_name} · {booking.phone_number}</p>
            <p><strong className="text-cocoa">Email:</strong> {booking.email}</p>
            <p><strong className="text-cocoa">Jadwal:</strong> {dateLabel(booking.schedule_date)} · {timeLabel(booking.session_time)} WIB</p>
            <p><strong className="text-cocoa">Jumlah:</strong> {money(booking.total_amount)}</p>
          </div>
          <button className="button-outline mt-4" onClick={() => onProof(booking.payment_id)}>Lihat bukti transfer</button>
          <label className="field-label mt-4">Catatan verifikasi (opsional)<textarea rows="2" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan untuk peserta jika bukti ditolak" /></label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button disabled={busy} onClick={() => onReview(booking.payment_id, 'approve')} className="button-primary !bg-emerald-700 hover:!bg-emerald-800"><Check size={16} /> Setujui</button>
            <button disabled={busy} onClick={() => onReview(booking.payment_id, 'reject')} className="button-outline !border-red-200 !text-red-700 hover:!bg-red-50">Tolak & lepas slot</button>
          </div>
        </article>
      ))}</div> : <div className="mt-6 rounded-2xl bg-cream p-8 text-center text-sm text-cocoa/55">Semua bukti pembayaran sudah ditinjau.</div>}
      <div className="mt-8"><h3 className="font-display text-xl text-cocoa">Riwayat transaksi</h3><div className="mt-4 overflow-x-auto"><BookingTable bookings={bookings} /></div></div>
    </section>
  );
}

function PaymentSettingsPanel({ settings, onSave, busy }) {
  return (
    <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-5 shadow-card sm:p-7">
      <div>
        <h2 className="font-display text-2xl text-cocoa">Rekening transfer peserta</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-cocoa/55">Informasi ini tampil pada checkout dan pemesanan peserta yang masih menunggu pembayaran.</p>
      </div>
      <form className="mt-6 grid gap-4 rounded-2xl bg-cream p-5 md:grid-cols-2" onSubmit={onSave}>
        <Field label="Nama bank"><input name="bank_name" defaultValue={settings?.bank_name || ''} required minLength={2} maxLength={100} placeholder="Contoh: Bank ..." /></Field>
        <Field label="Nama pemilik rekening"><input name="account_name" defaultValue={settings?.account_name || ''} required minLength={2} maxLength={100} /></Field>
        <Field label="Nomor rekening"><input name="account_number" defaultValue={settings?.account_number || ''} required minLength={4} maxLength={40} inputMode="numeric" /></Field>
        <Field label="Petunjuk transfer tambahan (opsional)"><input name="instructions" defaultValue={settings?.instructions || ''} maxLength={1000} placeholder="Cantumkan kode pesanan pada berita transfer, dll." /></Field>
        <div className="flex items-center justify-between gap-4 md:col-span-2">
          <p className={`text-sm font-bold ${settings?.configured ? 'text-emerald-700' : 'text-amber-800'}`}>
            {settings?.configured ? 'Informasi rekening sudah tersedia untuk peserta.' : 'Lengkapi rekening agar peserta dapat membuat pesanan.'}
          </p>
          <button className="button-primary shrink-0" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan informasi'}</button>
        </div>
      </form>
    </section>
  );
}

function BookingTable({ bookings }) {
  return (
    <table className="data-table min-w-[760px]">
      <thead><tr><th>Peserta & kontak</th><th>Kelas & jadwal</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>{bookings.length ? bookings.map((item) => (
        <tr key={item.registration_id}>
          <td><span className="font-bold text-cocoa">{item.participant_name}</span><span className="block text-xs text-cocoa/50">{item.email} · {item.phone_number}</span></td>
          <td>{item.class_name}<span className="block text-xs text-cocoa/50">{dateLabel(item.schedule_date)} · {timeLabel(item.session_time)} WIB</span></td>
          <td>{money(item.total_amount)}</td>
          <td><StatusText status={item.booking_status} /></td>
        </tr>
      )) : <tr><td colSpan="4" className="py-7 text-center text-cocoa/50">Belum ada transaksi.</td></tr>}</tbody>
    </table>
  );
}

function ManagementPanel({ title, description, editing, onCreate, children }) {
  return (
    <section className="rounded-[1.5rem] border border-cocoa/10 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-display text-2xl text-cocoa">{title}</h2><p className="mt-1 text-sm text-cocoa/55">{description}</p></div>
        {!editing && <button className="button-primary" onClick={onCreate}><Plus size={17} /> Tambah</button>}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function FormGrid({ onSubmit, busy, children }) {
  return <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl bg-cream p-5 md:grid-cols-2">{children}</form>;
}

function Field({ label, wide = false, children }) {
  return <label className={`field-label ${wide ? 'md:col-span-2' : ''}`}>{label}{children}</label>;
}

function FormActions({ editing, onCancel, busy }) {
  return (
    <div className="flex justify-end gap-3 md:col-span-2">
      <button type="button" className="button-outline" onClick={onCancel}><X size={15} /> Batal</button>
      <button className="button-primary" disabled={busy}><Check size={16} /> {busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan'}</button>
    </div>
  );
}

function RowActions({ onEdit, onDeactivate, disabled }) {
  return (
    <div className="mt-4 flex gap-2">
      <button className="button-outline !px-3 !py-2 text-xs" onClick={onEdit}><Pencil size={14} /> Edit</button>
      {!disabled && <button className="button-outline !border-red-200 !px-3 !py-2 text-xs !text-red-700" onClick={onDeactivate}>Nonaktifkan</button>}
    </div>
  );
}

function ActiveBadge({ active }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-cocoa/5 text-cocoa/50'}`}>{active ? 'Aktif' : 'Nonaktif'}</span>;
}

function StatusText({ status }) {
  const labels = { confirmed: 'Terkonfirmasi', under_review: 'Menunggu verifikasi', pending_payment: 'Menunggu pembayaran', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan', payment_rejected: 'Ditolak' };
  return <span className="font-semibold">{labels[status] || status}</span>;
}

function ProofModal({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/70 p-4" role="dialog" aria-modal="true" aria-label="Bukti pembayaran">
      <div className="relative max-h-[90vh] max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
        <button className="absolute right-2 top-2 z-10 rounded-full bg-white p-2 text-cocoa shadow" onClick={onClose} aria-label="Tutup bukti"><X size={20} /></button>
        <img src={src} alt="Bukti pembayaran peserta" className="max-h-[82vh] max-w-full rounded-xl object-contain" />
      </div>
    </div>
  );
}

function CalendarIcon({ size = 16, ...props }) {
  return <span {...props} className="inline-flex items-center"><span aria-hidden="true">▦</span></span>;
}
