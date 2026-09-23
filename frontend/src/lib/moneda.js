import { useEffect, useState } from 'react';

const CLAVE = 'gametracker_moneda';
const CLAVE_TASAS = 'gametracker_fx_usd_v2';

export const MONEDAS = [
  { code: 'USD', label: 'Dólar (USD)', locale: 'en-US' },
  { code: 'EUR', label: 'Euro (EUR)', locale: 'es-ES' },
  { code: 'COP', label: 'Peso colombiano (COP)', locale: 'es-CO' },
  { code: 'MXN', label: 'Peso mexicano (MXN)', locale: 'es-MX' },
  { code: 'ARS', label: 'Peso argentino (ARS)', locale: 'es-AR' },
  { code: 'CLP', label: 'Peso chileno (CLP)', locale: 'es-CL' },
  { code: 'PEN', label: 'Sol peruano (PEN)', locale: 'es-PE' },
  { code: 'BRL', label: 'Real brasileño (BRL)', locale: 'pt-BR' },
  { code: 'GBP', label: 'Libra (GBP)', locale: 'en-GB' },
];

export function obtenerMoneda() {
  try {
    const c = localStorage.getItem(CLAVE);
    if (c && MONEDAS.some((m) => m.code === c)) return c;
  } catch {
    /* ignore */
  }
  return 'USD';
}

export function guardarMoneda(code) {
  const ok = MONEDAS.some((m) => m.code === code) ? code : 'USD';
  try {
    localStorage.setItem(CLAVE, ok);
  } catch {
    /* ignore */
  }
  return ok;
}

function localeDe(code) {
  return MONEDAS.find((m) => m.code === code)?.locale || 'en-US';
}

/** Formatea un monto ya en la moneda destino. */
export function formatearMonto(valor, currency = obtenerMoneda()) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  try {
    return new Intl.NumberFormat(localeDe(currency), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'COP' || currency === 'CLP' || currency === 'JPY' ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function tasasCompletas(rates) {
  if (!rates || typeof rates !== 'object') return false;
  return MONEDAS.every((m) => m.code === 'USD' || Number(rates[m.code]) > 0);
}

async function cargarTasasUsd({ forzar = false } = {}) {
  if (!forzar) {
    try {
      const raw = localStorage.getItem(CLAVE_TASAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.expira > Date.now() && tasasCompletas(parsed?.rates)) {
          return { USD: 1, ...parsed.rates };
        }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('fx');
    const data = await res.json();
    const rawRates = data?.rates || {};
    const rates = { USD: 1 };
    for (const m of MONEDAS) {
      if (m.code === 'USD') continue;
      const r = Number(rawRates[m.code]);
      if (Number.isFinite(r) && r > 0) rates[m.code] = r;
    }
    if (!tasasCompletas(rates)) throw new Error('fx-incomplete');
    try {
      localStorage.setItem(
        CLAVE_TASAS,
        JSON.stringify({ rates, expira: Date.now() + 6 * 60 * 60 * 1000 }),
      );
    } catch {
      /* ignore */
    }
    return rates;
  } catch {
    return { USD: 1 };
  }
}

let tasasPromise = null;

export async function obtenerTasasUsd({ forzar = false } = {}) {
  if (forzar) tasasPromise = null;
  if (!tasasPromise) {
    tasasPromise = cargarTasasUsd({ forzar }).finally(() => {
      setTimeout(() => {
        tasasPromise = null;
      }, 60_000);
    });
  }
  return tasasPromise;
}

/** Convierte USD → moneda local. */
export function convertirDesdeUsd(usd, rates, currency = obtenerMoneda()) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) return null;
  if (currency === 'USD') return n;
  const rate = Number(rates?.[currency]);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return n * rate;
}

export async function formatearDesdeUsd(usd, currency = obtenerMoneda()) {
  const rates = await obtenerTasasUsd();
  const convertido = convertirDesdeUsd(usd, rates, currency);
  return formatearMonto(convertido != null ? convertido : Number(usd), convertido != null ? currency : 'USD');
}

/** Formatea precio USD con tasas ya cargadas. */
export function formatearUsdConTasas(usd, rates, currency = obtenerMoneda()) {
  const convertido = convertirDesdeUsd(usd, rates, currency);
  if (convertido == null) {
    return formatearMonto(Number(usd), 'USD');
  }
  return formatearMonto(convertido, currency);
}

/**
 * Precio de oferta/tienda: si ya viene en la moneda del usuario (p. ej. COP de Epic CO),
 * se formatea tal cual. Si viene en USD (CheapShark), se convierte.
 */
export function formatearPrecioOferta(monto, monedaFuente, rates, currency = obtenerMoneda()) {
  if (monto == null || monto === '') return null;
  const n = Number(monto);
  if (!Number.isFinite(n) || n < 0) return null;
  const fuente = String(monedaFuente || 'USD').toUpperCase();
  const dest = String(currency || 'USD').toUpperCase();
  if (fuente === dest) return formatearMonto(n, dest);
  if (fuente === 'USD') return formatearUsdConTasas(n, rates, dest);
  // Fuente regional distinta (p. ej. MXN → COP): pasar por USD si hay tasas
  const rateFuente = Number(rates?.[fuente]);
  const rateDest = Number(rates?.[dest]);
  if (Number.isFinite(rateFuente) && rateFuente > 0 && Number.isFinite(rateDest) && rateDest > 0) {
    const enUsd = n / rateFuente;
    return formatearMonto(enUsd * rateDest, dest);
  }
  return formatearMonto(n, fuente);
}

/**
 * Moneda local + tasas para cualquier pantalla de precios.
 * Relee al enfocar la ventana (tras cambiar Settings).
 */
export function useMonedaLocal() {
  const [moneda, setMoneda] = useState(() => obtenerMoneda());
  const [tasas, setTasas] = useState({ USD: 1 });
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let active = true;
    function sync({ forzar = false } = {}) {
      setMoneda(obtenerMoneda());
      obtenerTasasUsd({ forzar }).then((r) => {
        if (!active) return;
        setTasas(r || { USD: 1 });
        setListo(true);
      });
    }
    sync({ forzar: true });
    function onFocus() {
      sync({ forzar: false });
    }
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  function fmt(usd) {
    if (usd == null || usd === '') return null;
    return formatearUsdConTasas(usd, tasas, moneda);
  }

  /** Precio de item de oferta (respeta moneda de la tienda). */
  function fmtOferta(monto, monedaFuente = 'USD') {
    return formatearPrecioOferta(monto, monedaFuente, tasas, moneda);
  }

  return {
    moneda,
    tasas,
    listo,
    fmt,
    fmtOferta,
    tieneTasa: moneda === 'USD' || Number(tasas?.[moneda]) > 0,
  };
}
