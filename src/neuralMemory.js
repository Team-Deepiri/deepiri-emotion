/**
 * In-process neural memory (NeuralGPTOS-inspired): vector store with TTL and cosine similarity.
 * Used for local RAG/cache so the IDE can work offline or with less backend dependency.
 */

const MAX_EMBEDDING_DIM = 768;
const MAX_METADATA_SIZE = 4096;
const MAX_ENTRIES = 100_000;
const DEFAULT_TTL_SEC = 3600;

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const n = Math.sqrt(normA) * Math.sqrt(normB);
  return n === 0 ? 0 : dot / n;
}

export function createNeuralMemory() {
  const entries = [];
  let nextId = 1;
  let cleanupTimer = null;

  function cleanup() {
    const now = Date.now();
    let i = entries.length;
    while (i--) {
      if (entries[i].expiresAt > 0 && entries[i].expiresAt <= now) {
        entries.splice(i, 1);
      }
    }
  }

  function scheduleCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      cleanup();
      if (entries.some(e => e.expiresAt > 0)) scheduleCleanup();
    }, 60_000);
  }

  return {
    store(agentId, embedding, metadata = null, ttlSec = DEFAULT_TTL_SEC) {
      if (!Array.isArray(embedding) && !(embedding instanceof Float32Array)) {
        throw new Error('embedding must be array or Float32Array');
      }
      const dim = embedding.length;
      if (dim > MAX_EMBEDDING_DIM) throw new Error(`embedding dim ${dim} > ${MAX_EMBEDDING_DIM}`);
      const meta = metadata == null ? null : (typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
      if (meta && meta.length > MAX_METADATA_SIZE) throw new Error('metadata too large');
      if (entries.length >= MAX_ENTRIES) {
        cleanup();
        if (entries.length >= MAX_ENTRIES) {
          entries.sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0));
          entries.shift();
        }
      }
      const id = nextId++;
      const vec = Array.isArray(embedding) ? embedding.slice() : Array.from(embedding);
      const entry = {
        memoryId: id,
        agentId: agentId || 0,
        dim,
        embedding: vec,
        metadata: meta || '',
        expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0
      };
      entries.push(entry);
      if (ttlSec > 0) scheduleCleanup();
      return id;
    },

    query(agentId, queryVector, topK = 5, threshold = 0) {
      if (!Array.isArray(queryVector) && !(queryVector instanceof Float32Array)) {
        throw new Error('queryVector must be array or Float32Array');
      }
      const q = Array.isArray(queryVector) ? queryVector : Array.from(queryVector);
      const now = Date.now();
      const results = [];
      for (const e of entries) {
        if (e.expiresAt > 0 && e.expiresAt <= now) continue;
        if (agentId != null && agentId !== 0 && e.agentId !== agentId) continue;
        if (e.embedding.length !== q.length) continue;
        const sim = cosineSimilarity(e.embedding, q);
        if (sim >= threshold) results.push({ memoryId: e.memoryId, similarity: sim, metadata: e.metadata });
      }
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, topK);
    },

    get(memoryId) {
      const e = entries.find(x => x.memoryId === memoryId);
      if (!e) return null;
      if (e.expiresAt > 0 && e.expiresAt <= Date.now()) return null;
      return { memoryId: e.memoryId, agentId: e.agentId, embedding: e.embedding, metadata: e.metadata };
    },

    clear(agentId = null) {
      if (agentId == null) {
        entries.length = 0;
      } else {
        let i = entries.length;
        while (i--) {
          if (entries[i].agentId === agentId) entries.splice(i, 1);
        }
      }
    }
  };
}
