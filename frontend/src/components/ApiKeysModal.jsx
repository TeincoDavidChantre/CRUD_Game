import { useState } from 'react';

export default function ApiKeysModal({ isOpen, onClose, onSaved }) {
  const [tab, setTab] = useState('rawg');
  const [rawgKey, setRawgKey] = useState(() => localStorage.getItem('gametracker_rawg_key') || '');
  const [igdbClientId, setIgdbClientId] = useState(() => localStorage.getItem('gametracker_igdb_client_id') || '');
  const [igdbClientSecret, setIgdbClientSecret] = useState(() => localStorage.getItem('gametracker_igdb_client_secret') || '');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [copiado, setCopiado] = useState(false);

  const urlApp = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5175';

  if (!isOpen) return null;

  async function copiarUrl() {
    try {
      await navigator.clipboard.writeText(urlApp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setMensaje({ tipo: 'info', texto: `Copia manualmente: ${urlApp}` });
    }
  }

  function handleGuardar(e) {
    e.preventDefault();
    if (rawgKey.trim()) {
      localStorage.setItem('gametracker_rawg_key', rawgKey.trim());
    } else {
      localStorage.removeItem('gametracker_rawg_key');
    }

    if (igdbClientId.trim() && igdbClientSecret.trim()) {
      localStorage.setItem('gametracker_igdb_client_id', igdbClientId.trim());
      localStorage.setItem('gametracker_igdb_client_secret', igdbClientSecret.trim());
    } else {
      localStorage.removeItem('gametracker_igdb_client_id');
      localStorage.removeItem('gametracker_igdb_client_secret');
    }

    localStorage.setItem('gametracker_keys_configured', 'true');
    setMensaje({ tipo: 'exito', texto: '¡Claves guardadas localmente con éxito en este dispositivo!' });
    
    setTimeout(() => {
      onSaved?.();
      onClose?.();
    }, 900);
  }

  function handleOmitir() {
    localStorage.setItem('gametracker_keys_configured', 'true');
    onClose?.();
  }

  function handleLimpiar() {
    localStorage.removeItem('gametracker_rawg_key');
    localStorage.removeItem('gametracker_igdb_client_id');
    localStorage.removeItem('gametracker_igdb_client_secret');
    setRawgKey('');
    setIgdbClientId('');
    setIgdbClientSecret('');
    setMensaje({ tipo: 'info', texto: 'Claves eliminadas de este dispositivo.' });
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Catálogo Universal</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Configura tus claves de acceso. Se guardan <span className="font-semibold text-amber-400">solo en tu navegador</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Pestañas RAWG / IGDB */}
        <div className="mt-4 flex rounded-lg bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setTab('rawg')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              tab === 'rawg' ? 'bg-amber-400 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            RAWG (Recomendada - 1 min)
          </button>
          <button
            type="button"
            onClick={() => setTab('igdb')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              tab === 'igdb' ? 'bg-amber-400 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            IGDB / Twitch (Avanzado)
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} className="mt-4 space-y-4">
          {tab === 'rawg' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                <p className="font-medium">¿Cómo obtenerla gratis en 1 minuto?</p>
                <ol className="mt-1.5 list-outside ml-4 list-decimal space-y-1.5 text-zinc-300">
                  <li>Haz clic abajo para abrir el portal de RAWG.</li>
                  <li>Inicia sesión o regístrate (Google/Email).</li>
                  <li>
                    En el formulario de desarrollador, cuando pida la URL / sitio web de la app, pega esta:
                    <span className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[11px] text-amber-200">
                        {urlApp}
                      </code>
                      <button
                        type="button"
                        onClick={copiarUrl}
                        className="shrink-0 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-700"
                      >
                        {copiado ? 'Copiado' : 'Copiar'}
                      </button>
                    </span>
                  </li>
                  <li>Guarda, copia tu API Key y pégala aquí abajo.</li>
                </ol>
                <a
                  href="https://rawg.io/apidocs"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-amber-300"
                >
                  Abrir portal de clave RAWG ↗
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">
                  RAWG API Key
                </label>
                <input
                  type="text"
                  value={rawgKey}
                  onChange={(e) => setRawgKey(e.target.value)}
                  placeholder="ej. 3a7b9c1d..."
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {tab === 'igdb' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-200">
                <p className="font-medium">Para usuarios avanzados con Twitch Developer:</p>
                <ol className="mt-1.5 list-inside list-decimal space-y-1 text-zinc-300">
                  <li>Registra una aplicación en la consola de Twitch.</li>
                  <li>Copia el Client ID y genera un Client Secret.</li>
                </ol>
                <a
                  href="https://dev.twitch.tv/console/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400"
                >
                  Abrir consola Twitch Dev ↗
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">Twitch Client ID</label>
                <input
                  type="text"
                  value={igdbClientId}
                  onChange={(e) => setIgdbClientId(e.target.value)}
                  placeholder="Client ID..."
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300">Twitch Client Secret</label>
                <input
                  type="password"
                  value={igdbClientSecret}
                  onChange={(e) => setIgdbClientSecret(e.target.value)}
                  placeholder="Client Secret..."
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {mensaje.texto && (
            <p className={`rounded-lg px-3 py-2 text-xs font-medium ${
              mensaje.tipo === 'exito' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-300'
            }`}>
              {mensaje.texto}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleOmitir}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Omitir por ahora
            </button>
            <div className="flex items-center gap-2">
              {(rawgKey || igdbClientId) && (
                <button
                  type="button"
                  onClick={handleLimpiar}
                  className="rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  Borrar claves
                </button>
              )}
              <button
                type="submit"
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300"
              >
                Guardar en mi navegador
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
