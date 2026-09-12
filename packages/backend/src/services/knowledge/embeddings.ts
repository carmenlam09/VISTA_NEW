import { getGeminiClient } from "../../lib/gemini";

// Groq has no embedding model at all (confirmed live against its own
// /models endpoint), so embeddings always go through Gemini - no
// Groq-first/Gemini-fallback dance here, unlike the text-generation
// services elsewhere in the app.
//
// gemini-embedding-001's native output is 3072-dim, which exceeds
// pgvector's hard 2000-dimension cap on indexable vector columns
// (ivfflat/hnsw - see the pgvector README). 1536 is a supported
// `outputDimensionality` truncation for this model (confirmed live) and
// matches the column width declared in schema.prisma.
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const EMBEDDING_DIMENSION = 1536;

function normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, x) => sum + x * x, 0));
  return values.map((x) => x / norm);
}

// Matryoshka truncation isn't pre-normalized like the model's full-length
// output (confirmed live: L2 norm ~0.7, not 1.0) - re-normalize to unit
// length before storage. Cosine distance is scale-invariant either way, but
// this matches Google's documented guidance and keeps stored vectors
// consistent for any future non-cosine use.
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getGeminiClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [text],
    config: { outputDimensionality: EMBEDDING_DIMENSION },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding response did not have the expected ${EMBEDDING_DIMENSION} dimensions`
    );
  }

  return normalize(values);
}

// pgvector's text input format for a vector literal: '[0.1,0.2,...]'.
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
