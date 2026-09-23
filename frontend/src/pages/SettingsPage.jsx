import { useEffect, useState } from 'react';
import API from '../services/api';
import ApiKeysModal from '../components/ApiKeysModal';
import { MONEDAS, guardarMoneda, obtenerMoneda } from '../lib/moneda';

const AVATARES_PRESET = [
  { id: '1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelGamer', nombre: 'Cyber Bot' },
  { id: '2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RetroArcade', nombre: 'Retro Bot' },
  { id: '3', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=MechaZone', nombre: 'Mecha' },
  { id: '4', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=NovaPilot', nombre: 'Nova' },
  { id: '5', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=VaporQuest', nombre: 'Vapor' },
];

export default function SettingsPage() {
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [keysInfo, setKeysInfo] = useState({ hasRawg: false, hasIgdb: false });
  const [moneda, setMoneda] = useState(() => obtenerMoneda());

  const [nombre, setNombre] = useState('');
  const [biografia, setBiografia] = useState('');
  const [avatar, setAvatar] = useState('');

  function checkKeys() {
    setKeysInfo({
      hasRawg: Boolean(localStorage.getItem('gametracker_rawg_key')),
      hasIgdb: Boolean(localStorage.getItem('gametracker_igdb_client_id') && localStorage.getItem('gametracker_igdb_client_secret')),
    });
  }

  useEffect(() => {
    API.get('/auth/yo')
      .then(({ data }) => {
        setPerfil(data);
        setNombre(data.nombre || '');
        setBiografia(data.biografia || '');
        setAvatar(data.avatar || '');
      })
      .catch(() => setError('No se pudo cargar la cuenta'));
    checkKeys();
  }, []);

  async function handleGuardarPerfil(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setMensajeExito('');
    try {
      const { data } = await API.patch('/auth/perfil', {
        nombre,
        biografia,
        avatar,
      });
      setPerfil(data);
      setMensajeExito('¡Perfil actualizado con éxito!');
      setTimeout(() => setMensajeExito(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al actualizar el perfil');
    } finally {
      setGuardando(false);
    }
  }

  function handleMoneda(code) {
    const ok = guardarMoneda(code);
    setMoneda(ok);
    setMensajeExito(`Moneda guardada: ${ok}. Los precios se mostrarán en esta moneda.`);
    setTimeout(() => setMensajeExito(''), 3000);
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-400">Personaliza tu perfil público y preferencias de catálogo.</p>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {mensajeExito && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {mensajeExito}
        </p>
      )}

      {perfil && (
        <form onSubmit={handleGuardarPerfil} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
          <h2 className="text-base font-bold text-white">Perfil Público</h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Avatar del Perfil</label>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-amber-400 text-2xl font-black text-zinc-950 border border-zinc-700">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  nombre ? nombre.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div className="text-xs text-zinc-400">
                Selecciona uno de los avatares predefinidos o ingresa una URL personalizada.
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {AVATARES_PRESET.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setAvatar(av.url)}
                  className={`h-11 w-11 overflow-hidden rounded-xl border p-1 transition ${
                    avatar === av.url ? 'border-amber-400 bg-amber-400/20' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'
                  }`}
                  title={av.nombre}
                >
                  <img src={av.url} alt={av.nombre} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>

            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="O pega aquí la URL de tu imagen de avatar (https://...)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Nombre de Usuario (no editable)</label>
              <input
                type="text"
                value={`@${perfil.username}`}
                disabled
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2 text-sm text-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Biografía</label>
            <textarea
              value={biografia}
              onChange={(e) => setBiografia(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Escribe algo sobre tus géneros favoritos, plataformas o juegos de tu infancia..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
            />
            <span className="text-[11px] text-zinc-500">{biografia.length} / 300 caracteres</span>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {guardando ? 'Guardando cambios...' : 'Guardar Perfil'}
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-300 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Moneda local</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Los precios de ofertas y de la ficha se convierten desde USD a tu moneda. Se guarda solo en este navegador.
          </p>
        </div>
        <label className="block text-xs font-semibold text-zinc-300">
          Moneda de visualización
          <select
            value={moneda}
            onChange={(e) => handleMoneda(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            {MONEDAS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-300 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Catálogo Universal de Juegos (APIs)</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Puedes vincular tus claves personales gratuitas de RAWG o IGDB para búsquedas más rápidas y exhaustivas. Se guardan solo en este navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${keysInfo.hasRawg ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span>RAWG: {keysInfo.hasRawg ? 'Conectado' : 'No configurado'}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${keysInfo.hasIgdb ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
            <span>IGDB: {keysInfo.hasIgdb ? 'Conectado' : 'No configurado'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowKeysModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300"
        >
          Gestionar mis claves de catálogo ⚙
        </button>
      </section>

      <ApiKeysModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onSaved={checkKeys}
      />
    </div>
  );
}
