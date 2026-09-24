import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Gamepad2, Menu, Settings, User, LogOut, X, Tag } from 'lucide-react';
import API from '../services/api';
import Avatar from './Avatar';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [perfil, setPerfil] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [cuentaMovilOpen, setCuentaMovilOpen] = useState(false);
  const cuentaRef = useRef(null);
  const token = localStorage.getItem('token');

  function cargarPerfil() {
    if (!token) {
      setPerfil(null);
      return;
    }
    API.get('/auth/yo')
      .then(({ data }) => setPerfil(data))
      .catch(() => setPerfil(null));
  }

  useEffect(() => {
    cargarPerfil();
  }, [token, location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setCuentaOpen(false);
    setCuentaMovilOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!cuentaOpen) return undefined;

    function onPointerDown(event) {
      if (cuentaRef.current && !cuentaRef.current.contains(event.target)) {
        setCuentaOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setCuentaOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [cuentaOpen]);

  function logout() {
    localStorage.removeItem('token');
    setPerfil(null);
    setCuentaOpen(false);
    setCuentaMovilOpen(false);
    setMenuOpen(false);
    navigate('/login');
  }

  function toggleCuentaDesktop() {
    setCuentaOpen((abierto) => {
      const siguiente = !abierto;
      if (siguiente) cargarPerfil();
      return siguiente;
    });
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.startsWith('/library')) return location.pathname.startsWith('/library');
    if (path.startsWith('/offers')) return location.pathname.startsWith('/offers');
    if (path.startsWith('/perfil')) return location.pathname.startsWith('/perfil');
    return location.pathname.startsWith(path);
  };

  const getDesktopClass = (path) => {
    return `transition hover:text-amber-300 ${isActive(path) ? 'text-amber-300 font-semibold' : 'text-zinc-100'}`;
  };

  const getMobileClass = (path) => {
    return `block px-4 py-3 text-base transition ${isActive(path) ? 'bg-amber-400/10 text-amber-300 rounded-lg font-semibold' : 'text-zinc-100 hover:text-amber-300'}`;
  };

  const menuItemClass = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-amber-400/10 hover:text-amber-300';

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          {/* Izquierda: solo logo */}
          <Link to={token ? '/' : '/login'} className="flex min-w-0 items-center gap-2 text-xl font-black tracking-tight text-amber-300">
            <Gamepad2 className="w-8 h-8 shrink-0" />
            <span className="truncate">GameTracker</span>
          </Link>

          {/* Derecha: nav + avatar (desktop); hamburguesa (móvil) */}
          <div className="flex items-center gap-5">
            <nav className="hidden sm:flex items-center gap-5 text-sm font-medium">
              {token ? (
                <>
                        <Link to="/" className={getDesktopClass('/')}>Inicio</Link>
                        <Link to="/offers" className={getDesktopClass('/offers')}>Ofertas</Link>
                        <Link to="/amigos" className={getDesktopClass('/amigos')}>Amigos</Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-zinc-100 hover:text-amber-300 transition">Entrar</Link>
                  <Link to="/registro" className="text-zinc-100 hover:text-amber-300 transition">Registro</Link>
                </>
              )}
            </nav>

            {token && (
              <div className="relative hidden sm:block" ref={cuentaRef}>
                <button
                  type="button"
                  onClick={toggleCuentaDesktop}
                  aria-label="Menú de cuenta"
                  aria-expanded={cuentaOpen}
                  aria-haspopup="menu"
                  className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 transition ${
                    cuentaOpen
                      ? 'ring-amber-400/60'
                      : 'ring-white/10 hover:ring-amber-400/50'
                  }`}
                >
                  <Avatar perfil={perfil} />
                </button>

                {cuentaOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"
                  >
                    <div className="mb-1 flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2.5">
                      <Avatar perfil={perfil} className="h-10 w-10 text-sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {perfil?.nombre || 'Usuario'}
                        </p>
                        <p className="truncate text-xs font-medium text-amber-400">
                          @{perfil?.username || '…'}
                        </p>
                      </div>
                    </div>

                    {perfil?.username && (
                      <Link
                        role="menuitem"
                        to={`/perfil/${perfil.username}`}
                        className={menuItemClass}
                        onClick={() => setCuentaOpen(false)}
                      >
                        <User className="h-4 w-4 shrink-0 opacity-80" />
                        Mi perfil
                      </Link>
                    )}
                    <Link
                      role="menuitem"
                      to="/configuracion"
                      className={menuItemClass}
                      onClick={() => setCuentaOpen(false)}
                    >
                      <Settings className="h-4 w-4 shrink-0 opacity-80" />
                      Configuración
                    </Link>

                    <div className="my-1 border-t border-white/10" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                      Salir
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-100"
              onClick={() => {
                setMenuOpen(true);
                setCuentaOpen(false);
                cargarPerfil();
              }}
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-zinc-950 border-l border-white/10 z-40 sm:hidden transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-end p-4">
          <button
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-100"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-4 pb-6 flex flex-col gap-1 font-medium">
          {token ? (
            <>
              {/* Cuenta: acordeón dentro del drawer */}
              <div className="mb-2 rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCuentaMovilOpen((v) => !v)}
                  aria-expanded={cuentaMovilOpen}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-900/80"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${
                      cuentaMovilOpen ? 'ring-amber-400/50' : 'ring-white/10'
                    }`}
                  >
                    <Avatar perfil={perfil} className="h-10 w-10 text-sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {perfil?.nombre || 'Usuario'}
                    </span>
                    <span className="block truncate text-xs text-amber-400">
                      @{perfil?.username || '…'}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${
                      cuentaMovilOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    cuentaMovilOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-0.5 border-t border-white/10 px-2 py-2">
                      {perfil?.username && (
                        <Link
                          to={`/perfil/${perfil.username}`}
                          className={menuItemClass}
                          onClick={() => setMenuOpen(false)}
                        >
                          <User className="h-4 w-4 shrink-0 opacity-80" />
                          Mi perfil
                        </Link>
                      )}
                      <Link
                        to="/configuracion"
                        className={menuItemClass}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4 shrink-0 opacity-80" />
                        Configuración
                      </Link>
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
                      >
                        <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                        Salir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nav principal */}
              <Link to="/" className={getMobileClass('/')}>Inicio</Link>
              <Link to="/library" className={getMobileClass('/library')}>Biblioteca</Link>
              <Link to="/offers" className={getMobileClass('/offers')}>Ofertas</Link>
              <Link to="/amigos" className={getMobileClass('/amigos')}>Amigos</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="block px-4 py-3 text-base text-zinc-100 hover:text-amber-300 transition">Entrar</Link>
              <Link to="/registro" className="block px-4 py-3 text-base text-zinc-100 hover:text-amber-300 transition">Registro</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}