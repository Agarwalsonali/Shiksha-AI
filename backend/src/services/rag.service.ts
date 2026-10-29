import { createHash } from 'node:crypto';
import weaviate, { Filters, type Collection, type WeaviateClient } from 'weaviate-client';
import { logger, logRAGQuery, logRAGError, logError } from '../utils/logger';

/**
 * NCERT Chunk structure in Weaviate.
 * Field names match the schema produced by the embedding pipeline.
 */
export interface NCERTChunk {
  text: string;
  class_name: string;
  board: string;
  subject: string;
  chapter_no: string;
}

type NCERTChunkProperties = {
  text: string;
  class_name: string;
  board: string;
  subject: string;
  chapter_no: string;
  source?: string;
};

/**
 * RAG search filters
 */
export interface RAGFilters {
  class?: number;
  board?: string;
  subject?: string;
  chapter?: string;
}

/**
 * RAG search result
 */
export interface RAGContext {
  chunks: NCERTChunk[];
  contextText: string;
  metadata: {
    query: string;
    resultsCount: number;
    filters: RAGFilters;
  };
}

// Subject name mapping: App uses full names, ingestion may store folder names.
const SUBJECT_MAP: Record<string, string> = {
  'mathematics': 'math',
  'physics': 'physics',
  'chemistry': 'chemistry',
  'english': 'english',
  'hindi': 'hindi',
  'biology': 'biology',
};

const COLLECTION_RECHECK_MS = 5 * 60 * 1000;

const emptyContext = (query: string, filters: RAGFilters): RAGContext => ({
  chunks: [],
  contextText: '',
  metadata: { query, resultsCount: 0, filters },
});

/**
 * RAG Service for Weaviate.
 *
 * Uses the current gRPC-based `weaviate-client`. Weaviate Cloud clusters no
 * longer serve the GraphQL API, so the legacy `weaviate-ts-client` could not be
 * used here.
 */
export class RAGService {
  private clientPromise: Promise<WeaviateClient> | null = null;
  private client: WeaviateClient | null = null;
  private readonly className = process.env.WEAVIATE_CLASS_NAME || 'NCERTChunks';
  private readonly hybridAlpha = parseFloat(process.env.WEAVIATE_HYBRID_ALPHA || '0.5');
  private readonly useBM25Only = process.env.WEAVIATE_USE_BM25_ONLY !== 'false';
  private readonly timeoutMs = Number(process.env.WEAVIATE_TIMEOUT_MS) || 15000;
  private readonly headers: Record<string, string> = process.env.WEAVIATE_API_KEY?.trim()
    ? { Authorization: `Bearer ${process.env.WEAVIATE_API_KEY.trim()}` }
    : {};
  private configured = false;

  /** Set when the collection is missing so we do not retry every request. */
  private collectionUnavailableUntil = 0;

  constructor() {
    const weaviateUrl = process.env.WEAVIATE_URL?.trim();
    const apiKey = process.env.WEAVIATE_API_KEY?.trim();
    this.configured = Boolean(weaviateUrl);

    if (!weaviateUrl) {
      logger.warn('WEAVIATE_URL not configured - RAG service will be disabled');
      return;
    }

    // Auto-detect scheme: HTTPS for cloud, HTTP for local. Can be overridden.
    const host = weaviateUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const isCloud = host.includes('.weaviate.cloud') || process.env.WEAVIATE_SCHEME === 'https';
    const [hostname, port] = host.split(':');

    this.clientPromise = (async () => {
      const timeout = { init: this.timeoutMs, query: this.timeoutMs, insert: this.timeoutMs };
      const auth = apiKey ? new weaviate.ApiKey(apiKey) : undefined;

      const client = isCloud
        ? await weaviate.connectToWeaviateCloud(`https://${host}`, {
            authCredentials: auth,
            headers: this.headers,
            timeout,
            skipInitChecks: false,
          })
        : await weaviate.connectToCustom({
            httpHost: hostname,
            httpPort: Number(port || 8080),
            httpSecure: false,
            grpcHost: process.env.WEAVIATE_GRPC_HOST || hostname,
            grpcPort: Number(process.env.WEAVIATE_GRPC_PORT || 50051),
            grpcSecure: false,
            authCredentials: auth,
            headers: this.headers,
            timeout,
          });

      this.client = client;
      logger.info(
        {
          url: host,
          scheme: isCloud ? 'https' : 'http',
          transport: 'grpc',
          className: this.className,
          hasApiKey: Boolean(apiKey),
          hybridAlpha: this.hybridAlpha,
          searchMode: this.useBM25Only ? 'BM25 keyword only' : 'Hybrid (BM25 + vector)',
        },
        'RAG Service initialized'
      );
      return client;
    })();

    // Never crash startup if Weaviate is unreachable; retrieval degrades to empty.
    this.clientPromise.catch((error: unknown) => {
      logger.warn(
        { error: (error as Error).message },
        'RAG Service failed to connect - continuing without retrieval'
      );
    });
  }

