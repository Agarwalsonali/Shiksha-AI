import weaviate, { type WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { logger, logRAGQuery, logRAGError, logError } from '../utils/logger';

/**
 * NCERT Chunk structure in Weaviate
 * Field names match the actual Weaviate schema
 */
export interface NCERTChunk {
  text: string;
  class_name: string;  // Was 'class' - actual field name in Weaviate
  board: string;
  subject: string;
  chapter_no: string;  // Was 'chapter' - actual field name in Weaviate
}

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

// Subject name mapping: App uses full names, Weaviate uses folder names
const SUBJECT_MAP: Record<string, string> = {
  'mathematics': 'math',
  'physics': 'physics',
  'chemistry': 'chemistry',
  'english': 'english',
  'hindi': 'hindi',
  'biology': 'biology',
  // Add more as needed
};

/**
 * RAG Service for Weaviate integration
 * Supports both hybrid search (BM25 + vector) and BM25-only keyword search
 */
export class RAGService {
  private client!: WeaviateClient;
  private className: string;
  private isInitialized: boolean = false;
  private hybridAlpha: number; // 0 = pure keyword, 1 = pure vector, 0.5 = balanced
  private useBM25Only: boolean; // Use BM25 keyword search only (no vectorizer required)

  constructor() {
    const weaviateUrl = process.env.WEAVIATE_URL;
    const weaviateApiKey = process.env.WEAVIATE_API_KEY;
    this.className = process.env.WEAVIATE_CLASS_NAME || 'NCERTChunks';
    // Hybrid search alpha: 0 = pure BM25 keyword, 1 = pure vector, 0.5 = balanced (default)
    this.hybridAlpha = parseFloat(process.env.WEAVIATE_HYBRID_ALPHA || '0.5');
    // Use BM25-only search if vectorizer is not configured (set to 'true' to force BM25)
    this.useBM25Only = process.env.WEAVIATE_USE_BM25_ONLY === 'true';

    if (!weaviateUrl) {
      logger.warn('WEAVIATE_URL not configured - RAG service will be disabled');
      return;
    }

    // Auto-detect scheme: use HTTPS for cloud (.weaviate.cloud), HTTP for local
    // Can be overridden via WEAVIATE_SCHEME env var
    const isCloudInstance = weaviateUrl.includes('.weaviate.cloud');
    const weaviateScheme = (process.env.WEAVIATE_SCHEME as 'http' | 'https') || 
                           (isCloudInstance ? 'https' : 'http');

    // Initialize Weaviate client
    const clientConfig: any = {
      scheme: weaviateScheme,
      host: weaviateUrl,
    };

    // Add API key if provided (for cloud-hosted Weaviate)
    if (weaviateApiKey) {
      clientConfig.apiKey = new ApiKey(weaviateApiKey);
    }

    this.client = weaviate.client(clientConfig);

    this.isInitialized = true;
    logger.info(
      {
        url: weaviateUrl,
        scheme: weaviateScheme,
        className: this.className,
        hasApiKey: !!weaviateApiKey,
        hybridAlpha: this.hybridAlpha,
        searchMode: this.useBM25Only ? 'BM25 keyword only' : 'Hybrid (BM25 + vector)',
      },
      `RAG Service initialized with ${this.useBM25Only ? 'BM25 keyword' : 'hybrid'} search`
    );
  }

  /**
   * Search for relevant NCERT chunks using Weaviate's hybrid search
   * Hybrid search combines BM25 keyword matching with vector similarity
   * This eliminates the need for external embedding API calls
   */
  async searchRelevantContext(
    query: string,
    filters: RAGFilters = {},
    limit: number = 5
  ): Promise<RAGContext> {
    // If RAG service not initialized, return empty context silently
    if (!this.isInitialized) {
      return {
        chunks: [],
        contextText: '',
        metadata: { query, resultsCount: 0, filters },
      };
    }
    
    // Skip RAG for very short queries (greetings, etc.)
    if (query.trim().length < 10) {
      return {
        chunks: [],
        contextText: '',
        metadata: { query, resultsCount: 0, filters },
      };
    }

    try {
      // Build Weaviate query
      // Use BM25 keyword search if vectorizer not available, otherwise use hybrid
      let graphQuery = this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields('text class_name board subject chapter_no')
        .withLimit(limit);

      // Add search method based on configuration
      if (this.useBM25Only) {
        // BM25 keyword search - no vectorizer required
        graphQuery = graphQuery.withBm25({ query });
      } else {
        // Hybrid search (BM25 + vector) - requires vectorizer
        graphQuery = graphQuery.withHybrid({ query, alpha: this.hybridAlpha });
      }

      // Add filters if provided
      // Note: Weaviate stores data as:
      //   - class_name: "class11", "class12" (lowercase, no space)
      //   - chapter_no: "01", "02", etc. (chapter number, not name)
      //   - subject: "physics", "chemistry" (lowercase)
      //   - board: "cbse" (lowercase)
      const whereFilters: any[] = [];

      if (filters.class) {
        // Convert class number to format: "class11", "class12"
        const classValue = `class${filters.class}`;
        whereFilters.push({
          path: ['class_name'],
          operator: 'Equal',
          valueString: classValue,
        });
      }

      if (filters.board) {
        whereFilters.push({
          path: ['board'],
          operator: 'Equal',
          valueString: filters.board.toLowerCase(),
        });
      }

      if (filters.subject) {
        // Map app subject names to Weaviate folder names
        // e.g., "Mathematics" -> "math", "Physics" -> "physics"
        const subjectLower = filters.subject.toLowerCase();
        const mappedSubject = SUBJECT_MAP[subjectLower] || subjectLower;
        whereFilters.push({
          path: ['subject'],
          operator: 'Equal',
          valueString: mappedSubject,
        });
      }

      // Note: We don't filter by chapter_no because it's a number (01, 02, etc.)
      // and the input is chapter name (States of Matter, Equilibrium, etc.)
      // The BM25 keyword search will handle finding relevant content by chapter name

      // Apply filters if any exist
      if (whereFilters.length > 0) {
        graphQuery = graphQuery.withWhere({
          operator: 'And',
          operands: whereFilters,
        });
      }

      // Execute the query
      const result = await graphQuery.do();

      // Extract chunks
      const chunks: NCERTChunk[] = result.data?.Get?.[this.className] || [];

      logRAGQuery(query, chunks.length, filters);

      // Format context text for LLM
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
        metadata: {
          query,
          resultsCount: chunks.length,
          filters,
        },
      };
    } catch (error) {
      // Log error but don't throw - return empty context instead (fallback strategy)
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { type: 'rag_error', query, filters, error: errorMessage },
        'RAG search failed, falling back'
      );
      
      return {
        chunks: [],
        contextText: '',
        metadata: {
          query,
          resultsCount: 0,
          filters,
        },
      };
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
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed, return empty context
    logRAGError(query, lastError!, { filters, retriesExhausted: true });
    
    return {
      chunks: [],
      contextText: '',
      metadata: {
        query,
        resultsCount: 0,
        filters,
      },
    };
  }

  /**
   * Health check for Weaviate connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const result = await this.client.schema.getter().do();
      return !!result;
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'healthCheck' });
      return false;
    }
  }

  /**
   * Get class schema info (for debugging)
   */
  async getSchemaInfo(): Promise<any> {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const schema = await this.client.schema.classGetter().withClassName(this.className).do();
      return schema;
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'getSchemaInfo' });
      return null;
    }
  }

  /**
   * Get sample data from Weaviate (for debugging field values)
   */
  async getSampleData(limit: number = 5): Promise<any> {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields('text class_name board subject chapter_no')
        .withLimit(limit)
        .do();
      
      return result.data?.Get?.[this.className] || [];
    } catch (error) {
      logError(error as Error, { service: 'RAG', method: 'getSampleData' });
      return null;
    }
  }
}

/**
 * Singleton instance
 */
export const ragService = new RAGService();
