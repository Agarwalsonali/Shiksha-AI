import { GoogleGenAI } from '@google/genai';
import { logger, logAIRequest, logAIResponse, logStreamStart, logStreamEnd, logError } from '../utils/logger';
import { ExternalServiceError } from '../utils/apiError';
import type { TutorPromptContext } from '../prompts';
import { getTutorSystemPrompt, getTutorFollowUpSystemPrompt, getSessionTitlePrompt } from '../prompts';
import { TUTOR_EVALUATION_SYSTEM_PROMPT } from '../prompts/iq.prompts';
import { iqService, type TutorEvaluation } from './iq.service';

type GeminiRole = 'user' | 'model';
type GeminiMessage = { role: GeminiRole; parts: Array<{ text: string }> };

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  model?: string;
  json?: boolean;
  thinkingBudget?: number;
}

/**
 * Default text model. Gemini 2.5 Flash is no longer served to new API projects,
 * so this is kept configurable and resolved against the live model list.
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL_DEFAULT || 'gemini-3.8-flash';

/** Order of preference when the configured model is unavailable to the API key. */
const FALLBACK_MODEL_PREFERENCE = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
];

const MODEL_LIST_TTL_MS = 10 * 60 * 1000;
const MAX_TRANSIENT_RETRIES = 2;
const MAX_MODEL_ATTEMPTS = 4;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Central Gemini adapter for tutor, quiz, planner, detection, IQ, and title generation.
 * Retrieval remains in RAGService; retrieved context is passed through the prompts.
 */
export class LLMService {
  private readonly client: GoogleGenAI | null;
  private readonly tutorModel: string;
  private readonly utilityModel: string;
  private readonly plannerModel: string;
  private readonly utilityThinkingBudget: number;
  private readonly tutorThinkingBudget: number;
  private readonly requestTimeoutMs: number;

  /** Maps a configured model to an available replacement discovered at runtime. */
  private readonly modelAliases = new Map<string, string>();
  private availableModels: { names: string[]; fetchedAt: number } | null = null;
  /** Cleared if a fallback model rejects thinking configuration. */
  private thinkingSupported = true;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    this.requestTimeoutMs = parseNumber(process.env.GEMINI_TIMEOUT_MS, 120000);

    this.client = apiKey
      ? new GoogleGenAI({ apiKey, httpOptions: { timeout: this.requestTimeoutMs } })
      : null;

    this.tutorModel = process.env.GEMINI_MODEL_TUTOR || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    this.utilityModel = process.env.GEMINI_MODEL_UTILITY || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    this.plannerModel = process.env.GEMINI_MODEL_PLANNER || process.env.GEMINI_MODEL || DEFAULT_MODEL;

    // Gemini 3 models think before answering by default, which adds latency to
    // structured/utility calls without improving their output.
    this.utilityThinkingBudget = parseNumber(process.env.GEMINI_THINKING_BUDGET, 0);
    this.tutorThinkingBudget = parseNumber(
      process.env.GEMINI_THINKING_BUDGET_TUTOR,
      this.utilityThinkingBudget
    );

