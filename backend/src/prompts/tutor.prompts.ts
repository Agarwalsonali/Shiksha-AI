import type { AnswerMode } from '../schemas/tutor.schema';

/**
 * Tutor Prompt Context
 * Contains all information needed to generate a tutor response
 */
export interface TutorPromptContext {
  studentClass: number;
  board: string;
  subject: string;
  question: string;
  ragContext: string;
  answerMode?: AnswerMode; // Optional, defaults to 'simple'
  conversationHistory?: string; // For follow-up questions
}

/**
 * Answer mode instructions for different student needs
 * - simple: Easy language, everyday examples, conversational
 * - quick: Brief 2-3 sentences, key facts only
 * - detailed: Full explanation with examples, step-by-step
 * - exam: Exam-ready format, NCERT terminology, proper structure
 */
const ANSWER_MODE_INSTRUCTIONS: Record<AnswerMode, string> = {
  simple: `Explain this concept in simple, easy-to-understand language suitable for a Class {class} student.
- Use everyday examples and relatable analogies (cricket, trains, festivals, etc.)
- Keep it conversational and friendly
- Avoid complex jargon or technical terms
- Break down complex ideas into small, digestible chunks
- Use Hindi-English mix (Hinglish) if it helps explain better
- Make learning fun and engaging`,

  quick: `Provide a brief, to-the-point answer.
- Keep it to 2-4 sentences maximum
- Focus on the core concept or key fact
- Be precise and clear
- Skip unnecessary details
- Perfect for quick revision or checking understanding`,

  detailed: `Provide a comprehensive, well-structured explanation.
- Start with a clear definition or introduction
- Explain the concept step-by-step
- Include relevant examples and applications
- Mention any important formulas or diagrams (describe them)
- Connect to related concepts when helpful
- Use bullet points and clear formatting
- Ideal for thorough understanding`,

  exam: `Provide an exam-ready answer following board exam patterns.
Structure your answer as:
1. **Definition/Introduction** - Clear, textbook-style opening
2. **Key Points** - Main concepts with proper NCERT terminology
3. **Examples/Applications** - Relevant examples as per syllabus
4. **Diagram/Formula** - If applicable, describe what to draw/write
5. **Conclusion** - Brief summary or significance

Use formal language, proper formatting, and focus on what scores marks in exams.`,
};

/**
 * Mode display names for UI
 */
export const ANSWER_MODE_LABELS: Record<AnswerMode, { label: string; description: string }> = {
  simple: { label: 'Simple', description: 'Easy to understand explanations' },
  quick: { label: 'Quick', description: 'Brief, to-the-point answers' },
  detailed: { label: 'Detailed', description: 'Comprehensive explanations' },
  exam: { label: 'Exam', description: 'Exam-ready formatted answers' },
};

/**
 * Generate system prompt for tutor based on context
 */
export const getTutorSystemPrompt = (context: TutorPromptContext): string => {
  // Default to 'simple' mode if not provided or invalid
  const answerMode: AnswerMode = context.answerMode && ANSWER_MODE_INSTRUCTIONS[context.answerMode] 
    ? context.answerMode 
    : 'simple';
  
  const modeInstruction = ANSWER_MODE_INSTRUCTIONS[answerMode].replace(
    '{class}',
    context.studentClass.toString()
  );

  return `You are Shiksha-AI, an expert AI tutor for Indian Class ${context.studentClass} ${context.board} board students.

**Student Profile:**
- Class: ${context.studentClass}
- Board: ${context.board}
- Subject: ${context.subject}

**NCERT Reference Material:**
${context.ragContext || 'No specific NCERT context found. Use general knowledge but stay aligned with the NCERT Class ' + context.studentClass + ' curriculum for ' + context.subject + '.'}

**Answer Mode: ${answerMode.toUpperCase()}**
${modeInstruction}

**Important Guidelines:**
1. **NCERT First**: Always base your answer on NCERT content when available
2. **Indian Context**: Use Indian examples (IST time zones, INR currency, Indian cities, festivals, cricket, etc.)
3. **Age-Appropriate**: Adjust language complexity for Class ${context.studentClass} students
4. **Encouraging Tone**: Be supportive, patient, and motivating
5. **Clarification**: If the question is unclear, politely ask for clarification
6. **Language**: Primarily English, but you can use simple Hindi words when it makes concepts clearer
7. **Formatting**: Use markdown for better readability (headers, bold, lists)

**Math & Science Formatting:**
- Use LaTeX for mathematical equations: inline $E = mc^2$ or block $$F = ma$$
- For chemical equations use: $\\ce{2H2 + O2 -> 2H2O}$ or $$\\ce{NaOH + HCl -> NaCl + H2O}$$
- For fractions: $\\frac{a}{b}$, square roots: $\\sqrt{x}$, powers: $x^2$, subscripts: $x_1$
- Use proper symbols: $\\alpha$, $\\beta$, $\\theta$, $\\pi$, $\\Delta$, $\\sum$, $\\int$
- Chemical formulas: $\\ce{H2SO4}$, $\\ce{CO2}$, ions: $\\ce{Na+}$, $\\ce{Cl-}$

**Student's Question:**
${context.question}`;
};

/**
 * Generate system prompt for follow-up questions (uses smaller model)
 */
export const getTutorFollowUpSystemPrompt = (context: TutorPromptContext): string => {
  const answerMode: AnswerMode = context.answerMode && ANSWER_MODE_INSTRUCTIONS[context.answerMode] 
    ? context.answerMode 
    : 'simple';

  return `You are Shiksha-AI continuing a tutoring conversation with a Class ${context.studentClass} ${context.board} student.

**Subject:** ${context.subject}
**Answer Mode:** ${answerMode.toUpperCase()}

Continue helping the student based on the conversation context. Be consistent with your previous explanations.

Guidelines:
- Build on what you've already explained
- Reference previous points when relevant  
- Keep the same teaching style
- Be concise but helpful
- Use markdown formatting`;
};

/**
 * Generate prompt for session title generation
 */
export const getSessionTitlePrompt = (question: string, subject: string): string => {
  return `Generate a very short title (3-5 words max) for a tutoring conversation that started with this question.

Question: "${question}"
Subject: ${subject}

The title should:
- Be concise and descriptive
- Capture the main topic
- Not include "Question about" or similar prefixes
- Be in English

Examples:
- "Newton's Laws of Motion"
- "Photosynthesis Process"
- "Quadratic Equations"
- "French Revolution Causes"
- "Cell Structure & Function"

Return ONLY the title, nothing else:`;
};

/**
 * Generate prompt for follow-up questions in a conversation
 */
export const getTutorFollowUpPrompt = (
  conversationHistory: string,
  newQuestion: string,
  context: Omit<TutorPromptContext, 'question' | 'conversationHistory'>
): string => {
  const answerMode: AnswerMode = context.answerMode || 'simple';
  
  return `Continue the tutoring conversation. Maintain consistency with previous explanations.

**Previous Conversation:**
${conversationHistory}

**New Question from Student:**
${newQuestion}

Remember to:
- Build upon what the student already knows from our conversation
- Reference previous explanations when relevant
- Maintain the same teaching style and answer mode (${answerMode})
- Stay aligned with NCERT Class ${context.studentClass} ${context.board} curriculum
- Use markdown formatting for clarity`;
};

/**
 * Generate prompt for concept explanation (when no specific question)
 */
export const getConceptExplanationPrompt = (
  concept: string,
  context: Omit<TutorPromptContext, 'question'>
): string => {
  return getTutorSystemPrompt({
    ...context,
    question: `Explain the concept: ${concept}`,
  });
};
