import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard';
import ConfirmDialog from '../components/ConfirmDialog';
import API from '../services/api';
import { PlusCircle, Gamepad2 } from 'lucide-react';

const STATUSES = ['PENDIENTE', 'JUGANDO', 'COMPLETADO', 'ABANDONADO'];
const EMPTY_FORM = { title: '', coverUrl: '', status: 'PENDIENTE' };
const SUCCESS_MS = 4000;

function toCard(juego) {
  return {
    id: juego.id,
    title: juego.tituloJuego,
    coverUrl: juego.urlPortada || '',
    status: juego.estado,
  };
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

export default function LibraryPage() {
  const [usuarioId, setUsuarioId] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [success]);

  async function loadGames(id) {
    const { data } = await API.get(`/juegos/${id}`);
    setGames(data.map(toCard));
  }

  useEffect(() => {
    let active = true;
    API.get('/usuarios/prueba')
      .then(async ({ data }) => {
        if (!active) return;
        setUsuarioId(data.id);
        await loadGames(data.id);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'No se pudo cargar la biblioteca'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError('El título es obligatorio');
      return;
    }

    const coverUrl = form.coverUrl.trim();
    if (coverUrl) {
      try {
        const parsed = new URL(coverUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setError('La portada debe ser una URL http o https');
          return;
        }
      } catch {
        setError('La portada debe ser una URL http o https');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await API.post('/juegos', {
        idUsuario: usuarioId,
        tituloJuego: title,
        urlPortada: coverUrl || null,
        estado: form.status,
      });
      setGames((current) => [toCard(data), ...current]);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setSuccess(`"${data.tituloJuego}" se agregó a tu biblioteca.`);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo agregar el juego'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusSelect(game, nextStatus) {
    if (nextStatus === game.status) return;

    const previous = games;
    setGames((current) =>
      current.map((item) => (item.id === game.id ? { ...item, status: nextStatus } : item)),
    );
    setPendingId(game.id);
    setError('');
    setSuccess('');

    try {
      const { data } = await API.patch(`/juegos/${game.id}`, { estado: nextStatus });
      setGames((current) =>
        current.map((item) => (item.id === game.id ? toCard(data) : item)),
      );
      setSuccess(`Estado de "${data.tituloJuego}" actualizado a ${data.estado}.`);
    } catch (err) {
      setGames(previous);
      setError(errorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setPendingId('');
    }
  }

  function requestDelete(game) {
    setDeleteTarget(game);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const game = deleteTarget;
    const previous = games;

    setPendingId(game.id);
    setError('');
    setSuccess('');
    setGames((current) => current.filter((item) => item.id !== game.id));

    try {
      await API.delete(`/juegos/${game.id}`);
      setDeleteTarget(null);
      setSuccess(`"${game.title}" se eliminó de tu biblioteca.`);
    } catch (err) {
      setGames(previous);
      setError(errorMessage(err, 'No se pudo eliminar el juego'));
    } finally {
      setPendingId('');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Mi Biblioteca</h1>
          <p className="text-slate-400 text-sm mt-1">Gestiona tu catálogo personal y seguimiento de progreso.</p>
        </div>

        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
        >
          <PlusCircle className="w-5 h-5" />
          <span>{formOpen ? 'Cerrar' : 'Agregar Juego'}</span>
        </button>
      </div>

      {success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5 sm:grid-cols-2"
        >
          <label className="grid gap-1 text-sm text-slate-300">
            Título
            <input
              name="title"
              value={form.title}
              onChange={updateField}
              required
              maxLength={120}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-300">
            URL de la portada
            <input
              name="coverUrl"
              value={form.coverUrl}
              onChange={updateField}
              maxLength={500}
              placeholder="https://"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-300">
            Estado inicial
            <select
              name="status"
              value={form.status}
              onChange={updateField}
              required
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !usuarioId}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar juego'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando biblioteca...</p>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 text-center">
          <div className="p-4 bg-slate-800 rounded-full text-slate-400 mb-4">
            <Gamepad2 className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Tu biblioteca está vacía</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-1">
            Aún no has añadido ningún videojuego. Comienza a organizar tu colección personal.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              statuses={STATUSES}
              busy={pendingId === game.id}
              onStatusSelect={handleStatusSelect}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar juego"
        description={
          deleteTarget
            ? `¿Quieres quitar "${deleteTarget.title}" de tu biblioteca? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        busy={Boolean(deleteTarget && pendingId === deleteTarget.id)}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (pendingId) return;
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
