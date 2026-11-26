import { useState } from 'react';
import { ArrowLeft, KeyRound, Mail, Phone, UserRound } from 'lucide-react';
import { api } from '../api.js';

export default function ProfilePanel({ user, onUpdated, onBack }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone_number);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword && newPassword !== confirmPassword) {
      setError('Konfirmasi password baru belum sama.');
      return;
    }
    if (Boolean(currentPassword) !== Boolean(newPassword)) {
      setError('Isi password lama dan baru untuk mengganti password.');
      return;
    }
    setBusy(true);
    try {
      const payload = { full_name: fullName, phone_number: phone };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      const result = await api('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
      onUpdated(result.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 py-12 lg:px-8">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-extrabold text-cocoa/60 hover:text-rose">
        <ArrowLeft size={17} /> Kembali
      </button>
      <section className="rounded-[1.75rem] border border-cocoa/10 bg-white p-6 shadow-card sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.17em] text-rose">Akun Ruang Rasa</p>
        <h1 className="mt-2 font-display text-3xl text-cocoa">Profil saya</h1>
        <p className="mt-2 text-sm leading-6 text-cocoa/60">Pastikan nama dan nomor teleponmu benar agar admin dapat menghubungimu terkait kelas.</p>

        <form className="mt-7 grid gap-5 md:grid-cols-2" onSubmit={submit}>
          <label className="field-label">
            Nama lengkap
            <span className="field-wrap"><UserRound size={17} /><input value={fullName} required minLength={2} maxLength={100} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></span>
          </label>
          <label className="field-label">
            Email login
            <span className="field-wrap field-wrap-disabled"><Mail size={17} /><input value={user.email} disabled /></span>
          </label>
          <label className="field-label md:col-span-2">
            Nomor telepon yang dapat dihubungi
            <span className="field-wrap"><Phone size={17} /><input type="tel" value={phone} required minLength={8} maxLength={20} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></span>
          </label>

          <div className="md:col-span-2">
            <div className="mb-4 border-t border-cocoa/10 pt-5">
              <h2 className="flex items-center gap-2 font-display text-xl text-cocoa"><KeyRound size={18} className="text-rose" /> Ganti password</h2>
              <p className="mt-1 text-sm text-cocoa/55">Kosongkan jika tidak ingin mengganti password.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="field-label">
                Password saat ini
                <span className="field-wrap"><KeyRound size={17} /><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></span>
              </label>
              <label className="field-label">
                Password baru
                <span className="field-wrap"><KeyRound size={17} /><input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></span>
              </label>
              <label className="field-label md:col-span-2">
                Ulangi password baru
                <span className="field-wrap"><KeyRound size={17} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></span>
              </label>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 md:col-span-2">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 md:col-span-2">{notice}</p>}
          <div className="flex justify-end md:col-span-2">
            <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
