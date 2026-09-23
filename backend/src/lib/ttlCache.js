/**
 * Caché en memoria con TTL. Suficiente para reducir cuota de APIs
 * entre recargas del mismo proceso Node.
 */
export function crearTtlCache({ max = 200 } = {}) {
  const store = new Map();

  function purgar() {
    const ahora = Date.now();
    for (const [clave, entrada] of store) {
      if (entrada.expira <= ahora) store.delete(clave);
    }
    while (store.size > max) {
      const primera = store.keys().next().value;
      store.delete(primera);
    }
  }

  return {
    get(clave) {
      const entrada = store.get(clave);
      if (!entrada) return undefined;
      if (entrada.expira <= Date.now()) {
        store.delete(clave);
        return undefined;
      }
      return entrada.valor;
    },
    set(clave, valor, ttlMs) {
      purgar();
      store.set(clave, { valor, expira: Date.now() + Math.max(1000, ttlMs) });
      return valor;
    },
    has(clave) {
      return this.get(clave) !== undefined;
    },
    delete(clave) {
      store.delete(clave);
    },
    clear() {
      store.clear();
    },
  };
}

/** Memoiza una promesa en vuelo para evitar thundering herd. */
export function memoizarAsync(fn, { ttlMs, keyFn, cache } = {}) {
  const memo = cache || crearTtlCache();
  const inflight = new Map();

  return async (...args) => {
    const clave = keyFn ? keyFn(...args) : JSON.stringify(args);
    const hit = memo.get(clave);
    if (hit !== undefined) return hit;

    if (inflight.has(clave)) return inflight.get(clave);

    const promesa = Promise.resolve()
      .then(() => fn(...args))
      .then((valor) => {
        memo.set(clave, valor, ttlMs);
        inflight.delete(clave);
        return valor;
      })
      .catch((err) => {
        inflight.delete(clave);
        throw err;
      });

    inflight.set(clave, promesa);
    return promesa;
  };
}
