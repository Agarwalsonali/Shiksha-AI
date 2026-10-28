/**
 * Tutor Types
 * Types for AI Tutor chat sessions and messages
 */

// Answer modes for tutor responses
export type AnswerMode = 'simple' | 'quick' | 'detailed' | 'exam';

// Icon types for answer modes
export type AnswerModeIconType = 'lightbulb' | 'flashlight' | 'book' | 'focus';

// Answer mode configuration for UI
export const ANSWER_MODES: Record<AnswerMode, { label: string; description: string; iconType: AnswerModeIconType }> = {
  simple: {
    label: 'Simple',
    description: 'Easy to understand explanations',
    iconType: 'lightbulb',
  },
  quick: {
    label: 'Quick',
    description: 'Brief, to-the-point answers',
    iconType: 'flashlight',
  },
  detailed: {
    label: 'Detailed',
    description: 'Comprehensive explanations',
    iconType: 'book',
  },
  exam: {
    label: 'Exam',
    description: 'Exam-ready formatted answers',
    iconType: 'focus',
  },
};

// Detected topic from AI analysis
export interface DetectedTopic {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  confidence: number;
}

// Tutor session
export interface TutorSession {
  id: string;
  title: string;
  detected_subject: string | null;
  detected_chapter: string | null;
  message_count: number;
  started_at: string;
  last_active_at: string;
}

// Tutor message
export interface TutorMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  detected_subject?: string | null;
  detected_chapter?: string | null;
  detected_topic?: string | null;
  detection_confidence?: number | null;
  answer_mode?: AnswerMode | null;
  created_at: string;
}

// SSE Event types
export interface TutorMetadataEvent {
  type: 'metadata';
  session_id: string;
  is_new_session: boolean;
  is_follow_up: boolean;
  rag_results: number;
  detected?: DetectedTopic; // Optional - may not be present initially
}

export interface TutorTokenEvent {
  type: 'token';
  text: string;
}

export interface TutorDoneEvent {
  type: 'done';
  session_id: string;
  session_title?: string;
  detected: DetectedTopic;
}

export interface TutorErrorEvent {
  type: 'error';
  message: string;
}

export type TutorSSEEvent = TutorMetadataEvent | TutorTokenEvent | TutorDoneEvent | TutorErrorEvent;

// API response types
export interface ListSessionsResponse {
  sessions: TutorSession[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSessionResponse {
  session: TutorSession;
  messages: TutorMessage[];
}

// Ask question params
export interface AskQuestionParams {
  session_id?: string;
  question: string;
  answer_mode?: AnswerMode;
  subject?: string;
  chapter?: string;
}

// Subject icon types
export type SubjectIconType = 
  | 'atom' 
  | 'flask' 
  | 'seedling' 
  | 'calculator' 
  | 'microscope' 
  | 'globe' 
  | 'history' 
  | 'map' 
  | 'pencil' 
  | 'lightbulb'
  | 'graduation';

// Suggested question for empty state
export interface SuggestedQuestion {
  text: string;
  subject: string;
  iconType: SubjectIconType;
}

// Get suggested questions based on user's subjects
export const getSuggestedQuestions = (subjects: string[]): SuggestedQuestion[] => {
  const questionsBySubject: Record<string, SuggestedQuestion[]> = {
    Physics: [
      { text: "Explain Newton's first law of motion", subject: 'Physics', iconType: 'atom' },
      { text: "What is the difference between speed and velocity?", subject: 'Physics', iconType: 'atom' },
      { text: "How does a simple pendulum work?", subject: 'Physics', iconType: 'atom' },
    ],
    Chemistry: [
      { text: "What is the difference between atoms and molecules?", subject: 'Chemistry', iconType: 'flask' },
      { text: "Explain the pH scale", subject: 'Chemistry', iconType: 'flask' },
      { text: "What are the states of matter?", subject: 'Chemistry', iconType: 'flask' },
    ],
    Biology: [
      { text: "Explain the process of photosynthesis", subject: 'Biology', iconType: 'seedling' },
      { text: "What is the structure of a cell?", subject: 'Biology', iconType: 'seedling' },
      { text: "How does the human heart work?", subject: 'Biology', iconType: 'seedling' },
    ],
    Mathematics: [
      { text: "How do I solve quadratic equations?", subject: 'Mathematics', iconType: 'calculator' },
      { text: "Explain the Pythagorean theorem", subject: 'Mathematics', iconType: 'calculator' },
      { text: "What are the properties of triangles?", subject: 'Mathematics', iconType: 'calculator' },
    ],
    Science: [
      { text: "Explain the water cycle", subject: 'Science', iconType: 'microscope' },
      { text: "What causes earthquakes?", subject: 'Science', iconType: 'microscope' },
      { text: "How do plants make food?", subject: 'Science', iconType: 'microscope' },
    ],
    'Social Science': [
      { text: "What were the causes of the French Revolution?", subject: 'Social Science', iconType: 'globe' },
      { text: "Explain the three branches of government", subject: 'Social Science', iconType: 'globe' },
      { text: "What is democracy?", subject: 'Social Science', iconType: 'globe' },
    ],
    History: [
      { text: "Who was the first Prime Minister of India?", subject: 'History', iconType: 'history' },
      { text: "What was the Indian Independence Movement?", subject: 'History', iconType: 'history' },
      { text: "Explain the Mughal Empire", subject: 'History', iconType: 'history' },
    ],
    Geography: [
      { text: "What are the major climate zones?", subject: 'Geography', iconType: 'map' },
      { text: "Explain the water cycle", subject: 'Geography', iconType: 'map' },
      { text: "What causes seasons on Earth?", subject: 'Geography', iconType: 'map' },
    ],
    English: [
      { text: "What are the parts of speech?", subject: 'English', iconType: 'pencil' },
      { text: "How do I write a good essay?", subject: 'English', iconType: 'pencil' },
      { text: "Explain active and passive voice", subject: 'English', iconType: 'pencil' },
    ],
  };

  const questions: SuggestedQuestion[] = [];
  
  // Get 1-2 questions from each of the user's subjects
  for (const subject of subjects) {
    const subjectQuestions = questionsBySubject[subject] || [];
    questions.push(...subjectQuestions.slice(0, 2));
  }

  // If we have less than 6, add some general ones
  if (questions.length < 6) {
    const generalQuestions: SuggestedQuestion[] = [
      { text: "Help me understand a concept", subject: 'General', iconType: 'lightbulb' },
      { text: "Can you explain this topic simply?", subject: 'General', iconType: 'graduation' },
    ];
    questions.push(...generalQuestions);
  }

  // Return max 6 questions, shuffled
  return questions.slice(0, 6);
};
