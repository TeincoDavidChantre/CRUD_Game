import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { firmarToken } from '../middleware/auth.js';

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

function perfilPublico(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    email: usuario.email,
    avatar: usuario.avatar || null,
    biografia: usuario.biografia || '',
  };
}

function validarRegistro(body) {
  const nombre = String(body?.nombre || '').trim();
  const username = String(body?.username || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (nombre.length < 2 || nombre.length > 80) {
    return { error: 'El nombre debe tener entre 2 y 80 caracteres' };
  }
  if (!USERNAME.test(username)) {
    return { error: 'El usuario debe tener de 3 a 20 letras, números o _' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'El correo no es válido' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' };
  }
  return { nombre, username, email, password };
}

export const registro = async (req, res) => {
  const datos = validarRegistro(req.body);
  if (datos.error) {
    res.status(400).json({ error: datos.error });
    return;
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        username: datos.username,
        email: datos.email,
        password: await bcrypt.hash(datos.password, 10),
      },
    });
    res.status(201).json({
      token: firmarToken(usuario),
      usuario: perfilPublico(usuario),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const destino = [].concat(error.meta?.target || []).join(' ');
      const campo = destino.includes('email') ? 'correo' : 'usuario';
      res.status(400).json({ error: `Ese ${campo} ya está registrado` });
      return;
    }
    console.error('Error en POST /api/auth/registro:', error);
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  }
};

export const login = async (req, res) => {
  const identificador = String(req.body?.identificador || '').trim();
  const password = String(req.body?.password || '');
  if (!identificador || !password) {
    res.status(400).json({ error: 'Indica tu usuario o correo y la contraseña' });
    return;
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: identificador.toLowerCase() },
          { username: identificador },
        ],
      },
    });
    const coincide = usuario && await bcrypt.compare(password, usuario.password);
    if (!coincide) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      return;
    }
    res.json({
      token: firmarToken(usuario),
      usuario: perfilPublico(usuario),
    });
  } catch (error) {
    console.error('Error en POST /api/auth/login:', error);
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
};

export const yo = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) {
      res.status(401).json({ error: 'La sesión ya no es válida' });
      return;
    }
    res.json(perfilPublico(usuario));
  } catch (error) {
    console.error('Error en GET /api/auth/yo:', error);
    res.status(500).json({ error: 'No se pudo cargar el perfil' });
  }
};

export const actualizarPerfil = async (req, res) => {
  const nombre = req.body?.nombre ? String(req.body.nombre).trim().slice(0, 80) : undefined;
  const biografia = req.body?.biografia != null ? String(req.body.biografia).trim().slice(0, 300) : undefined;
  const avatar = req.body?.avatar != null ? String(req.body.avatar).trim().slice(0, 500) : undefined;

  try {
    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: {
        ...(nombre ? { nombre } : {}),
        ...(biografia != null ? { biografia } : {}),
        ...(avatar != null ? { avatar } : {}),
      },
    });
    res.json(perfilPublico(usuario));
  } catch (error) {
    console.error('Error en PATCH /api/auth/perfil:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
};

