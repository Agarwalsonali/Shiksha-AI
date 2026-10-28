import { openai } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { logger, logAIRequest, logAIResponse, logStreamStart, logStreamEnd, logError } from '../utils/logger';
import { ExternalServiceError } from '../utils/apiError';
import type { TutorPromptContext } from '../prompts';
import { getTutorSystemPrompt, getTutorFollowUpSystemPrompt, getSessionTitlePrompt } from '../prompts';
import { TUTOR_EVALUATION_SYSTEM_PROMPT } from '../prompts/iq.prompts';
import { iqService, type TutorEvaluation } from './iq.service';

/**
 * LLM Service using Vercel AI SDK
 * Handles all interactions with OpenAI models
 */
export class LLMService {
  private tutorModel;
  private utilityModel;
  private plannerModel;

  constructor() {
    // Initialize models from environment
    const tutorModelName = process.env.OPENAI_MODEL_TUTOR || 'gpt-4o';
    const utilityModelName = process.env.OPENAI_MODEL_UTILITY || 'gpt-4o-mini';
    const plannerModelName = process.env.OPENAI_MODEL_PLANNER || 'gpt-4o';

    this.tutorModel = openai(tutorModelName);
    this.utilityModel = openai(utilityModelName);
    this.plannerModel = openai(plannerModelName);

    logger.info({ tutorModel: tutorModelName, utilityModel: utilityModelName, plannerModel: plannerModelName }, 'LLM Service initialized');
  }

  /**
   * Stream a tutor response with token-by-token output
   * Returns an async iterable for SSE streaming
   */
  async streamTutorAnswer(context: TutorPromptContext, userId?: string) {
    const systemPrompt = getTutorSystemPrompt(context);
    const modelName = process.env.OPENAI_MODEL_TUTOR || 'gpt-4o';

    logAIRequest(modelName, systemPrompt.length, userId, {
      answerMode: context.answerMode,
      subject: context.subject,
      class: context.studentClass,
    });

    logStreamStart(modelName, userId, { answerMode: context.answerMode });
    const startTime = Date.now();

    try {
      const result = await streamText({
        model: this.tutorModel,
        system: systemPrompt,
        messages: context.conversationHistory
          ? this.parseConversationHistory(context.conversationHistory)
          : [{ role: 'user', content: context.question }],
        temperature: 0.7,
        maxRetries: 2,
      });

      // Log when stream completes (fire and forget)
      if (result.usage) {
        result.usage.then((usage) => {
          const duration = Date.now() - startTime;
          logStreamEnd(modelName, duration, usage.totalTokens, userId, {
            answerMode: context.answerMode,
          });
        });
      }

      return result.textStream;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'streamTutorAnswer',
        userId,
        duration,
        context: context.answerMode,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again in a moment.');
    }
  }

