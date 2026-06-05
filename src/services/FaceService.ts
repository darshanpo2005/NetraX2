export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
};

export const l2Normalize = (embedding: number[]): number[] => {
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / (norm + 1e-8));
};

// Validated threshold from offline evaluation (cosine similarity)
export const COSINE_THRESHOLD = 0.25;

export interface MatchResult {
  matched: boolean;
  workerId: string | null;
  workerName: string | null;
  similarity: number;
}

export const findBestMatch = (
  queryEmbedding: number[],
  workers: Array<{ id: string; name: string; embedding: number[] }>
): MatchResult => {
  if (!workers.length) {
    return { matched: false, workerId: null, workerName: null, similarity: 0 };
  }
  const normQuery = l2Normalize(queryEmbedding);
  let bestSim = -1;
  let bestWorker = workers[0];
  for (const worker of workers) {
    const sim = cosineSimilarity(normQuery, l2Normalize(worker.embedding));
    if (sim > bestSim) { bestSim = sim; bestWorker = worker; }
  }
  return {
    matched    : bestSim >= COSINE_THRESHOLD,
    workerId   : bestSim >= COSINE_THRESHOLD ? bestWorker.id   : null,
    workerName : bestSim >= COSINE_THRESHOLD ? bestWorker.name : null,
    similarity : bestSim,
  };
};
