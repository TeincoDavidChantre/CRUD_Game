function iniciales(perfil) {
  const base = String(perfil?.nombre || perfil?.username || '?').trim();
  return base.charAt(0).toUpperCase() || '?';
}

/**
 * Avatar de usuario: foto si hay URL, si no la inicial.
 * @param {object} props
 * @param {{ avatar?: string, nombre?: string, username?: string } | null} props.perfil
 * @param {string} [props.className] tamaño y tipografía
 * @param {string} [props.rounded] clases de radio (p. ej. rounded-full, rounded-2xl)
 * @param {string} [props.fallbackClassName] estilo del placeholder con inicial
 */
export default function Avatar({
  perfil,
  className = 'h-9 w-9 text-sm',
  rounded = 'rounded-full',
  fallbackClassName = 'bg-zinc-800 font-bold text-amber-300',
}) {
  const shape = `${className} ${rounded}`;

  if (perfil?.avatar) {
    return (
      <img
        src={perfil.avatar}
        alt=""
        className={`${shape} object-cover bg-zinc-900`}
      />
    );
  }

  return (
    <span
      className={`${shape} inline-flex items-center justify-center ${fallbackClassName}`}
      aria-hidden="true"
    >
      {iniciales(perfil)}
    </span>
  );
}
