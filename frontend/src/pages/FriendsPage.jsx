import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import Avatar from '../components/Avatar';

export default function FriendsPage() {
  const [tab, setTab] = useState('amigos'); // 'amigos' | 'solicitudes' | 'buscar'
  const [datosAmistad, setDatosAmistad] = useState({ amigos: [], solicitudesRecibidas: [], solicitudesEnviadas: [] });
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [aviso, setAviso] = useState('');

  function cargarAmistades() {
    API.get('/social/amigos')
      .then(({ data }) => setDatosAmistad(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarAmistades();
  }, []);

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setResultados([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setBuscando(true);
      API.get('/usuarios/buscar', { params: { q } })
        .then(({ data }) => setResultados(data))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda]);

  async function handleEnviarSolicitud(idUsuario) {
    setAccionando(true);
    setAviso('');
    try {
      await API.post(`/social/solicitar/${idUsuario}`);
      setAviso('Solicitud enviada con éxito');
      cargarAmistades();
    } catch (err) {
      setAviso(err?.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setAccionando(false);
    }
  }

  async function handleResponder(idAmistad, accion) {
    setAccionando(true);
    try {
      await API.patch(`/social/solicitudes/${idAmistad}`, { accion });
      cargarAmistades();
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al responder solicitud');
    } finally {
      setAccionando(false);
    }
  }

  async function handleEliminar(idAmistad) {
    if (!window.confirm('¿Seguro que deseas eliminar o cancelar esta amistad?')) return;
    setAccionando(true);
    try {
      await API.delete(`/social/amigos/${idAmistad}`);
      cargarAmistades();
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al eliminar');
    } finally {
      setAccionando(false);
    }
  }

  const { amigos, solicitudesRecibidas, solicitudesEnviadas } = datosAmistad;
  const totalSolicitudes = solicitudesRecibidas.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Comunidad y Amigos</h1>
        <p className="mt-1 text-sm text-zinc-400">Encuentra a otros jugadores, comparte bibliotecas y sigue su progreso.</p>
      </div>

      {aviso && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300">
          {aviso}
        </p>
      )}

      {/* Pestañas */}
      <div className="flex gap-2 rounded-2xl bg-zinc-900/60 p-1.5 border border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('amigos')}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            tab === 'amigos' ? 'bg-amber-400 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Mis Amigos ({amigos.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('solicitudes')}
          className={`relative flex-1 rounded-xl py-2 text-xs font-bold transition ${
            tab === 'solicitudes' ? 'bg-amber-400 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Solicitudes
          {totalSolicitudes > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
              {totalSolicitudes}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('buscar')}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            tab === 'buscar' ? 'bg-amber-400 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Buscar Jugadores 🔍
        </button>
      </div>

      {/* 1. PESTAÑA AMIGOS */}
      {tab === 'amigos' && (
        <section className="space-y-3">
          {loading ? (
            <p className="py-12 text-center text-xs text-zinc-500">Cargando lista de amigos...</p>
          ) : amigos.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <p className="text-sm text-zinc-400 font-medium">Aún no tienes amigos agregados.</p>
              <p className="mt-1 text-xs text-zinc-500">Usa el buscador para conectar con otros usuarios de GameTracker.</p>
              <button
                type="button"
                onClick={() => setTab('buscar')}
                className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-300"
              >
                Buscar jugadores
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {amigos.map(({ idAmistad, amigo }) => (
                <div
                  key={idAmistad}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700"
                >
                  <Link to={`/perfil/${amigo.username}`} className="flex items-center gap-3">
                    <Avatar
                      perfil={amigo}
                      className="h-12 w-12 text-lg"
                      rounded="rounded-xl"
                      fallbackClassName="bg-amber-400 font-black text-zinc-950"
                    />
                    <div>
                      <p className="font-bold text-white hover:text-amber-400 transition">{amigo.nombre}</p>
                      <p className="text-xs text-zinc-400">@{amigo.username}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/perfil/${amigo.username}`}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                    >
                      Ver Perfil
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleEliminar(idAmistad)}
                      className="rounded-lg p-1.5 text-xs text-zinc-500 hover:text-rose-400"
                      title="Eliminar amigo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. PESTAÑA SOLICITUDES */}
      {tab === 'solicitudes' && (
        <section className="space-y-6">
          {/* Recibidas */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Solicitudes Recibidas ({solicitudesRecibidas.length})
            </h2>
            {solicitudesRecibidas.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No tienes solicitudes pendientes por responder.</p>
            ) : (
              <div className="space-y-2">
                {solicitudesRecibidas.map(({ idAmistad, solicitante }) => (
                  <div
                    key={idAmistad}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <Link to={`/perfil/${solicitante.username}`} className="flex items-center gap-3">
                      <Avatar
                        perfil={solicitante}
                        className="h-10 w-10 text-sm"
                        rounded="rounded-xl"
                        fallbackClassName="bg-amber-400 font-black text-zinc-950"
                      />
                      <div>
                        <p className="font-bold text-white">{solicitante.nombre}</p>
                        <p className="text-xs text-zinc-400">@{solicitante.username}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResponder(idAmistad, 'aceptar')}
                        disabled={accionando}
                        className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResponder(idAmistad, 'rechazar')}
                        disabled={accionando}
                        className="rounded-xl border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enviadas */}
          <div className="space-y-3 border-t border-zinc-800 pt-6">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
              Solicitudes Enviadas ({solicitudesEnviadas.length})
            </h2>
            {solicitudesEnviadas.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No has enviado solicitudes pendientes.</p>
            ) : (
              <div className="space-y-2">
                {solicitudesEnviadas.map(({ idAmistad, receptor }) => (
                  <div
                    key={idAmistad}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        perfil={receptor}
                        className="h-10 w-10 text-sm"
                        rounded="rounded-xl"
                        fallbackClassName="bg-zinc-800 font-bold text-zinc-300"
                      />
                      <div>
                        <p className="font-bold text-zinc-300">{receptor.nombre}</p>
                        <p className="text-xs text-zinc-500">@{receptor.username} · Pendiente</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminar(idAmistad)}
                      className="rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:text-rose-400"
                    >
                      Cancelar solicitud
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. PESTAÑA BUSCAR JUGADORES */}
      {tab === 'buscar' && (
        <section className="space-y-4">
          <div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o @username..."
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              autoFocus
            />
          </div>

          {buscando && <p className="text-center text-xs text-zinc-500">Buscando jugadores...</p>}

          {busqueda.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
              No se encontraron jugadores que coincidan con &quot;{busqueda}&quot;.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {resultados.map((u) => {
              const yaEsAmigo = amigos.some((a) => a.amigo.id === u.id);
              const solicitudEnviada = solicitudesEnviadas.some((s) => s.receptor.id === u.id);
              const solicitudRecibida = solicitudesRecibidas.some((s) => s.solicitante.id === u.id);

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <Link to={`/perfil/${u.username}`} className="flex items-center gap-3">
                    <Avatar
                      perfil={u}
                      className="h-11 w-11 text-sm"
                      rounded="rounded-xl"
                      fallbackClassName="bg-amber-400 font-black text-zinc-950"
                    />
                    <div>
                      <p className="font-bold text-white hover:text-amber-400 transition">{u.nombre}</p>
                      <p className="text-xs text-zinc-400">@{u.username} · {u._count?.juegos || 0} juegos</p>
                    </div>
                  </Link>

                  <div>
                    {yaEsAmigo ? (
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
                        Amigos
                      </span>
                    ) : solicitudEnviada ? (
                      <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                        Enviada
                      </span>
                    ) : solicitudRecibida ? (
                      <button
                        type="button"
                        onClick={() => setTab('solicitudes')}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Responder
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnviarSolicitud(u.id)}
                        disabled={accionando}
                        className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
                      >
                        + Añadir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
