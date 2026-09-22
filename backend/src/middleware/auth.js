import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'gametracker-dev-secret';

export function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, username: usuario.username },
    SECRET,
    { expiresIn: '7d' },
  );
}

export function requerirAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Inicia sesión para continuar' });
    return;
  }
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'La sesión expiró. Vuelve a entrar' });
  }
}