  private async getClient(): Promise<WeaviateClient | null> {
    if (!this.configured || !this.clientPromise) return null;
    if (this.client) return this.client;

    try {
      return await this.clientPromise;
    } catch {
      return null;
    }
  }

  private async hasCollection(client: WeaviateClient): Promise<boolean> {
    if (Date.now() < this.collectionUnavailableUntil) return false;

    try {
      const exists = await client.collections.exists(this.className);
      if (!exists) {
        this.collectionUnavailableUntil = Date.now() + COLLECTION_RECHECK_MS;
        logger.warn(
          { className: this.className },
          'Weaviate collection not found - retrieval skipped until it is created'
        );
        return false;
      }
      return true;
    } catch (error) {
      this.collectionUnavailableUntil = Date.now() + COLLECTION_RECHECK_MS;
      logger.warn(
        { error: (error as Error).message, className: this.className },
        'Unable to inspect Weaviate collection - retrieval skipped'
      );
      return false;
    }
  }

  /**
   * Build filters that tolerate the class/board/subject casing used by the
   * ingestion pipeline ("class9" vs "9", "CBSE" vs "cbse", "Mathematics" vs "math").
   */
  private buildFilters(
    collection: Collection<NCERTChunkProperties, string, undefined>,
    filters: RAGFilters
  ) {
    const byProperty = (name: 'class_name' | 'board' | 'subject') =>
      collection.filter.byProperty(name);
    const operands = [];

    if (filters.class) {
      const classRaw = String(filters.class);
      operands.push(
        Filters.or(
          byProperty('class_name').equal(classRaw),
          byProperty('class_name').equal(`class${classRaw}`)
        )
      );
    }

    if (filters.board) {
      operands.push(
        Filters.or(
          byProperty('board').equal(filters.board.toUpperCase()),
          byProperty('board').equal(filters.board.toLowerCase())
        )
      );
    }

    if (filters.subject) {
      const subject = filters.subject.toLowerCase();
      const variants = new Set([
        subject,
        subject.charAt(0).toUpperCase() + subject.slice(1),
        SUBJECT_MAP[subject] ?? subject,
      ]);
      operands.push(
        Filters.or(...Array.from(variants).map((value) => byProperty('subject').equal(value)))
      );
    }

    // chapter_no holds the chapter number ("01"), not its name, so chapter
    // filtering is left to the BM25 keyword match.

    if (operands.length === 0) return undefined;
    return operands.length === 1 ? operands[0] : Filters.and(...operands);
  }

