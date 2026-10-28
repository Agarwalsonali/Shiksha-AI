/**
 * Topic Detection Result
 */
export interface TopicDetection {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  confidence: number; // 0.0 to 1.0
}

/**
 * Generate prompt for detecting subject/chapter/topic from student question
 */
export const getDetectionPrompt = (
  userMessage: string,
  studentClass: number,
  studentBoard: string = 'CBSE'
): string => {
  return `Analyze this student's question and detect the academic context.

**Student Question:** "${userMessage}"
**Student Class:** ${studentClass}
**Board:** ${studentBoard}

Your task is to identify:
1. **Subject**: Which subject does this question relate to? (e.g., Science, Mathematics, Social Science, English, Hindi)
2. **Chapter**: Which specific chapter from the NCERT Class ${studentClass} textbook?
3. **Topic**: What is the specific topic/concept within that chapter?
4. **Confidence**: How confident are you in this detection? (0.0 = not at all, 1.0 = very confident)

**Guidelines:**
- Base your detection on NCERT Class ${studentClass} ${studentBoard} curriculum
- If the question is vague or non-academic, set all fields to null with confidence 0.0
- If you're unsure about chapter/topic but confident about subject, that's okay
- Common subjects: Science (Physics/Chemistry/Biology), Mathematics, Social Science (History/Geography/Civics), English, Hindi
- For Science in Class 6-10, don't split into Physics/Chemistry/Biology - keep it as "Science"

**Examples:**

Question: "What is photosynthesis?"
→ Subject: Science, Chapter: "Nutrition in Plants", Topic: "Photosynthesis", Confidence: 0.95

Question: "Explain quadratic formula"
→ Subject: Mathematics, Chapter: "Quadratic Equations", Topic: "Quadratic Formula", Confidence: 0.9

Question: "Who was the first PM of India?"
→ Subject: Social Science, Chapter: "The Making of Indian Constitution", Topic: "First Prime Minister", Confidence: 0.85

Question: "Hi, how are you?"
→ Subject: null, Chapter: null, Topic: null, Confidence: 0.0 (not academic)

**Output Format:**
Return ONLY a valid JSON object (no markdown, no explanation):

{
  "subject": "Science",
  "chapter": "Motion",
  "topic": "Newton's First Law",
  "confidence": 0.92
}

Analyze the student's question now and return the JSON:`;
};

/**
 * Generate prompt for detecting weak topics from conversation
 */
export const getWeakTopicDetectionPrompt = (
  conversationHistory: string,
  studentClass: number
): string => {
  return `Analyze this tutoring conversation and identify topics where the student seems to struggle.

**Conversation:**
${conversationHistory}

**Student Class:** ${studentClass}

Look for indicators of struggle:
- Multiple questions about the same concept
- Confusion or misunderstanding in student responses
- Need for repeated explanations
- Requests for "simpler" explanations
- Incorrect assumptions or misconceptions

**Output Format:**
Return a JSON array of weak topics:

[
  {
    "topic": "Newton's First Law",
    "subject": "Science",
    "chapter": "Motion",
    "confidence": 0.85,
    "reason": "Student asked multiple clarifying questions and showed confusion about the concept of inertia"
  }
]

If no clear weak topics detected, return an empty array [].`;
};

/**
 * Generate prompt for intent classification
 */
export const getIntentClassificationPrompt = (userMessage: string): string => {
  return `Classify the intent of this student's message.

**Message:** "${userMessage}"

**Possible Intents:**
1. **ask_question** - Student is asking a doubt or question about a concept
2. **request_explanation** - Student wants a concept explained or clarified
3. **request_quiz** - Student wants to practice or test their knowledge
4. **request_study_plan** - Student wants help with planning or organizing study
5. **seek_motivation** - Student is looking for encouragement or motivation
6. **casual_chat** - General conversation, greetings, non-academic
7. **unclear** - Intent is not clear

**Output Format:**
Return ONLY a JSON object:

{
  "intent": "ask_question",
  "confidence": 0.9,
  "academic": true
}

- **intent**: One of the 7 categories above
- **confidence**: 0.0 to 1.0
- **academic**: true if related to studies, false otherwise

Classify now:`;
};

/**
 * Generate prompt for difficulty estimation
 */
export const getDifficultyEstimationPrompt = (
  question: string,
  studentClass: number,
  subject: string
): string => {
  return `Estimate the difficulty level of this question for a Class ${studentClass} student.

**Question:** ${question}
**Subject:** ${subject}
**Class:** ${studentClass}

**Difficulty Levels:**
- **easy**: Direct recall, basic definitions, simple facts from NCERT
- **medium**: Application of concepts, two-step problems, understanding relationships
- **hard**: Analysis, multi-concept integration, complex problem-solving

**Output Format:**
Return ONLY a JSON object:

{
  "difficulty": "medium",
  "confidence": 0.85,
  "reasoning": "Requires understanding of concept and applying it to a new scenario"
}

Estimate now:`;
};
