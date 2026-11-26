import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Heart, Sparkles } from 'lucide-react';
import Header from './components/Header.jsx';
import ClassCard from './components/ClassCard.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import CourseDetail from './components/CourseDetail.jsx';
import BookingHistory from './components/BookingHistory.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import { api, getToken, saveToken } from './api.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [authDestination, setAuthDestination] = useState(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => { saveToken(null); setUser(null); })
      .finally(() => setCheckingSession(false));
  }, []);

  function signOut() {
    saveToken(null);
    setUser(null);
    setPage('home');
    setSelectedClassId(null);
  }

  function selectClass(classId) {
    setSelectedClassId(classId);
    setPage('class');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(nextPage) {
    if (nextPage === 'admin' && user?.role !== 'admin') return setPage('home');
    if ((nextPage === 'bookings' || nextPage === 'profile') && !user) {
      setAuthDestination(nextPage);
      return setPage('auth');
    }
    if (nextPage === 'auth') setAuthDestination(null);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (checkingSession) {
    return <div className="flex min-h-screen items-center justify-center bg-cream text-cocoa">Menyiapkan ruang baking…</div>;
  }

  return (
    <div className="min-h-screen bg-cream text-cocoa">
      <Header user={user} onNavigate={navigate} onSignOut={signOut} />
      {page === 'auth' && (
        <AuthPanel
          onBack={() => { setAuthDestination(null); navigate(selectedClassId ? 'class' : 'home'); }}
          onSuccess={(nextUser) => {
            setUser(nextUser);
            setPage(authDestination || (nextUser.role === 'admin' ? 'admin' : selectedClassId ? 'class' : 'home'));
            setAuthDestination(null);
          }}
        />
      )}
      {page === 'class' && selectedClassId && (
        <CourseDetail
          key={selectedClassId}
          classId={selectedClassId}
          user={user}
          onRequireAuth={() => { setAuthDestination('class'); setPage('auth'); }}
          onBack={() => navigate('catalog')}
        />
      )}
      {page === 'bookings' && user && <BookingHistory key={user.user_id} />}
      {page === 'profile' && user && <ProfilePanel user={user} onUpdated={setUser} onBack={() => navigate(user.role === 'admin' ? 'admin' : 'home')} />}
      {page === 'admin' && user?.role === 'admin' && <AdminDashboard key={user.user_id} />}
      {(page === 'home' || page === 'catalog') && <CatalogPage page={page} onNavigate={navigate} onSelectClass={selectClass} />}
      <Footer />
    </div>
  );
}

function CatalogPage({ page, onNavigate, onSelectClass }) {
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api('/classes')
      .then((result) => { if (active) setClasses(result.classes); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => [...new Set(classes.map((item) => item.category))], [classes]);
  const filtered = useMemo(() => classes.filter((item) => {
    const matchesText = `${item.class_name} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (!category || item.category === category);
  }), [classes, search, category]);
  const isCatalog = page === 'catalog';

  return (
    <main>
      {isCatalog ? (
        <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-rose">Pilih kelasmu</p>
          <h1 className="mt-2 font-display text-4xl text-cocoa sm:text-5xl">Kelas baking yang terasa seperti rumah</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cocoa/65">Dari resep pertama hingga teknik pastry yang lebih menantang. Pilih kelas, baca syaratnya, lalu temukan jadwal yang paling pas.</p>
        </section>
      ) : (
        <section className="hero-wrap overflow-hidden">
          <div className="mx-auto grid min-h-[570px] max-w-7xl items-center gap-8 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose/15 bg-white/70 px-4 py-2 text-sm font-bold text-rose">
                <Sparkles size={16} /> Kelas baking untuk semua
              </span>
              <h1 className="mt-6 max-w-2xl font-display text-5xl leading-[1.08] text-cocoa sm:text-6xl lg:text-7xl">
                Sedikit tepung, <span className="text-rose">banyak</span> cerita.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-cocoa/70">
                Ruang hangat untuk belajar membuat dessert, mencoba resep baru, dan menikmati prosesnya bersama.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => onNavigate('catalog')} className="button-primary !px-6 !py-3.5">
                  Temukan kelas <ArrowRight size={17} />
                </button>
                <button onClick={() => document.getElementById('cerita-kami')?.scrollIntoView({ behavior: 'smooth' })} className="button-outline !px-6 !py-3.5">
                  Kenali ruang kami
                </button>
              </div>
              <div className="mt-10 flex items-center gap-3 text-sm font-semibold text-cocoa/55">
                <span className="flex -space-x-2 text-xl" aria-hidden="true"><span>🧁</span><span>🥐</span><span>🍰</span></span>
                <span>Belajar santai, hasilnya bisa dibawa pulang</span>
              </div>
            </div>
            <div className="relative mx-auto flex h-[330px] w-full max-w-[500px] items-center justify-center sm:h-[430px]">
              <div className="absolute h-[285px] w-[285px] rounded-full bg-blush sm:h-[380px] sm:w-[380px]" />
              <div className="absolute right-8 top-8 h-20 w-20 rounded-full bg-orange-100" />
              <div className="absolute bottom-8 left-5 h-12 w-12 rounded-full bg-amber-100" />
              <div className="dessert-scene relative flex h-[245px] w-[245px] items-center justify-center rounded-full border-[14px] border-white bg-gradient-to-br from-rose-100 via-orange-50 to-amber-100 shadow-card sm:h-[330px] sm:w-[330px]">
                <span className="select-none text-[118px] drop-shadow-sm sm:text-[160px]" aria-label="Cupcake">🧁</span>
                <span className="absolute left-6 top-8 text-3xl text-caramel">✦</span>
                <span className="absolute bottom-8 right-7 text-2xl text-rose">✧</span>
              </div>
              <div className="absolute bottom-7 right-2 rounded-2xl border border-white bg-white/90 p-4 shadow-card sm:right-0">
                <p className="font-display text-lg text-cocoa">Dibuat dengan rasa</p>
                <p className="mt-1 text-xs font-bold tracking-wider text-rose">MANIS · HANGAT · SERU</p>
              </div>
            </div>
          </div>
          <button onClick={() => document.getElementById('kelas-kami')?.scrollIntoView({ behavior: 'smooth' })} className="mx-auto -mt-2 mb-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.15em] text-cocoa/45">
            Gulir untuk melihat kelas <ArrowDown size={14} />
          </button>
        </section>
      )}

      <section id="kelas-kami" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-rose">Dari dapur kami</p>
            <h2 className="mt-2 font-display text-4xl text-cocoa">{isCatalog ? 'Cari kelas favoritmu' : 'Temukan kelas favoritmu'}</h2>
            <p className="mt-2 max-w-xl text-cocoa/60">Pilih kelas, pahami syaratnya, dan tentukan jadwal sebelum menyelesaikan pembayaran.</p>
          </div>
          {!isCatalog && <button onClick={() => onNavigate('catalog')} className="button-outline">Lihat semua kelas <ArrowRight size={16} /></button>}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <input className="search-input w-full sm:max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau topik kelas…" aria-label="Cari kelas" />
          <select className="search-input sm:max-w-[220px]" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter kategori">
            <option value="">Semua kategori</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
        {loading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-[430px] animate-pulse rounded-[1.65rem] bg-white/70" />)}</div>
        ) : filtered.length ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(isCatalog ? filtered : filtered.slice(0, 3)).map((item, index) => <ClassCard key={item.class_id} course={item} index={index} onSelect={onSelectClass} />)}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.5rem] bg-white p-10 text-center shadow-card">
            <p className="text-4xl" aria-hidden="true">🍪</p>
            <h3 className="mt-3 font-display text-2xl text-cocoa">Belum ada kelas yang cocok</h3>
            <p className="mt-2 text-cocoa/60">Coba kata pencarian atau kategori yang berbeda.</p>
          </div>
        )}
      </section>

      {!isCatalog && (
        <>
          <section id="cerita-kami" className="border-y border-cocoa/5 bg-white/70">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-3 lg:px-8">
              <Feature icon="🤍" title="Ruang untuk semua" text="Tidak harus berpengalaman. Datang dengan rasa ingin tahu dan belajar sesuai ritmemu." />
              <Feature icon="🍓" title="Belajar sambil mencoba" text="Setiap kelas dirancang agar kamu bisa langsung berlatih dan menikmati hasilnya." />
              <Feature icon="🧑‍🍳" title="Ditemani chef" text="Instruktur berbagi teknik dan tips praktis di suasana yang hangat dan suportif." />
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
            <div className="rounded-[2rem] bg-cocoa px-7 py-10 text-center text-cream sm:px-12 sm:py-14">
              <Heart className="mx-auto text-rose-200" size={27} />
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">Satu adonan, banyak kemungkinan.</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-cream/70">Pilih kelas, baca syaratnya, lalu booking jadwal yang paling pas untukmu.</p>
              <button onClick={() => onNavigate('catalog')} className="button-light mt-6">Jelajahi kelas <ArrowRight size={16} /></button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Feature({ icon, title, text }) {
  return (
    <article className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-2xl">{icon}</span>
      <h3 className="mt-4 font-display text-xl text-cocoa">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-cocoa/60">{text}</p>
    </article>
  );
}

function Footer() {
  return (
    <footer className="border-t border-cocoa/10 bg-white/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-center text-sm text-cocoa/55 sm:flex-row sm:items-center sm:justify-between sm:text-left lg:px-8">
        <p><span className="font-display text-lg text-cocoa">Ruang Rasa</span> · Baking Studio</p>
        <p>Belajar baking dengan cara yang hangat dan menyenangkan.</p>
      </div>
    </footer>
  );
}
