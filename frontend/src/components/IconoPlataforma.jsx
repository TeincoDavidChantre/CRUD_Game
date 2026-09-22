import {
  SiAndroid,
  SiApple,
  SiAppstore,
  SiEpicgames,
  SiLinux,
  SiMacos,
  SiPlaystation,
  SiPlaystation2,
  SiPlaystation3,
  SiPlaystation4,
  SiPlaystation5,
  SiPlaystationportable,
  SiPlaystationvita,
  SiSteam,
} from '@icons-pack/react-simple-icons';

function Svg({ size, className, children }) {
  return (
    <svg role="img" aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      {children}
    </svg>
  );
}

// Simple Icons retiró las marcas de Microsoft y Nintendo, así que estos logos van dibujados aquí.
function IconoXbox({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 0a12 12 0 0 0-7.9 2.97c2.2-1 5.55 1.2 7.9 3.4 2.35-2.2 5.7-4.4 7.9-3.4A12 12 0 0 0 12 0zM2.87 4.4A12 12 0 0 0 .13 13.6c.6-2.6 3.5-6.3 6.3-9.1-1.4-.6-2.8-.6-3.56-.1zm18.26 0c-.76-.5-2.16-.5-3.56.1 2.8 2.8 5.7 6.5 6.3 9.1a12 12 0 0 0-2.74-9.2zM12 8.6c-3.1 3.2-7.9 9.2-6.6 11.5A12 12 0 0 0 12 24a12 12 0 0 0 6.6-3.9c1.3-2.3-3.5-8.3-6.6-11.5z" />
    </Svg>
  );
}

function IconoSwitch({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M7.2 1.5h3.1v21H7.2A5.7 5.7 0 0 1 1.5 16.8V7.2A5.7 5.7 0 0 1 7.2 1.5zm0 1.8A3.9 3.9 0 0 0 3.3 7.2v9.6a3.9 3.9 0 0 0 3.9 3.9h1.3V3.3H7.2zm-.4 2.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM13.7 1.5h3.1a5.7 5.7 0 0 1 5.7 5.7v9.6a5.7 5.7 0 0 1-5.7 5.7h-3.1v-21zm3.5 11.1a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" />
    </Svg>
  );
}

/** Logo de marca Nintendo (óvalo), distinto del icono de consola Switch. */
function IconoNintendo({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M0 7.5A7.5 7.5 0 0 1 7.5 0h9A7.5 7.5 0 0 1 24 7.5v9a7.5 7.5 0 0 1-7.5 7.5h-9A7.5 7.5 0 0 1 0 16.5v-9zm3.4 1.2v6.6h2.1V12l2.3 3.3h.4l2.3-3.3v3.3h2.1V8.7H9.8L7.6 12 5.5 8.7H3.4zm10.2 0c-2 0-3.3 1.2-3.3 3.3s1.3 3.3 3.3 3.3c1.2 0 2.1-.4 2.7-1.1l-1.3-1.1c-.3.4-.8.6-1.4.6-.9 0-1.5-.6-1.5-1.7h4.6v-.3c0-2.1-1.2-3.3-3.1-3.3zm0 1.5c.7 0 1.2.4 1.3 1.2h-2.6c.1-.8.6-1.2 1.3-1.2z" />
    </Svg>
  );
}

function IconoWindows({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M2.4 4.6 11 3.4v8.1H2.4V4.6zm0 14.8L11 20.6v-8H2.4v6.8zM12.1 3.2 23 1.7v9.8H12.1V3.2zm0 17.6L23 22.3v-9.7H12.1v8.2z" />
    </Svg>
  );
}

function IconoMicrosoftStore({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M4.6 2h14.8l2.1 4.6a3.1 3.1 0 0 1-2.9 1.9 3.1 3.1 0 0 1-2.6-1.4 3.1 3.1 0 0 1-2.6 1.4 3.1 3.1 0 0 1-2.6-1.4 3.1 3.1 0 0 1-2.6 1.4A3.1 3.1 0 0 1 2.5 6.6L4.6 2zm-.7 7.9a4.9 4.9 0 0 0 1.5.6V21a1 1 0 0 0 1 1h11.2a1 1 0 0 0 1-1V10.5a4.9 4.9 0 0 0 1.5-.6V21a2.9 2.9 0 0 1-2.5 2.9v.1H6.4A2.9 2.9 0 0 1 3.9 21V9.9zM8.7 11.7h2.4v2.4H8.7v-2.4zm4.2 0h2.4v2.4h-2.4v-2.4zm-4.2 4.2h2.4v2.4H8.7v-2.4zm4.2 0h2.4v2.4h-2.4v-2.4z" />
    </Svg>
  );
}

function IconoArcade({ size = 16, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 2h12a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v6h14V5a1 1 0 0 0-1-1H6zm1.5 2.5h3v1.2h-3V6.5zM15 6a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 15 6zM5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6H5zm3.2 1.8h1.6v1.4h1.4v1.6H9.8v1.4H8.2v-1.4H6.8v-1.6h1.4v-1.4zm7 .2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z" />
    </Svg>
  );
}

