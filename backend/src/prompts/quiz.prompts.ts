/**
 * Quiz Generation Context
 */
export interface QuizPromptContext {
  studentClass: number;
  board: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions: number;
  ragContext: string;
  questionType?: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer';
}

/**
 * Quiz Question Structure
 */
export interface QuizQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
}

/**
 * Difficulty level guidelines
 */
const DIFFICULTY_GUIDELINES = {
  easy: `Easy questions should test:
- Direct recall from NCERT
- Basic definitions and terms
- Simple facts and statements
- One-step problems
Example: "What is the SI unit of force?"`,

  medium: `Medium questions should test:
- Application of concepts
- Two-step problems
- Understanding relationships
- Comparison between concepts
Example: "If force increases while mass remains constant, what happens to acceleration?"`,

  hard: `Hard questions should test:
- Analysis and critical thinking
- Multi-concept integration
- Problem-solving with multiple steps
- Application to new scenarios
- Numerical problems (if applicable)
Example: "A 5kg object accelerates at 2 m/s². If friction is 3N, what is the applied force?"`,
};

/**
 * Generate quiz generation prompt
 */
export const getQuizGenerationPrompt = (context: QuizPromptContext): string => {
  const difficultyGuide = DIFFICULTY_GUIDELINES[context.difficulty];

  return `Generate ${context.numQuestions} multiple-choice questions for Class ${context.studentClass} ${context.board} ${context.subject}.

**Chapter:** ${context.chapter}
**Difficulty Level:** ${context.difficulty}
**Question Type:** Multiple Choice (4 options)

**NCERT Reference Material:**
${context.ragContext}

**Difficulty Guidelines:**
${difficultyGuide}

**Requirements:**
1. Each question must have:
   - Clear, unambiguous question text
   - Exactly 4 options (A, B, C, D)
   - Only ONE correct answer
   - Brief explanation (2-3 sentences) explaining why the answer is correct

2. Question Quality:
   - Follow NCERT terminology exactly
   - Use proper scientific/mathematical notation
   - Avoid trick questions or ambiguity
   - Make distractors (wrong options) plausible but clearly incorrect
   - Mix conceptual and application-based questions

3. Math & Science Formatting (CRITICAL - JSON ESCAPING):
   - Use LaTeX for math BUT with DOUBLE BACKSLASHES for JSON: 
   - Inline math: $E = mc^2$ or block $$F = ma$$
   - Fractions: $\\\\frac{a}{b}$, roots: $\\\\sqrt{x}$, powers: $x^2$
   - Binomial: $\\\\binom{n}{r}$, summation: $\\\\sum_{i=1}^{n}$
   - Symbols: $\\\\alpha$, $\\\\beta$, $\\\\theta$, $\\\\pi$, $\\\\Delta$
   - Chemical equations: $\\\\ce{2H2 + O2 -> 2H2O}$
   - Chemical formulas: $\\\\ce{H2SO4}$, ions: $\\\\ce{Na+}$
   - ALWAYS use \\\\ (double backslash) in JSON output, NOT single \\

4. Distribution (for ${context.numQuestions} questions):
   - Ensure variety in topics within the chapter
   - Balance between "what/define" and "why/how/apply" questions
   - Include at least one numerical/calculation question if applicable

**Output Format:**
Return ONLY a valid JSON array (no markdown code blocks). Structure:

[
  {
    "question": "What is Newton's First Law of Motion?",
    "options": {
      "A": "Force equals mass times acceleration",
      "B": "An object at rest stays at rest unless acted upon by a force",
      "C": "Every action has an equal and opposite reaction",
      "D": "Energy cannot be created or destroyed"
    },
    "correct_answer": "B",
    "explanation": "Newton's First Law states that an object at rest will remain at rest and an object in motion will remain in motion at constant velocity unless acted upon by an external force. This is also called the law of inertia.",
    "difficulty": "${context.difficulty}",
    "topic": "Laws of Motion"
  }
]

Generate ${context.numQuestions} questions now:`;
};

/**
 * Generate prompt for quiz evaluation/grading
 */
export const getQuizEvaluationPrompt = (
  studentAnswer: string,
  correctAnswer: string,
  question: string
): string => {
  return `Evaluate this student's answer and provide constructive feedback.

**Question:** ${question}
**Correct Answer:** ${correctAnswer}
**Student's Answer:** ${studentAnswer}

Provide:
1. Is the student's answer correct? (Yes/No/Partial)
2. Brief explanation of what's right or wrong
3. If wrong, a hint to guide them to the correct answer (don't give away the answer directly)

Keep it encouraging and educational.`;
};

/**
 * Generate prompt for adaptive quiz difficulty
 */
export const getAdaptiveQuizPrompt = (
  correctCount: number,
  totalCount: number,
  currentDifficulty: 'easy' | 'medium' | 'hard'
): string => {
  const accuracy = correctCount / totalCount;

  let nextDifficulty: 'easy' | 'medium' | 'hard';
  if (accuracy >= 0.8 && currentDifficulty !== 'hard') {
    nextDifficulty = currentDifficulty === 'easy' ? 'medium' : 'hard';
  } else if (accuracy < 0.5 && currentDifficulty !== 'easy') {
    nextDifficulty = currentDifficulty === 'hard' ? 'medium' : 'easy';
  } else {
    nextDifficulty = currentDifficulty;
  }

  return `The student has answered ${correctCount} out of ${totalCount} questions correctly (${Math.round(accuracy * 100)}% accuracy).
Current difficulty: ${currentDifficulty}
Recommended next difficulty: ${nextDifficulty}

This suggests the student ${
    accuracy >= 0.8
      ? 'is performing well and ready for more challenging questions'
      : accuracy >= 0.5
      ? 'is at an appropriate difficulty level'
      : 'needs easier questions to build confidence'
  }.`;
};
