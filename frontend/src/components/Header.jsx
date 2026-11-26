import { ArrowRight, CakeSlice, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useState } from 'react';

export default function Header({ user, onNavigate, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function navigate(page) {
    setMenuOpen(false);
    onNavigate(page);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cocoa/10 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <button className="flex items-center gap-3 text-left" onClick={() => navigate('home')} aria-label="Ke beranda">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush text-rose">
            <CakeSlice size={23} strokeWidth={1.8} />
          </span>
          <span>
            <span className="block font-display text-xl leading-none text-cocoa">Ruang Rasa</span>
            <span className="mt-1 block text-[11px] font-semibold tracking-[0.17em] text-caramel">BAKING STUDIO</span>
          </span>
        </button>

        <button className="rounded-full p-2 text-cocoa md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}>
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>

        <nav className={`${menuOpen ? 'absolute left-0 right-0 top-full flex flex-col border-b border-cocoa/10 bg-cream px-5 pb-5 pt-2 shadow-card' : 'hidden'} items-stretch gap-2 md:static md:flex md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
          <button onClick={() => navigate('home')} className="nav-link">Beranda</button>
          <button onClick={() => navigate('catalog')} className="nav-link">Kelas baking</button>
          {user ? (
            <>
              {user.role === 'admin' ? (
                <>
                  <button onClick={() => navigate('profile')} className="nav-link">Profil</button>
                  <button onClick={() => navigate('admin')} className="nav-link">Dashboard admin</button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate('profile')} className="nav-link">Profil</button>
                  <button onClick={() => navigate('bookings')} className="nav-link">Pemesanan saya</button>
                </>
              )}
              <span className="hidden text-sm font-semibold text-cocoa/75 lg:inline">Hai, {user.full_name.split(' ')[0]}</span>
              <button onClick={onSignOut} className="button-outline justify-center">
                <LogOut size={16} /> Keluar
              </button>
            </>
          ) : (
            <button onClick={() => navigate('auth')} className="button-primary justify-center">
              Masuk / Daftar <ArrowRight size={16} />
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
