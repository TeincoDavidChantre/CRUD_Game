import { colorDe, iconoDe } from './IconoPlataforma';

export default function PlatformIcon({ platform = '', className = 'w-4 h-4 inline-block fill-current', color = true }) {
  const Icono = iconoDe(platform);
  if (!Icono) return null;
  return <Icono size={16} className={`${className} ${color ? colorDe(platform) : ''}`.trim()} />;
}
