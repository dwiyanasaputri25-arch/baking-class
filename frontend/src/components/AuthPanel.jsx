import { useState } from 'react';
import { ArrowLeft, CakeSlice, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { api, saveToken } from '../api.js';

export default function AuthPanel({ onSuccess, onBack }) {
  const [mode, setMode] = useState('register');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      saveToken(result.token);
      onSuccess(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-84px)] max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-[1fr_0.9fr] lg:px-8">
      <section className="hidden rounded-[2rem] bg-gradient-to-br from-blush via-rose-50 to-orange-50 p-10 md:block">
        <button onClick={onBack} className="mb-14 inline-flex items-center gap-2 text-sm font-bold text-cocoa/65 hover:text-rose">
          <ArrowLeft size={17} /> Kembali
        </button>
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose shadow-card">
          <CakeSlice size={31} />
        </div>
        <h1 className="max-w-md font-display text-5xl leading-tight text-cocoa">Racik rasa, ciptakan cerita.</h1>
        <p className="mt-5 max-w-sm text-base leading-7 text-cocoa/65">Temukan kelas yang pas, belajar bersama chef, dan bawa pulang hasil kreasimu.</p>
        <div className="mt-12 flex items-center gap-2 text-3xl" aria-hidden="true">🧁 <span className="text-rose/50">✦</span> 🥐</div>
      </section>

      <section className="mx-auto w-full max-w-md rounded-[1.75rem] border border-cocoa/10 bg-white p-7 shadow-card sm:p-9">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-cocoa/60 hover:text-rose md:hidden">
          <ArrowLeft size={17} /> Kembali
        </button>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-rose">{mode === 'register' ? 'Mulai di sini' : 'Senang bertemu lagi'}</p>
        <h2 className="mt-2 font-display text-3xl text-cocoa">{mode === 'register' ? 'Buat akun peserta' : 'Masuk ke akun'}</h2>
        <p className="mt-2 text-sm leading-6 text-cocoa/60">
          {mode === 'register' ? 'Daftar untuk memilih kelas dan jadwal baking.' : 'Lanjutkan pemesanan kelas baking Anda.'}
        </p>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field-label">
              Nama lengkap
              <span className="field-wrap"><UserRound size={17} /><input name="full_name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Nama yang ingin kami panggil" /></span>
            </label>
          )}
          <label className="field-label">
            Email
            <span className="field-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" required placeholder="nama@email.com" /></span>
          </label>
          {mode === 'register' && (
            <label className="field-label">
              Nomor yang dapat dihubungi
              <span className="field-wrap"><Phone size={17} /><input name="phone_number" type="tel" autoComplete="tel" required minLength={8} maxLength={20} placeholder="08xx xxxx xxxx" /></span>
            </label>
          )}
          <label className="field-label">
            Password
            <span className="field-wrap"><LockKeyhole size={17} /><input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 10 : 1} maxLength={128} placeholder={mode === 'register' ? 'Minimal 10 karakter' : 'Password Anda'} /></span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <button type="submit" className="button-primary w-full justify-center !py-3.5" disabled={busy}>
            {busy ? 'Mohon tunggu…' : mode === 'register' ? 'Daftar akun' : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cocoa/60">
          {mode === 'register' ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <button className="font-extrabold text-rose hover:underline" onClick={() => { setError(''); setMode(mode === 'register' ? 'login' : 'register'); }}>
            {mode === 'register' ? 'Masuk' : 'Daftar'}
          </button>
        </p>
      </section>
    </main>
  );
}