  /**
   * Search for relevant NCERT chunks using BM25 or hybrid search.
   */
  async searchRelevantContext(
    query: string,
    filters: RAGFilters = {},
    limit: number = 5
  ): Promise<RAGContext> {
    if (!this.configured) return emptyContext(query, filters);

    // Skip RAG for very short queries (greetings, etc.)
    if (query.trim().length < 10) return emptyContext(query, filters);

    try {
      const client = await this.getClient();
      if (!client) return emptyContext(query, filters);
      if (!(await this.hasCollection(client))) return emptyContext(query, filters);

      const collection = client.collections.get<NCERTChunkProperties>(this.className);
      const where = this.buildFilters(collection, filters);

      const result = this.useBM25Only
        ? await collection.query.bm25(query, {
            limit,
            queryProperties: ['text'],
            filters: where,
            returnMetadata: ['score'],
            includeVector: false,
          })
        : await collection.query.hybrid(query, {
            limit,
            alpha: this.hybridAlpha,
            filters: where,
            returnMetadata: ['score'],
            includeVector: false,
          });

      const chunks: NCERTChunk[] = result.objects
        .map((object) => {
          const props = object.properties as Partial<NCERTChunkProperties> | null;
          return {
            text: String(props?.text ?? '').trim(),
            class_name: String(props?.class_name ?? ''),
            board: String(props?.board ?? ''),
            subject: String(props?.subject ?? ''),
            chapter_no: String(props?.chapter_no ?? ''),
          };
        })
        .filter((chunk) => chunk.text.length > 0);

      logRAGQuery(query, chunks.length, filters);

      const contextText = chunks
        .map((chunk, idx) => {
          return `[NCERT Excerpt ${idx + 1}]
Class: ${chunk.class_name} | Board: ${chunk.board} | Subject: ${chunk.subject} | Chapter: ${chunk.chapter_no}
${chunk.text}`;
        })
        .join('\n\n---\n\n');

      return {
        chunks,
        contextText,
        metadata: { query, resultsCount: chunks.length, filters },
      };
    } catch (error) {
      // Log error but don't throw - generation continues without retrieval context.
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { type: 'rag_error', query, filters, error: errorMessage },
        'RAG search failed, falling back'
      );
      return emptyContext(query, filters);
    }
  }

  /**
   * Search with automatic retry on failure
   */
  async searchWithRetry(
    query: string,
    filters: RAGFilters = {},
    limit: number = 5,
    maxRetries: number = 2
  ): Promise<RAGContext> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.searchRelevantContext(query, filters, limit);
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { attempt: attempt + 1, maxRetries: maxRetries + 1, error: (error as Error).message },
          'RAG search attempt failed, retrying...'
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    logRAGError(query, lastError!, { filters, retriesExhausted: true });
    return emptyContext(query, filters);
  }

  /**
   * Health check for Weaviate connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.configured) return false;

    try {
      const client = await this.getClient();
      if (!client) return false;
      return await client.isReady();
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'healthCheck' });
      return false;
    }
  }

  /**
   * Get class schema info (for debugging)
   */
  async getSchemaInfo(): Promise<{ class: string; properties: Array<{ name: string; dataType: string[] }> } | null> {
    if (!this.configured) return null;

    try {
      const client = await this.getClient();
      if (!client) return null;

      const exists = await client.collections.exists(this.className);
      if (!exists) return null;

      const config = await client.collections.get(this.className).config.get();
      return {
        class: config.name,
        properties: (config.properties ?? []).map((property) => ({
          name: property.name,
          dataType: [String(property.dataType)],
        })),
      };
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'getSchemaInfo' });
      return null;
    }
  }

  /**
   * Get sample data from Weaviate (for debugging field values)
   */
  async getSampleData(limit: number = 5): Promise<NCERTChunk[] | null> {
    if (!this.configured) return null;

    try {
      const client = await this.getClient();
      if (!client) return null;
      if (!(await this.hasCollection(client))) return null;

      const result = await client.collections
        .get<NCERTChunkProperties>(this.className)
        .query.fetchObjects({ limit });

      return result.objects.map((object) => ({
        ...(object.properties as NCERTChunkProperties),
      }));
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'getSampleData' });
      return null;
    }
  }

  /** Fingerprint of a retrieval result, used for cache keys elsewhere. */
  static fingerprint(context: RAGContext): string {
    return createHash('sha1').update(context.contextText).digest('hex').slice(0, 12);
  }

  /** Close the underlying gRPC connection (graceful shutdown). */
  async shutdown(): Promise<void> {
    try {
      if (this.client) await this.client.close();
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Failed to close Weaviate client');
    } finally {
      this.client = null;
      this.clientPromise = null;
    }
  }
}

/**
 * Singleton instance
 */
export const ragService = new RAGService();