  /**
   * Generate non-streaming completion (for quiz, detection, planner)
   * Uses utility model (gpt-4o-mini) by default for cost efficiency
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      useUtilityModel?: boolean;
      temperature?: number;
      maxTokens?: number;
      userId?: string;
    } = {}
  ): Promise<string> {
    const {
      useUtilityModel = true,
      temperature = 0.7,
      maxTokens = 1500,
      userId,
    } = options;

    const model = useUtilityModel ? this.utilityModel : this.tutorModel;
    const modelName = useUtilityModel
      ? process.env.OPENAI_MODEL_UTILITY || 'gpt-4o-mini'
      : process.env.OPENAI_MODEL_TUTOR || 'gpt-4o';

    logAIRequest(modelName, systemPrompt.length, userId);
    const startTime = Date.now();

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature,
        maxRetries: 2,
      });

      const duration = Date.now() - startTime;
      logAIResponse(modelName, result.usage?.totalTokens || 0, duration, userId);

      return result.text;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'generateCompletion',
        userId,
        duration,
        modelName,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again.');
    }
  }

  /**
   * Generate completion using the dedicated planner model (gpt-4o/gpt-5)
   * Used for complex tasks like study plan generation that need better reasoning
   */
  async generatePlannerCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      userId?: string;
    } = {}
  ): Promise<string> {
    const {
      temperature = 0.7,
      maxTokens = 4000,
      userId,
    } = options;

    const modelName = process.env.OPENAI_MODEL_PLANNER || 'gpt-4o';

    logAIRequest(modelName, systemPrompt.length, userId, { task: 'planner' });
    const startTime = Date.now();

    try {
      const result = await generateText({
        model: this.plannerModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature,
        maxRetries: 2,
      });

      const duration = Date.now() - startTime;
      logAIResponse(modelName, result.usage?.totalTokens || 0, duration, userId);

      return result.text;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'generatePlannerCompletion',
        userId,
        duration,
        modelName,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again.');
    }
  }

  /**
   * Generate JSON response with automatic parsing
   * Useful for structured outputs (quiz, detection, planner)
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      userId?: string;
      usePlannerModel?: boolean; // Use dedicated planner model (gpt-4o/gpt-5) for complex tasks
    } = {}
  ): Promise<T> {
    const { usePlannerModel, ...restOptions } = options;
    
    // Use planner model for complex generation tasks, utility model for simple ones
    const rawResponse = usePlannerModel 
      ? await this.generatePlannerCompletion(systemPrompt, userPrompt, restOptions)
      : await this.generateCompletion(systemPrompt, userPrompt, {
          useUtilityModel: true,
          ...restOptions,
        });

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = rawResponse.match(/```json\s*\n?([\s\S]*?)\n?```/);
      let jsonString = jsonMatch && jsonMatch[1] ? jsonMatch[1] : rawResponse;

      // Fix LaTeX escaping issues in JSON
      // LaTeX uses single backslashes (\frac, \binom, etc.) which break JSON parsing
      // We need to double-escape them, but only for LaTeX commands, not existing JSON escapes
      jsonString = this.fixLatexEscaping(jsonString);

      // Parse and return
      const parsed = JSON.parse(jsonString.trim());
      return parsed as T;
    } catch (error) {
      logError(error as Error, {
        service: 'LLM',
        method: 'generateJSON',
        rawResponse: rawResponse.substring(0, 500),
      });
      throw new ExternalServiceError('Failed to parse AI response. Please try again.');
    }
  }

  /**
   * Fix LaTeX escaping in JSON strings
   * LaTeX commands like \frac, \binom, \sum need to be double-escaped for JSON
   */
  private fixLatexEscaping(jsonString: string): string {
    // Common LaTeX commands that need escaping
    // Match backslash followed by a letter (LaTeX command) that isn't already double-escaped
    // This regex finds \command but not \\command
    return jsonString.replace(/(?<!\\)\\(?=[a-zA-Z{}_^,])/g, '\\\\');
  }

  /**
   * Generate completion with conversation history
   */
  async generateWithHistory(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    newMessage: string,
    options: {
      useUtilityModel?: boolean;
      temperature?: number;
      userId?: string;
    } = {}
  ): Promise<string> {
    const {
      useUtilityModel = true,
      temperature = 0.7,
      userId,
    } = options;

    const model = useUtilityModel ? this.utilityModel : this.tutorModel;
    const modelName = useUtilityModel
      ? process.env.OPENAI_MODEL_UTILITY || 'gpt-4o-mini'
      : process.env.OPENAI_MODEL_TUTOR || 'gpt-4o';

    logAIRequest(modelName, systemPrompt.length, userId, { hasHistory: true });
    const startTime = Date.now();

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [...conversationHistory, { role: 'user', content: newMessage }],
        temperature,
        maxRetries: 2,
      });

      const duration = Date.now() - startTime;
      logAIResponse(modelName, result.usage?.totalTokens || 0, duration, userId);

      return result.text;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'generateWithHistory',
        userId,
        duration,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again.');
    }
  }

  /**
   * Parse conversation history from string format
   * Expected format: "user: question\nassistant: answer\nuser: follow-up\n..."
   */
  private parseConversationHistory(history: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const lines = history.split('\n');

    for (const line of lines) {
      const userMatch = line.match(/^user:\s*(.+)$/i);
      const assistantMatch = line.match(/^assistant:\s*(.+)$/i);

      if (userMatch && userMatch[1]) {
        messages.push({ role: 'user', content: userMatch[1].trim() });
      } else if (assistantMatch && assistantMatch[1]) {
        messages.push({ role: 'assistant', content: assistantMatch[1].trim() });
      }
    }

    return messages;
  }

  /**
   * Stream a tutor response for first question
   * IQ evaluation is handled separately to not interfere with streaming
   */
  async streamTutorWithEvaluation(
    context: TutorPromptContext,
    userId: string,
    sessionId: string
  ) {
    const systemPrompt = getTutorSystemPrompt(context);
    const modelName = process.env.OPENAI_MODEL_TUTOR || 'gpt-4o';

    logAIRequest(modelName, systemPrompt.length, userId, {
      answerMode: context.answerMode,
      subject: context.subject,
      class: context.studentClass,
    });

    logStreamStart(modelName, userId, { answerMode: context.answerMode });
    const startTime = Date.now();

    try {
      const result = await streamText({
        model: this.tutorModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: context.question }],
        temperature: 0.7,
        maxRetries: 2,
      });

      // Log when stream completes (fire and forget)
      if (result.usage) {
        result.usage.then((usage) => {
          const duration = Date.now() - startTime;
          logStreamEnd(modelName, duration, usage.totalTokens, userId, {
            answerMode: context.answerMode,
          });
        });
      }

      return {
        textStream: result.textStream,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'streamTutorWithEvaluation',
        userId,
        duration,
        context: context.answerMode,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again in a moment.');
    }
  }

  /**
   * Evaluate a user's question for IQ tracking
   * Called separately from streaming to not interfere with response
   */
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

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "bloom_level": "remember|understand|apply|analyze|evaluate|create",
  "question_complexity": <number 1-10>,
  "demonstrates_understanding": <true or false>,
  "reasoning_quality": <number 1-10>,
  "subject": "<detected subject or null>",
  "topic": "<detected topic or null>",
  "chapter": "<detected chapter or null>"
}`;

      const result = await generateText({
        model: this.utilityModel,
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.3,
        maxRetries: 1,
      });

      // Parse the evaluation
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]) as TutorEvaluation;
        
        // Update IQ in background
        await iqService.updateFromTutor(userId, sessionId, evaluation);
        logger.info({ userId, sessionId, bloomLevel: evaluation.bloom_level }, 'IQ evaluation completed');
      }
    } catch (error) {
      // Don't fail the main request if evaluation fails
      logger.warn({ error, question }, 'IQ evaluation failed');
    }
  }

  /**
   * Generate a short title for a tutoring session
   * Uses the small model for efficiency
   */
  async generateSessionTitle(question: string, subject: string, userId?: string): Promise<string> {
    const prompt = getSessionTitlePrompt(question, subject);
    const modelName = process.env.OPENAI_MODEL_UTILITY || 'gpt-4o-mini';

    logAIRequest(modelName, prompt.length, userId, { task: 'session_title' });
    const startTime = Date.now();

    try {
      const result = await generateText({
        model: this.utilityModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent titles
        maxRetries: 2,
      });

      const duration = Date.now() - startTime;
      logAIResponse(modelName, result.usage?.totalTokens || 0, duration, userId);

      // Clean up the title - remove quotes, trim, and limit length
      let title = result.text.trim().replace(/^["']|["']$/g, '');
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      return title || 'Untitled Chat';
    } catch (error) {
      logError(error as Error, { service: 'LLM', method: 'generateSessionTitle', userId });
      return 'Untitled Chat';
    }
  }

  /**
   * Stream a follow-up tutor response using the small model
   * Used for subsequent questions in an existing session
   */
  async streamTutorFollowUp(
    context: TutorPromptContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userId?: string
  ) {
    const systemPrompt = getTutorFollowUpSystemPrompt(context);
    const modelName = process.env.OPENAI_MODEL_UTILITY || 'gpt-4o-mini';

    logAIRequest(modelName, systemPrompt.length, userId, {
      answerMode: context.answerMode,
      subject: context.subject,
      isFollowUp: true,
      historyLength: conversationHistory.length,
    });

    logStreamStart(modelName, userId, { answerMode: context.answerMode, isFollowUp: true });
    const startTime = Date.now();

    try {
      // Limit conversation history to last 10 messages for context efficiency
      const recentHistory = conversationHistory.slice(-10);
      
      const result = await streamText({
        model: this.utilityModel,
        system: systemPrompt,
        messages: [...recentHistory, { role: 'user', content: context.question }],
        temperature: 0.7,
        maxRetries: 2,
      });

      // Log when stream completes
      if (result.usage) {
        result.usage.then((usage) => {
          const duration = Date.now() - startTime;
          logStreamEnd(modelName, duration, usage.totalTokens, userId, {
            answerMode: context.answerMode,
            isFollowUp: true,
          });
        });
      }

      return {
        textStream: result.textStream,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error as Error, {
        service: 'LLM',
        method: 'streamTutorFollowUp',
        userId,
        duration,
        context: context.answerMode,
      });
      throw new ExternalServiceError('AI service unavailable. Please try again in a moment.');
    }
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await generateText({
        model: this.utilityModel,
        messages: [{ role: 'user', content: 'Hello' }],
        maxRetries: 1,
      });
      return true;
    } catch (error) {
      logError(error as Error, { service: 'LLM', method: 'healthCheck' });
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const llmService = new LLMService();
