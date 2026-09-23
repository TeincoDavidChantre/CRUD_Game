import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import Avatar from '../components/Avatar';
import CoverTile from '../components/CoverTile';
import FichaDialog from '../components/FichaDialog';
import { desdeBiblioteca } from '../lib/fichas';

export default function ProfilePage() {
  const { username } = useParams();
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [ficha, setFicha] = useState(null);
  const [accionando, setAccionando] = useState(false);

  function cargarPerfil() {
    setLoading(true);
    API.get(`/usuarios/${username}`)
      .then(({ data }) => setDatos(data))
      .catch((err) => setError(err?.response?.data?.error || 'No se pudo cargar el perfil'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarPerfil();
  }, [username]);

  async function handleSolicitar() {
    if (!datos?.usuario?.id) return;
    setAccionando(true);
    try {
      await API.post(`/social/solicitar/${datos.usuario.id}`);
      cargarPerfil();
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setAccionando(false);
    }
  }

  async function handleResponder(accion) {
    if (!datos?.relacionAmistad?.id) return;
    setAccionando(true);
    try {
      await API.patch(`/social/solicitudes/${datos.relacionAmistad.id}`, { accion });
      cargarPerfil();
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al responder solicitud');
    } finally {
      setAccionando(false);
    }
  }

  async function handleEliminarAmigo() {
    if (!datos?.relacionAmistad?.id || !window.confirm('¿Deseas eliminar a este amigo?')) return;
    setAccionando(true);
    try {
      await API.delete(`/social/amigos/${datos.relacionAmistad.id}`);
      cargarPerfil();
    } catch (err) {
      alert(err?.response?.data?.error || 'Error al eliminar amistad');
    } finally {
      setAccionando(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-zinc-400">Cargando perfil...</div>;
  }

  if (error || !datos) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-rose-400">{error || 'Perfil no disponible'}</p>
        <Link to="/" className="mt-4 inline-block text-xs font-semibold text-amber-400 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const { usuario, juegos, esMio, relacionAmistad } = datos;
  const completados = juegos.filter((j) => j.estado === 'COMPLETADO');
  const jugando = juegos.filter((j) => j.estado === 'JUGANDO');
  const pendientes = juegos.filter((j) => j.estado === 'PENDIENTE');

  const juegosFiltrados = filtro === 'TODOS'
    ? juegos
    : juegos.filter((j) => j.estado === filtro);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Tarjeta de Encabezado del Perfil */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <Avatar
              perfil={usuario}
              className="h-24 w-24 text-3xl shadow-lg"
              rounded="rounded-2xl"
              fallbackClassName="bg-amber-400 font-black text-zinc-950"
            />
            <div>
              <h1 className="text-2xl font-black text-white sm:text-3xl">{usuario.nombre}</h1>
              <p className="text-sm font-semibold text-amber-400">@{usuario.username}</p>
              {usuario.biografia && <p className="mt-2 max-w-md text-xs text-zinc-300">{usuario.biografia}</p>}
              <p className="mt-2 text-[11px] text-zinc-500">
                Miembro desde {new Date(usuario.creadoEn).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Botones de acción social */}
          <div>
            {esMio ? (
              <Link
                to="/configuracion"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700"
              >
                Editar Perfil ⚙
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {!relacionAmistad && (
                  <button
                    type="button"
                    onClick={handleSolicitar}
                    disabled={accionando}
                    className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {accionando ? 'Enviando...' : '+ Añadir a amigos'}
                  </button>
                )}
                {relacionAmistad?.estado === 'PENDIENTE' && (
                  relacionAmistad.esEmisor ? (
                    <span className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                      Solicitud enviada (Pendiente)
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResponder('aceptar')}
                        disabled={accionando}
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Aceptar solicitud
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResponder('rechazar')}
                        disabled={accionando}
                        className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                      >
                        Rechazar
                      </button>
                    </div>
                  )
                )}
                {relacionAmistad?.estado === 'ACEPTADA' && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
                      Amigos ✓
                    </span>
                    <button
                      type="button"
                      onClick={handleEliminarAmigo}
                      disabled={accionando}
                      className="rounded-xl px-2 py-2 text-xs text-zinc-500 hover:text-rose-400"
                      title="Eliminar de mis amigos"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resumen de Estadísticas */}
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-4">
          <div className="rounded-2xl bg-zinc-950/60 p-4 text-center">
            <span className="block text-2xl font-black text-white">{juegos.length}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Total Juegos</span>
          </div>
          <div className="rounded-2xl bg-zinc-950/60 p-4 text-center">
            <span className="block text-2xl font-black text-emerald-400">{completados.length}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Completados</span>
          </div>
          <div className="rounded-2xl bg-zinc-950/60 p-4 text-center">
            <span className="block text-2xl font-black text-amber-400">{jugando.length}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Jugando</span>
          </div>
          <div className="rounded-2xl bg-zinc-950/60 p-4 text-center">
            <span className="block text-2xl font-black text-zinc-300">{pendientes.length}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pendientes</span>
          </div>
        </div>
      </section>

      {/* Estantería de Juegos */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-white">Biblioteca de {usuario.nombre}</h2>
          <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-900 p-1 text-xs">
            {['TODOS', 'JUGANDO', 'COMPLETADO', 'PENDIENTE', 'ABANDONADO'].map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setFiltro(opcion)}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  filtro === opcion ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opcion}
              </button>
            ))}
          </div>
        </div>

        {juegosFiltrados.length === 0 ? (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
            No hay juegos con este estado en la biblioteca.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {juegosFiltrados.map((j) => (
              <CoverTile
                key={j.id}
                titulo={j.tituloJuego}
                portada={j.urlPortada}
                estado={j.estado}
                nota={j.calificacion}
                onClick={() => setFicha(desdeBiblioteca(j))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal de Ficha si hace clic en un juego */}
      {ficha && (
        <FichaDialog
          item={ficha}
          onClose={() => setFicha(null)}
        />
      )}
    </div>
  );
}
