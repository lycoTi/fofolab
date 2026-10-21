/**
 * Gera IDs únicos e estáveis entre PCs (UUID v4 com prefixo legível, ex: `topic-3f2a…`).
 * Substitui o antigo `${prefix}-${Date.now()}`, que colidia ao criar vários registros
 * no mesmo milissegundo (importações em lote) e não servia para mesclar bancos de PCs diferentes.
 */
export function newId(prefix: string): string {
  return `${prefix}-${randomUuid()}`;
}

function randomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  // Fallback RFC 4122 v4 para ambientes sem randomUUID (contexto não seguro)
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
