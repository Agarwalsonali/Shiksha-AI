/**
 * IQ & Knowledge Evaluation Prompts
 * Used by the AI tutor to evaluate user questions and understanding
 */

/**
 * Bloom's Taxonomy Level Descriptions
 * Used to help the AI categorize questions
 */
export const BLOOM_LEVEL_DESCRIPTIONS = {
  remember: 'Basic recall of facts, definitions, terms, or concepts. Questions like "What is...", "Define...", "List..."',
  understand: 'Explaining ideas, summarizing, interpreting. Questions like "Explain...", "Why does...", "What does X mean..."',
  apply: 'Using knowledge in new situations, solving problems. Questions like "How would you...", "Calculate...", "Solve..."',
  analyze: 'Breaking down information, finding patterns, comparing. Questions like "Compare...", "What are the differences...", "How is X related to Y..."',
  evaluate: 'Making judgments, defending positions, critiquing. Questions like "Which is better...", "Do you agree...", "What are the pros and cons..."',
  create: 'Producing original work, designing solutions, synthesizing. Questions like "Design...", "What if...", "Create a new..."',
};

/**
 * System prompt for the tutor evaluation tool
 * Instructs the AI on how to evaluate questions
 */
export const TUTOR_EVALUATION_SYSTEM_PROMPT = `
You are an expert educational psychologist evaluating student questions to assess their cognitive level and subject knowledge.

When a student asks a question, analyze it based on:

1. **Bloom's Taxonomy Level**: Categorize the cognitive level of the question
   - remember: Basic recall (What is X? Define Y.)
   - understand: Comprehension (Explain why... What does X mean?)
   - apply: Application (How do I solve... Calculate...)
   - analyze: Analysis (Compare X and Y... What patterns...)
   - evaluate: Evaluation (Which is better... Do you agree...)
   - create: Creation (Design... What if... How might we...)

2. **Question Complexity** (1-10):
   - 1-3: Simple, straightforward questions
   - 4-6: Moderate complexity, requires some thinking
   - 7-10: Complex, multi-layered questions

3. **Demonstrates Understanding**: Does the question show the student already has some understanding of the topic?
   - true: Question shows prior knowledge or builds on understanding
   - false: Question suggests confusion or starting from scratch

4. **Reasoning Quality** (1-10):
   - How well-structured and thoughtful is the question?
   - Does it show logical thinking?

IMPORTANT: Only call the evaluation tool for substantive academic questions. Skip evaluation for:
- Greetings or small talk
- Simple clarifications like "Can you repeat that?"
- Off-topic questions
- Very short or unclear questions
`;

/**
 * Get the tool definition for user evaluation
 * This is used with the Vercel AI SDK
 */
export function getEvaluationToolDefinition() {
  return {
    name: 'evaluate_user_understanding',
    description: `Evaluate the student's question to assess their cognitive level and understanding. 
Call this tool for substantive academic questions to track the student's intellectual development.
Do NOT call for greetings, clarifications, or off-topic questions.`,
    parameters: {
      type: 'object',
      properties: {
        bloom_level: {
          type: 'string',
          enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
          description: 'The Bloom\'s taxonomy level of the question',
        },
        question_complexity: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Complexity score: 1-3 simple, 4-6 moderate, 7-10 complex',
        },
        demonstrates_understanding: {
          type: 'boolean',
          description: 'Whether the question shows prior understanding of the topic',
        },
        reasoning_quality: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Quality of reasoning/thinking shown in the question',
        },
        subject: {
          type: 'string',
          description: 'The academic subject (e.g., Physics, Mathematics, Chemistry)',
        },
        topic: {
          type: 'string',
          description: 'The specific topic within the subject',
        },
        chapter: {
          type: 'string',
          description: 'The chapter or unit if identifiable',
        },
      },
      required: ['bloom_level', 'question_complexity', 'demonstrates_understanding', 'reasoning_quality'],
    },
  };
}

/**
 * Example evaluations for reference
 */
export const EVALUATION_EXAMPLES = [
  {
    question: "What is Newton's first law of motion?",
    evaluation: {
      bloom_level: 'remember',
      question_complexity: 2,
      demonstrates_understanding: false,
      reasoning_quality: 3,
      subject: 'Physics',
      topic: "Newton's Laws of Motion",
    },
  },
  {
    question: "Why does an object at rest stay at rest unless acted upon by a force? Can you explain the concept of inertia?",
    evaluation: {
      bloom_level: 'understand',
      question_complexity: 5,
      demonstrates_understanding: true,
      reasoning_quality: 6,
      subject: 'Physics',
      topic: 'Inertia',
    },
  },
  {
    question: "If a car is moving at 60 km/h and suddenly brakes, how would I calculate the deceleration needed to stop in 5 seconds?",
    evaluation: {
      bloom_level: 'apply',
      question_complexity: 6,
      demonstrates_understanding: true,
      reasoning_quality: 7,
      subject: 'Physics',
      topic: 'Kinematics',
    },
  },
  {
    question: "How does the concept of inertia in physics relate to the economic concept of market inertia? Are there parallels in how systems resist change?",
    evaluation: {
      bloom_level: 'analyze',
      question_complexity: 8,
      demonstrates_understanding: true,
      reasoning_quality: 9,
      subject: 'Physics',
      topic: 'Inertia',
    },
  },
];
