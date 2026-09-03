// ─────────────────────────────────────────────────────────────────────────────
// Sync tracker — conta as escritas para o Firebase (RTDB + Firestore) que estão
// "em voo" (enviadas, mas ainda sem ack do servidor).

// Quando o app está offline, as escritas ficam enfileiradas aqui. Quando a
// conexão volta, cada ack diminui a contagem — e é isso que vira a
// PERCENTAGEM REAL do banner "Sincronizando..." em cima do app.
// ─────────────────────────────────────────────────────────────────────────────

let pending = 0;
const listeners = new Set<(count: number) => void>();

// Tempo (ms) que a UI aguarda a confirmação do servidor por escrita antes de
// considerar "salvo localmente". Sem internet a confirmação nunca chega — o
// app NÃO trava: a escrita fica na fila (continuando a ser contada aqui) e
// é enviada sozinha quando a conexão volta (banner "Sincronizando... X%").
const WRITE_ACK_TIMEOUT_MS = 3000;

function emit() {
  for (const listener of listeners) listener(pending);
}

/**
 * Envolve a Promise de uma escrita (set/update/delete):
 * - incrementa o contador ao enviar e decrementa no ack REAL do servidor
 *   (é isso que alimenta a porcentagem de sincronização);
 * - a UI aguarda a confirmação por no máx. WRITE_ACK_TIMEOUT_MS — se o
 *   servidor não confirmar (ex: sem internet), resolve como "salvo local"
 *   e a escrita continua na fila até o ack de verdade.
 */
export function trackWrite<T>(promise: Promise<T>): Promise<T> {
  pending += 1;
  emit();

  // O contador segue a Promise real (ack do servidor)
  const done = promise.finally(() => {
    pending -= 1;
    emit();
  });
  // Evita "unhandled rejection" se o erro chegar depois do timeout da UI
  done.catch(() => {
    /* erro tardio: a UI já resolveu como "salvo local" via timeout */
  });

  const timeout = new Promise<undefined>((resolve) =>
    setTimeout(() => resolve(undefined), WRITE_ACK_TIMEOUT_MS)
  );

  return Promise.race([done, timeout]) as Promise<T>;
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
