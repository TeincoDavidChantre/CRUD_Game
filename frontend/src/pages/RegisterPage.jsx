import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';

const EMPTY = { nombre: '', username: '', email: '', password: '' };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await API.post('/auth/registro', form);
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo crear la cuenta');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid max-w-md gap-4 rounded-xl border border-zinc-700 bg-zinc-800/60 p-6">
      <div>
        <h1 className="text-2xl font-extrabold">Crear cuenta</h1>
        <p className="mt-1 text-sm text-zinc-400">Con esta cuenta guardas tu biblioteca de juegos.</p>
      </div>
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
      <label className="grid gap-1 text-sm text-zinc-300">
        Nombre
        <input name="nombre" value={form.nombre} onChange={updateField} required className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
      </label>
      <label className="grid gap-1 text-sm text-zinc-300">
        Usuario
        <input name="username" value={form.username} onChange={updateField} required minLength={3} maxLength={20} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
      </label>
      <label className="grid gap-1 text-sm text-zinc-300">
        Correo
        <input name="email" type="email" value={form.email} onChange={updateField} required className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
      </label>
      <label className="grid gap-1 text-sm text-zinc-300">
        Contraseña
        <input name="password" type="password" value={form.password} onChange={updateField} required minLength={8} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">
        {busy ? 'Creando...' : 'Crear cuenta'}
      </button>
      <p className="text-sm text-zinc-400">
        ¿Ya tienes cuenta? <Link to="/login" className="text-amber-400 hover:text-amber-300">Entra</Link>
      </p>
    </form>
  );
}