const EXACTOS = {
  'PS5': SiPlaystation5,
  'PS4': SiPlaystation4,
  'PS3': SiPlaystation3,
  'PS2': SiPlaystation2,
  'PS Vita': SiPlaystationvita,
  'PSP': SiPlaystationportable,
  'PlayStation': SiPlaystation,
  'Steam': SiSteam,
  'Epic Games': SiEpicgames,
  'App Store': SiAppstore,
  'iOS': SiApple,
  'Mac': SiMacos,
  'Android': SiAndroid,
  'Linux': SiLinux,
  'Windows': IconoWindows,
  'Microsoft Store': IconoMicrosoftStore,
  'Switch': IconoSwitch,
  'Switch 2': IconoSwitch,
  'Nintendo': IconoNintendo,
  'Wii U': IconoNintendo,
  'Wii': IconoNintendo,
  'New 3DS': IconoNintendo,
  '3DS': IconoNintendo,
  'DS': IconoNintendo,
  'GameCube': IconoNintendo,
  'N64': IconoNintendo,
  'SNES': IconoNintendo,
  'NES': IconoNintendo,
  'Game Boy Advance': IconoNintendo,
  'Game Boy Color': IconoNintendo,
  'Game Boy': IconoNintendo,
  'Xbox': IconoXbox,
  'PC': IconoWindows,
  'Móvil': SiAndroid,
};

// Identificadores de las estanterías de la biblioteca.
const ESTANTES = {
  playstation: SiPlaystation,
  xbox: IconoXbox,
  nintendo: IconoNintendo,
  pc: IconoWindows,
  movil: SiAndroid,
  otros: IconoArcade,
};

function porFamilia(etiqueta) {
  const texto = etiqueta.toLowerCase();
  if (ESTANTES[texto]) return ESTANTES[texto];
  if (texto.startsWith('ps') || texto.includes('playstation') || texto.includes('vita')) return SiPlaystation;
  if (texto.includes('xbox')) return IconoXbox;
  if (/switch\s*2|switch2/.test(texto) || texto === 'switch') return IconoSwitch;
  if (/wii|nintendo|3ds|\bds\b|gamecube|n64|snes|\bnes\b|game boy/.test(texto)) return IconoNintendo;
  if (texto.includes('app store') || texto.includes('ios')) return SiAppstore;
  if (texto.includes('windows') || texto.includes('microsoft') || texto === 'pc') return IconoWindows;
  if (texto.includes('steam')) return SiSteam;
  if (texto.includes('epic')) return SiEpicgames;
  if (texto.includes('android') || texto.includes('móvil') || texto.includes('movil')) return SiAndroid;
  if (texto.includes('linux')) return SiLinux;
  if (texto.includes('mac')) return SiMacos;
  if (texto.includes('arcade') || texto.includes('retro')) return IconoArcade;
  return null;
}

export function colorDe(etiqueta) {
  const texto = String(etiqueta || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (texto.startsWith('ps') || texto.includes('playstation') || texto.includes('vita')) return 'text-sky-400';
  if (texto.includes('xbox')) return 'text-emerald-400';
  if (texto === 'switch' || texto.includes('switch 2') || texto.includes('switch2')) return 'text-rose-500';
  if (/wii|nintendo|3ds|gamecube|n64|snes|\bnes\b|game boy|\bds\b/.test(texto)) return 'text-rose-400';
  if (texto.includes('android') || texto.includes('movil')) return 'text-[#3DDC84]';
  if (texto.includes('app store') || texto.includes('ios') || texto.includes('mac')) return 'text-zinc-200';
  if (texto.includes('epic')) return 'text-zinc-100';
  if (texto.includes('steam')) return 'text-sky-200';
  if (texto.includes('linux')) return 'text-amber-300';
  if (texto.includes('windows') || texto.includes('microsoft') || texto === 'pc') return 'text-sky-300';
  return 'text-amber-400';
}

export function iconoDe(etiqueta) {
  const nombre = String(etiqueta || '').trim();
  if (!nombre) return null;
  return EXACTOS[nombre] || porFamilia(nombre);
}

export default function IconoPlataforma({ etiqueta, size = 14, className = '' }) {
  const Icono = iconoDe(etiqueta);
  if (!Icono) return null;
  return <Icono size={size} className={className} />;
}

export function ListaPlataformas({ etiquetas = [], size = 14, className = '', itemClassName = '' }) {
  const lista = Array.isArray(etiquetas) ? etiquetas.filter(Boolean) : [];
  if (lista.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {lista.map((etiqueta) => (
        <span key={etiqueta} className={`inline-flex items-center gap-1.5 ${itemClassName}`}>
          <IconoPlataforma etiqueta={etiqueta} size={size} />
          {etiqueta}
        </span>
      ))}
    </span>
  );
}
