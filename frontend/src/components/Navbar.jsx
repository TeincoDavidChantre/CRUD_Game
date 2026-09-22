import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, Menu, X } from 'lucide-react';
import API from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [perfil, setPerfil] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setPerfil(null);
      return;
    }
    API.get('/auth/yo')
      .then(({ data }) => setPerfil(data))
      .catch(() => setPerfil(null));
  }, [token]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function logout() {
    localStorage.removeItem('token');
    setPerfil(null);
    navigate('/login');
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.startsWith('/library')) return location.pathname.startsWith('/library');
    if (path.startsWith('/perfil')) return location.pathname.startsWith('/perfil');
    return location.pathname.startsWith(path);
  };

  const getDesktopClass = (path) => {
    return `transition hover:text-amber-300 ${isActive(path) ? 'text-amber-300' : 'text-zinc-100'}`;
  };

  const getMobileClass = (path) => {
    return `block px-4 py-3 text-base transition ${isActive(path) ? 'bg-amber-400/10 text-amber-300 rounded-lg' : 'text-zinc-100 hover:text-amber-300'}`;
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to={token ? '/' : '/login'} className="flex items-center gap-2 text-xl font-black tracking-tight text-amber-300">
            <Gamepad2 className="w-8 h-8" />
            <span>GameTracker</span>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-5 text-sm font-medium">
            {token ? (
              <>
                <Link to="/" className={getDesktopClass('/')}>Inicio</Link>
                <Link to="/library" className={getDesktopClass('/library')}>Biblioteca</Link>
                <Link to="/amigos" className={getDesktopClass('/amigos')}>Amigos</Link>
                <Link to="/configuracion" className={getDesktopClass('/configuracion')}>Configuración</Link>
                {perfil && (
                  <Link to={`/perfil/${perfil.username}`} className={`font-semibold hover:underline ${isActive('/perfil') ? 'text-amber-300' : 'text-amber-400'}`}>
                    @{perfil.username}
                  </Link>
                )}
                <button type="button" onClick={logout} className="text-zinc-100 hover:text-amber-300 transition">Salir</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-zinc-100 hover:text-amber-300 transition">Entrar</Link>
                <Link to="/registro" className="text-zinc-100 hover:text-amber-300 transition">Registro</Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-100"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-64 bg-zinc-950 border-l border-white/10 z-40 sm:hidden transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-end p-4">
          <button 
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-100"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="px-4 py-2 flex flex-col gap-2 font-medium">
          {token ? (
            <>
              <Link to="/" className={getMobileClass('/')}>Inicio</Link>
              <Link to="/library" className={getMobileClass('/library')}>Biblioteca</Link>
              <Link to="/amigos" className={getMobileClass('/amigos')}>Amigos</Link>
              <Link to="/configuracion" className={getMobileClass('/configuracion')}>Configuración</Link>
              {perfil && (
                <Link to={`/perfil/${perfil.username}`} className={`block px-4 py-3 text-base transition ${isActive('/perfil') ? 'bg-amber-400/10 text-amber-300 rounded-lg' : 'text-amber-400 hover:text-amber-300'}`}>
                  @{perfil.username}
                </Link>
              )}
              <button type="button" onClick={logout} className="block w-full text-left px-4 py-3 text-base text-zinc-100 hover:text-amber-300 transition">Salir</button>
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
