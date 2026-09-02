// ─────────────────────────────────────────────────────────────────────────────
// Sync tracker — conta as escritas para o Firebase (RTDB + Firestore) que estão
// "em voo" (enviadas, mas ainda sem ack do servidor).

// Quando o app está offline, as escritas ficam enfileiradas aqui. Quando a
// conexão volta, cada ack diminui a contagem — e é isso que vira a
// PERCENTAGEM REAL do banner "Sincronizando..." em cima do app.
// ─────────────────────────────────────────────────────────────────────────────

let pending = 0;
const listeners = new Set<(count: number) => void>();

function emit() {
  for (const listener of listeners) listener(pending);
}

/**
 * Envolve a Promise de uma escrita (set/update/delete): incrementa o contador
 * ao enviar e decrementa quando o servidor dá ack (ou em erro).
 */
export function trackWrite<T>(promise: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return promise.finally(() => {
    pending -= 1;
    emit();
  });
}

/** Quantas escritas estão em voo (aguardando ack do servidor). */
export function pendingWrites(): number {
  return pending;
}

/** Assina mudanças na contagem de pendentes. Retorna a função de unsubscribe. */
export function onPendingWritesChange(listener: (count: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