    logger.info(
      {
        provider: 'Google Gemini',
        tutorModel: this.tutorModel,
        utilityModel: this.utilityModel,
        plannerModel: this.plannerModel,
        configured: Boolean(apiKey),
      },
      'LLM service initialized'
    );
  }

  private requireClient(): GoogleGenAI {
    if (!this.client) {
      throw new ExternalServiceError(
        'Gemini API is not configured. Set GEMINI_API_KEY in the backend environment.'
      );
    }
    return this.client;
  }

  private thinkingConfig(budget?: number) {
    if (!this.thinkingSupported) return {};
    return { thinkingConfig: { thinkingBudget: budget ?? this.utilityThinkingBudget } };
  }

  private statusOf(error: unknown): number | undefined {
    const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    for (const value of [candidate?.status, candidate?.statusCode, candidate?.code]) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    // The SDK embeds the status in its message: {"error":{"code":404,...}}
    const message = error instanceof Error ? error.message : '';
    const match = message.match(/"code"\s*:\s*(\d{3})/);
    return match ? Number(match[1]) : undefined;
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  }

  private isModelUnavailable(error: unknown): boolean {
    const message = this.messageOf(error);
    return (
      this.statusOf(error) === 404 ||
      message.includes('no longer available') ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('unsupported model')
    );
  }

  private isTransient(error: unknown): boolean {
    const status = this.statusOf(error);
    const message = this.messageOf(error);
    return (
      status === 429 ||
      status === 503 ||
      status === 502 ||
      status === 504 ||
      message.includes('high demand') ||
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('overloaded') ||
      message.includes('unavailable') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    );
  }

  /**
   * Ask the API which models this key may use, so an outdated model ID in the
   * environment never breaks generation.
   */
  private async listAvailableModels(): Promise<string[]> {
    if (this.availableModels && Date.now() - this.availableModels.fetchedAt < MODEL_LIST_TTL_MS) {
      return this.availableModels.names;
    }

    const client = this.requireClient();
    try {
      const names: string[] = [];
      const pager = await client.models.list();
      for await (const model of pager) {
        if (!model.name) continue;
        names.push(model.name.replace(/^models\//, ''));
      }
      this.availableModels = { names, fetchedAt: Date.now() };
      logger.info({ modelCount: names.length }, 'Fetched available Gemini models');
      return names;
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'listAvailableModels' });
      return [];
    }
  }

  /** Next model this key can use that has not already been tried. */
  private async nextModelCandidate(attempted: string[]): Promise<string | null> {
    if (attempted.length >= MAX_MODEL_ATTEMPTS) return null;

    const names = await this.listAvailableModels();
    if (names.length === 0) return null;

    const usable = names.filter(
      (name) => !/(tts|image|audio|live|embedding|embed|veo|imagen|lyria)/i.test(name)
    );

    const ordered = [
      ...FALLBACK_MODEL_PREFERENCE.filter((name) => usable.includes(name)),
      ...usable.filter((name) => /flash/i.test(name)),
      ...usable,
    ];

    return ordered.find((name) => !attempted.includes(name)) ?? null;
  }

  /**
   * Gemini free-tier keys enforce a per-model daily request cap. Retrying the
   * same model only wastes the remaining wait, so callers switch models instead.
   */
  private isDailyQuotaExceeded(error: unknown): boolean {
    const message = this.messageOf(error);
    return /per\s*day|perday|daily/i.test(message) && /quota|exhaust|resource_exhausted/i.test(message);
  }

  /**
   * Runs a request, moving to another model when the current one is retired or
   * out of daily quota, and retrying transient upstream failures.
   */
  private async execute<T>(requestedModel: string, run: (model: string) => Promise<T>): Promise<T> {
    const attempted: string[] = [];
    let model = this.modelAliases.get(requestedModel) ?? requestedModel;
    let transientAttempts = 0;

    for (;;) {
      attempted.push(model);

      try {
        return await run(model);
      } catch (error) {
        // Some fallback models do not accept thinking configuration.
        if (this.thinkingSupported && this.statusOf(error) === 400 && this.messageOf(error).includes('thinking')) {
          this.thinkingSupported = false;
          attempted.pop();
          logger.warn('Active Gemini model does not support thinking config; retrying without it');
          continue;
        }

        if (this.isDailyQuotaExceeded(error)) {
          const replacement = await this.nextModelCandidate(attempted);
          if (!replacement) throw error;
          logger.warn(
            { model, replacementModel: replacement },
            'Gemini daily quota exhausted for model; switching to another model'
          );
          this.modelAliases.set(requestedModel, replacement);
          model = replacement;
          continue;
        }

        if (this.isModelUnavailable(error)) {
          const replacement = await this.nextModelCandidate(attempted);
          if (!replacement) throw error;
          logger.warn(
            { requestedModel, replacementModel: replacement },
            'Configured Gemini model unavailable; switching to an available model'
          );
          this.modelAliases.set(requestedModel, replacement);
          model = replacement;
          continue;
        }

        if (this.isTransient(error) && transientAttempts < MAX_TRANSIENT_RETRIES) {
          const delayMs = 1000 * Math.pow(2, transientAttempts);
          transientAttempts += 1;
          attempted.pop();
          logger.warn(
            { attempt: transientAttempts, delayMs, error: (error as Error).message.slice(0, 200) },
            'Transient Gemini error, retrying'
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw error;
      }
    }
  }

  private wrapError(error: unknown): ExternalServiceError {
    const status = this.statusOf(error);
    const message = this.messageOf(error);

    if (status === 401 || status === 403 || message.includes('api key') || message.includes('permission')) {
      return new ExternalServiceError('Gemini API authentication failed. Check GEMINI_API_KEY.');
    }
    if (status === 404) {
      return new ExternalServiceError(
        'The configured Gemini model is unavailable for this API project. Set GEMINI_MODEL to a model your key can use.'
      );
    }
    if (this.isDailyQuotaExceeded(error)) {
      return new ExternalServiceError(
        'Gemini daily request quota is exhausted for every available model. Wait for the daily reset or enable billing for the API key.'
      );
    }
    if (status === 429 || message.includes('quota') || message.includes('rate limit')) {
      return new ExternalServiceError('Gemini API quota or rate limit exceeded. Please try again later.');
    }
    if (status === 503 || message.includes('high demand')) {
      return new ExternalServiceError(
        'Gemini is temporarily overloaded. Please try again in a few seconds.'
      );
    }
    return new ExternalServiceError('Gemini AI service unavailable. Please try again.');
  }

  private async generate(
    systemPrompt: string,
    userPrompt: string,
    options: GenerateOptions = {}
  ): Promise<{ text: string; tokens: number; finishReason?: string; truncated: boolean }> {
    const client = this.requireClient();
    const model = options.model || this.utilityModel;
    const startTime = Date.now();
    logAIRequest(model, systemPrompt.length + userPrompt.length, options.userId);

    try {
      const response = await this.execute(model, (activeModel) =>
        client.models.generateContent({
          model: activeModel,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1500,
            ...this.thinkingConfig(options.thinkingBudget),
            ...(options.json ? { responseMimeType: 'application/json' } : {}),
          },
        })
      );

      const text = response.text?.trim() || '';
      const tokens = response.usageMetadata?.totalTokenCount || 0;
      const finishReason = response.candidates?.[0]?.finishReason;
      logAIResponse(model, tokens, Date.now() - startTime, options.userId);
      return {
        text,
        tokens,
        finishReason,
        truncated: finishReason === 'MAX_TOKENS',
      };
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'generate', userId: options.userId });
      throw this.wrapError(error);
    }
  }

  private async stream(
    systemPrompt: string,
    messages: GeminiMessage[],
    options: GenerateOptions = {}
  ): Promise<AsyncIterable<string>> {
    const client = this.requireClient();
    const model = options.model || this.tutorModel;

    try {
      const response = await this.execute(model, (activeModel) =>
        client.models.generateContentStream({
          model: activeModel,
          contents: messages,
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 3000,
            ...this.thinkingConfig(options.thinkingBudget ?? this.tutorThinkingBudget),
          },
        })
      );

      return (async function* () {
        for await (const chunk of response) {
          if (chunk.text) yield chunk.text;
        }
      })();
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'stream', userId: options.userId });
      throw this.wrapError(error);
    }
  }

  async streamTutorAnswer(context: TutorPromptContext, userId?: string) {
    const systemPrompt = getTutorSystemPrompt(context);
    const messages = context.conversationHistory
      ? this.parseConversationHistory(context.conversationHistory)
      : [{ role: 'user' as const, parts: [{ text: context.question }] }];
    return this.stream(systemPrompt, messages, { model: this.tutorModel, userId });
  }

  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      useUtilityModel?: boolean;
      temperature?: number;
      maxTokens?: number;
      userId?: string;
      json?: boolean;
    } = {}
  ): Promise<string> {
    const model = options.useUtilityModel === false ? this.tutorModel : this.utilityModel;
    const result = await this.generate(systemPrompt, userPrompt, { ...options, model });
    return result.text;
  }

  async generatePlannerCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number; userId?: string; json?: boolean } = {}
  ): Promise<string> {
    const result = await this.generate(systemPrompt, userPrompt, {
      ...options,
      model: this.plannerModel,
    });
    return result.text;
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      userId?: string;
      usePlannerModel?: boolean;
    } = {}
  ): Promise<T> {
    // Always request JSON output, including the planner path. Without
    // responseMimeType the model may wrap the object in prose or markdown fences.
    const model = options.usePlannerModel ? this.plannerModel : this.utilityModel;
    const baseTokens = options.maxTokens ?? 4000;

    const run = (maxTokens: number) =>
      this.generate(systemPrompt, userPrompt, {
        ...options,
        model,
        json: true,
        maxTokens,
      });

    const attemptParse = (text: string): T | null => {
      try {
        return JSON.parse(this.normalizeJsonText(text)) as T;
      } catch {
        return null;
      }
    };

    let result = await run(baseTokens);
    let parsed = attemptParse(result.text);

    // A plan that ran out of output tokens is invalid JSON; retry once with a
    // larger budget before failing.
    if (parsed === null && result.truncated) {
      const retryTokens = Math.min(baseTokens * 2, 12000);
      logger.warn(
        { baseTokens, retryTokens },
        'Gemini JSON output hit the token limit; retrying with a larger budget'
      );
      result = await run(retryTokens);
      parsed = attemptParse(result.text);
    }

    if (parsed === null) {
      logError(new Error('Unparseable Gemini JSON response'), {
        service: 'Gemini',
        method: 'generateJSON',
        finishReason: result.finishReason,
        responseLength: result.text.length,
      });
      throw new ExternalServiceError(
        result.truncated
          ? 'Gemini response was too long to complete. Please try a shorter request.'
          : 'Gemini returned an invalid response. Please try again.'
      );
    }

    return parsed;
  }

  /**
   * Extract a JSON payload from model text: remove markdown fences, prose
   * before/after the payload, and tolerate a missing closing fence.
   */
  private normalizeJsonText(raw: string): string {
    let text = raw.trim();

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (fenced?.[1]) text = fenced[1].trim();

    const objectStart = text.indexOf('{');
    const arrayStart = text.indexOf('[');
    const starts = [objectStart, arrayStart].filter((index) => index >= 0);
    if (starts.length > 0) {
      const start = Math.min(...starts);
      if (start > 0) text = text.slice(start);
    }

    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end !== -1 && end < text.length - 1) text = text.slice(0, end + 1);

    return this.fixLatexEscaping(text).trim();
  }

  async generateWithHistory(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    newMessage: string,
    options: { useUtilityModel?: boolean; temperature?: number; userId?: string } = {}
  ): Promise<string> {
    const messages: GeminiMessage[] = [
      ...conversationHistory.map((message) => ({
        role: message.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: message.content }] as [{ text: string }],
      })),
      { role: 'user', parts: [{ text: newMessage }] },
    ];

    const client = this.requireClient();
    const model = options.useUtilityModel === false ? this.tutorModel : this.utilityModel;

    try {
      const response = await this.execute(model, (activeModel) =>
        client.models.generateContent({
          model: activeModel,
          contents: messages,
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: options.temperature ?? 0.7,
            ...this.thinkingConfig(),
          },
        })
      );
      return response.text?.trim() || '';
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'generateWithHistory', userId: options.userId });
      throw this.wrapError(error);
    }
  }

  async streamTutorWithEvaluation(context: TutorPromptContext, userId: string, sessionId: string) {
    const systemPrompt = getTutorSystemPrompt(context);
    logStreamStart(this.tutorModel, userId, { answerMode: context.answerMode });
    const startTime = Date.now();
    const textStream = await this.stream(
      systemPrompt,
      [{ role: 'user', parts: [{ text: context.question }] }],
      { model: this.tutorModel, userId }
    );
    const wrappedStream = (async function* () {
      for await (const chunk of textStream) yield chunk;
      logStreamEnd('gemini', Date.now() - startTime, 0, userId, {
        answerMode: context.answerMode,
        sessionId,
      });
    })();
    return { textStream: wrappedStream };
  }

  async evaluateQuestionForIQ(
    question: string,
    subject: string | null,
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      const evaluationPrompt = `${TUTOR_EVALUATION_SYSTEM_PROMPT}

Analyze this student question and provide your evaluation as JSON:

Question: "${question}"
${subject ? `Subject context: ${subject}` : ''}

Respond with ONLY a JSON object:
{
  "bloom_level": "remember|understand|apply|analyze|evaluate|create",
  "question_complexity": <number 1-10>,
  "demonstrates_understanding": <true or false>,
  "reasoning_quality": <number 1-10>,
  "subject": "<detected subject or null>",
  "topic": "<detected topic or null>",
  "chapter": "<detected chapter or null>"
}`;
      const result = await this.generate('', evaluationPrompt, {
        model: this.utilityModel,
        temperature: 0.3,
        maxTokens: 1000,
        userId,
        json: true,
      });
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        await iqService.updateFromTutor(userId, sessionId, JSON.parse(jsonMatch[0]) as TutorEvaluation);
      }
    } catch (error) {
      logger.warn({ error, question }, 'IQ evaluation failed');
    }
  }

  async generateSessionTitle(question: string, subject: string, userId?: string): Promise<string> {
    const prompt = getSessionTitlePrompt(question, subject);
    try {
      const result = await this.generate('', prompt, {
        model: this.utilityModel,
        temperature: 0.3,
        maxTokens: 100,
        userId,
      });
      const title = result.text.trim().replace(/^["']|["']$/g, '');
      return title.length > 50 ? `${title.substring(0, 47)}...` : title || 'Untitled Chat';
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'generateSessionTitle', userId });
      return 'Untitled Chat';
    }
  }

  async streamTutorFollowUp(
    context: TutorPromptContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userId?: string
  ) {
    const messages: GeminiMessage[] = [
      ...conversationHistory.slice(-10).map((message) => ({
        role: message.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: message.content }] as [{ text: string }],
      })),
      { role: 'user', parts: [{ text: context.question }] },
    ];
    const textStream = await this.stream(
      getTutorFollowUpSystemPrompt(context),
      messages,
      { model: this.utilityModel, userId }
    );
    return { textStream };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.generate('', 'Reply with OK.', { model: this.utilityModel, maxTokens: 32 });
      return true;
    } catch (error) {
      logError(error as Error, { service: 'Gemini', method: 'healthCheck' });
      return false;
    }
  }

  /** Exposed for startup diagnostics: the model currently used for each tier. */
  getModelInfo() {
    return {
      tutor: this.modelAliases.get(this.tutorModel) ?? this.tutorModel,
      utility: this.modelAliases.get(this.utilityModel) ?? this.utilityModel,
      planner: this.modelAliases.get(this.plannerModel) ?? this.plannerModel,
    };
  }

  private parseConversationHistory(history: string): GeminiMessage[] {
    return history.split('\n').flatMap((line): GeminiMessage[] => {
      const userMatch = line.match(/^user:\s*(.+)$/i);
      const assistantMatch = line.match(/^assistant:\s*(.+)$/i);
      if (userMatch?.[1]) return [{ role: 'user', parts: [{ text: userMatch[1].trim() }] }];
      if (assistantMatch?.[1]) return [{ role: 'model', parts: [{ text: assistantMatch[1].trim() }] }];
      return [];
    });
  }

  private fixLatexEscaping(jsonString: string): string {
    return jsonString.replace(/(?<!\\)\\(?=[a-zA-Z{}_^,])/g, '\\\\');
  }
}

export const llmService = new LLMService();
