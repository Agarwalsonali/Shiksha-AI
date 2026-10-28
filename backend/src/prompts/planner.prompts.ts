/**
 * Study Plan Context
 */
export interface PlannerPromptContext {
  studentClass: number;
  board: string;
  subject: string;
  examDate: string; // ISO date string
  weakTopics: string[];
  strongTopics: string[];
  dailyStudyHours: number;
  currentDate?: string; // ISO date string
}

/**
 * Study Plan Structure
 */
export interface StudyPlan {
  title: string;
  total_days: number;
  daily_hours: number;
  phases: StudyPhase[];
}

export interface StudyPhase {
  name: string;
  duration_days: number;
  focus: string;
  tasks: StudyTask[];
}

export interface StudyTask {
  day: number;
  title: string;
  description: string;
  estimated_hours: number;
  resources: string[];
  topics: string[];
}

/**
 * Calculate days until exam
 */
const calculateDaysUntilExam = (examDate: string, currentDate?: string): number => {
  const exam = new Date(examDate);
  const today = currentDate ? new Date(currentDate) : new Date();
  const diffTime = exam.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1); // At least 1 day
};

/**
 * Generate study plan creation prompt
 */
export const getStudyPlanPrompt = (context: PlannerPromptContext): string => {
  const daysUntilExam = calculateDaysUntilExam(context.examDate, context.currentDate);
  const totalStudyHours = daysUntilExam * context.dailyStudyHours;

  // Calculate phase durations (Foundation 40%, Practice 40%, Revision 20%)
  const foundationDays = Math.ceil(daysUntilExam * 0.4);
  const practiceDays = Math.ceil(daysUntilExam * 0.4);
  const revisionDays = daysUntilExam - foundationDays - practiceDays;

  return `Create a personalized study plan for a Class ${context.studentClass} ${context.board} student preparing for ${context.subject} exam.

**Student Profile:**
- Class: ${context.studentClass}
- Board: ${context.board}
- Subject: ${context.subject}
- Days until exam: ${daysUntilExam}
- Daily study hours available: ${context.dailyStudyHours}
- Total study hours available: ${totalStudyHours}

**Weak Topics (PRIORITIZE THESE):**
${context.weakTopics.length > 0 ? context.weakTopics.map(t => `- ${t}`).join('\n') : '- None identified yet'}

**Strong Topics (Quick revision only):**
${context.strongTopics.length > 0 ? context.strongTopics.map(t => `- ${t}`).join('\n') : '- None identified yet'}

**Plan Structure:**

**Phase 1: Foundation Building (${foundationDays} days, ~40%)**
- Cover all chapters systematically
- **Prioritize weak topics** - allocate more time here
- Focus on understanding concepts from NCERT
- Take detailed notes
- Solve NCERT examples and in-text questions

**Phase 2: Practice & Application (${practiceDays} days, ~40%)**
- Solve NCERT exercise questions
- Practice numerical problems
- Work on previous year questions
- **More practice on weak topics**
- Self-assessment quizzes

**Phase 3: Revision & Consolidation (${revisionDays} days, ~20%)**
- Quick revision of all chapters
- Focus on formulas, definitions, key concepts
- Solve sample papers
- **Quick drill on weak topics**
- Last-minute doubt clearing

**Requirements:**
1. **Realistic Tasks**: Each day's tasks should fit in ${context.dailyStudyHours} hours
2. **NCERT First**: Base all resources on NCERT textbook (mention chapter numbers and page ranges)
3. **Weak Topic Priority**: Allocate 60% of time to weak topics, 40% to other topics
4. **Balanced**: Include reading, solving, practice, and revision
5. **Breaks**: Include short breaks between study sessions
6. **Flexibility**: Some buffer days for unexpected delays

**Output Format:**
Return ONLY a valid JSON object (no markdown):

{
  "title": "Class ${context.studentClass} ${context.subject} - ${daysUntilExam} Day Study Plan",
  "total_days": ${daysUntilExam},
  "daily_hours": ${context.dailyStudyHours},
  "phases": [
    {
      "name": "Foundation Building",
      "duration_days": ${foundationDays},
      "focus": "Understanding core concepts from NCERT",
      "tasks": [
        {
          "day": 1,
          "title": "Chapter 1: Introduction to [Topic]",
          "description": "Read NCERT Chapter 1, understand key definitions and concepts. Focus on [specific weak topic if applicable].",
          "estimated_hours": ${context.dailyStudyHours},
          "resources": ["NCERT Class ${context.studentClass} ${context.subject} Ch 1 (pg 1-15)", "NCERT Examples 1.1-1.5"],
          "topics": ["Topic 1", "Topic 2"]
        }
      ]
    }
  ]
}

Generate the complete study plan now:`;
};

/**
 * Generate prompt for daily task recommendations
 */
export const getDailyTaskPrompt = (
  currentDay: number,
  studyPlan: StudyPlan,
  completedTasks: string[],
  studentPerformance: { topic: string; score: number }[]
): string => {
  return `Generate today's study tasks based on the student's progress.

**Current Day:** Day ${currentDay} of ${studyPlan.total_days}
**Daily Study Hours:** ${studyPlan.daily_hours}

**Original Plan Progress:**
${JSON.stringify(studyPlan, null, 2)}

**Completed Tasks:**
${completedTasks.length > 0 ? completedTasks.join('\n') : 'None yet'}

**Recent Performance:**
${studentPerformance.map(p => `- ${p.topic}: ${p.score}%`).join('\n')}

**Instructions:**
1. If student is behind schedule, prioritize catching up
2. If student scored <60% on any topic, add extra practice for that topic
3. Maintain the original plan's structure but adapt based on progress
4. Keep total time within ${studyPlan.daily_hours} hours

Return today's recommended tasks as a JSON array.`;
};

/**
 * Generate prompt for study plan adjustment
 */
export const getStudyPlanAdjustmentPrompt = (
  originalPlan: StudyPlan,
  completedDays: number,
  weaknessesIdentified: string[],
  newExamDate?: string
): string => {
  return `Adjust this study plan based on student's progress and new information.

**Original Plan:**
${JSON.stringify(originalPlan, null, 2)}

**Progress:**
- Days completed: ${completedDays} / ${originalPlan.total_days}
- Days remaining: ${originalPlan.total_days - completedDays}

**Newly Identified Weaknesses:**
${weaknessesIdentified.map(w => `- ${w}`).join('\n')}

${newExamDate ? `**New Exam Date:** ${newExamDate}` : ''}

**Instructions:**
1. Keep completed days as-is
2. Adjust remaining days to address new weaknesses
3. If exam date changed, recalculate the entire timeline
4. Maintain the 40-40-20 phase split for remaining days
5. Ensure all critical topics are covered

Return the updated study plan as a complete JSON object.`;
};

/**
 * Generate motivational message for study plan
 */
export const getMotivationalPrompt = (
  daysCompleted: number,
  totalDays: number,
  recentScore: number
): string => {
  const progress = (daysCompleted / totalDays) * 100;
  
  return `Generate a short, encouraging message for a student.

**Progress:** ${daysCompleted}/${totalDays} days completed (${Math.round(progress)}%)
**Recent Quiz Score:** ${recentScore}%

The message should:
- Be 2-3 sentences
- Acknowledge their progress
- Encourage them to keep going
- Be culturally appropriate for Indian students
- Reference their score (praise if good, motivate if needs improvement)

Example: "Great job completing Day ${daysCompleted}! You've covered ${Math.round(progress)}% of your study plan. Your ${recentScore}% score shows you're making solid progress - keep up the excellent work!"

Generate an encouraging message now:`;
};

// =============================================================================
// CHAPTER-WISE PLANNING
// =============================================================================

/**
 * Chapter information for planning
 */
export interface ChapterInfo {
  id: string;
  name: string;
  subject: string;
  estimated_hours: number;
  weightage: 'low' | 'medium' | 'high';
  order: number;
  is_priority?: boolean;
  progress_percent?: number; // Current progress if any
}

/**
 * Chapter Plan Context
 */
export interface ChapterPlanContext {
  studentClass: number;
  board: string;
  subject: string;
  chapters: ChapterInfo[];
  deadline: string; // ISO date string
  dailyStudyHours: number;
  includeRevision: boolean;
  revisionDays: number;
  currentDate: string;
}

/**
 * Chapter-wise Study Plan Structure
 */
export interface ChapterStudyPlan {
  title: string;
  subject: string;
  deadline: string;
  total_days: number;
  total_chapters: number;
  daily_hours: number;
  schedule: ChapterDaySchedule[];
  revision_schedule?: RevisionDaySchedule[];
}

export interface ChapterDaySchedule {
  day: number;
  date: string;
  chapter_id: string;
  chapter_name: string;
  focus_areas: string[];
  estimated_hours: number;
  tasks: ChapterTask[];
  is_revision: boolean;
}

export interface ChapterTask {
  title: string;
  description: string;
  duration_minutes: number;
  type: 'read' | 'practice' | 'solve' | 'revise' | 'quiz';
}

export interface RevisionDaySchedule {
  day: number;
  date: string;
  chapters_to_revise: string[]; // Chapter IDs
  focus: string;
  estimated_hours: number;
}

/**
 * Calculate available days between dates
 */
const calculateAvailableDays = (deadline: string, currentDate: string): number => {
  const end = new Date(deadline);
  const start = new Date(currentDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
};

/**
 * Generate chapter-wise study plan prompt
 */
export const getChapterPlanPrompt = (context: ChapterPlanContext): string => {
  const availableDays = calculateAvailableDays(context.deadline, context.currentDate);
  const studyDays = context.includeRevision ? availableDays - context.revisionDays : availableDays;
  const totalEstimatedHours = context.chapters.reduce((sum, ch) => sum + ch.estimated_hours, 0);
  const totalAvailableHours = studyDays * context.dailyStudyHours;

  // Sort chapters: priority first, then by order
  const sortedChapters = [...context.chapters].sort((a, b) => {
    if (a.is_priority && !b.is_priority) return -1;
    if (!a.is_priority && b.is_priority) return 1;
    return a.order - b.order;
  });

  // Calculate chapters per day (rough estimate)
  const hoursPerDay = context.dailyStudyHours;
  
  return `Create a chapter-wise study schedule for a Class ${context.studentClass} ${context.board} student.

**Planning Parameters:**
- Subject: ${context.subject}
- Total Chapters: ${context.chapters.length}
- Deadline: ${context.deadline}
- Days Available: ${availableDays} (${studyDays} study days + ${context.revisionDays} revision days)
- Daily Study Hours: ${context.dailyStudyHours}
- Total Hours Needed: ~${totalEstimatedHours} hours
- Total Hours Available: ${totalAvailableHours} hours
- Current Date: ${context.currentDate}

**Chapters to Cover (in priority order):**
${sortedChapters.map((ch, i) => 
  `${i + 1}. ${ch.name} (ID: ${ch.id})
   - Estimated: ${ch.estimated_hours} hours
   - Weightage: ${ch.weightage}
   - Progress: ${ch.progress_percent || 0}%
   - Priority: ${ch.is_priority ? 'HIGH' : 'Normal'}`
).join('\n')}

**Scheduling Rules:**
1. **Priority chapters first** - Cover chapters marked as priority earlier
2. **Respect estimated hours** - Don't cram more than ${hoursPerDay} hours per day
3. **Logical grouping** - If a chapter takes more than one day, split it logically
4. **High-weightage chapters** - Allocate more time to high-weightage chapters
5. **Already started chapters** - Continue from where left off (check progress %)
6. **Buffer time** - Leave 10-15% buffer for catching up

**Task Types per Chapter:**
- **read**: Reading and understanding concepts (40% of time)
- **practice**: Solving examples and practice problems (30% of time)
- **solve**: NCERT exercises and textbook questions (20% of time)
- **quiz**: Self-assessment and quick tests (10% of time)

${context.includeRevision ? `**Revision Phase (Last ${context.revisionDays} days):**
- Quick revision of all chapters
- Focus on formulas, key concepts, important topics
- Previous year questions
- Mock tests` : ''}

**Output Format:**
Return ONLY a valid JSON object with the following structure:

{
  "title": "${context.subject} Chapter Plan - ${availableDays} Days",
  "subject": "${context.subject}",
  "deadline": "${context.deadline}",
  "total_days": ${availableDays},
  "total_chapters": ${context.chapters.length},
  "daily_hours": ${context.dailyStudyHours},
  "schedule": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "chapter_id": "${sortedChapters[0]?.id || 'chapter-id'}",
      "chapter_name": "${sortedChapters[0]?.name || 'Chapter Name'}",
      "focus_areas": ["Specific topic 1", "Specific topic 2"],
      "estimated_hours": ${Math.min(hoursPerDay, sortedChapters[0]?.estimated_hours || hoursPerDay)},
      "tasks": [
        {
          "title": "Read Chapter Introduction",
          "description": "Read and understand the basic concepts",
          "duration_minutes": 45,
          "type": "read"
        },
        {
          "title": "Practice Examples",
          "description": "Work through solved examples 1.1 to 1.5",
          "duration_minutes": 30,
          "type": "practice"
        }
      ],
      "is_revision": false
    }
  ]${context.includeRevision ? `,
  "revision_schedule": [
    {
      "day": ${studyDays + 1},
      "date": "YYYY-MM-DD",
      "chapters_to_revise": ["chapter-id-1", "chapter-id-2"],
      "focus": "Quick revision of formulas and key concepts",
      "estimated_hours": ${context.dailyStudyHours}
    }
  ]` : ''}
}

**Important:**
- Generate dates starting from ${context.currentDate}
- Each day should have 2-4 tasks totaling ${context.dailyStudyHours * 60} minutes
- Cover ALL ${context.chapters.length} chapters before revision phase
- If time is tight, combine similar chapters or reduce depth

Generate the complete chapter-wise study plan now:`;
};

/**
 * Generate prompt for rescheduling/adjusting a chapter plan
 */
export const getChapterPlanAdjustmentPrompt = (
  originalPlan: ChapterStudyPlan,
  completedChapterIds: string[],
  missedDays: number,
  newDeadline?: string
): string => {
  const remainingChapters = originalPlan.schedule.filter(
    s => !completedChapterIds.includes(s.chapter_id) && !s.is_revision
  );

  return `Adjust this chapter-wise study plan based on progress.

**Original Plan:**
- Title: ${originalPlan.title}
- Total Days: ${originalPlan.total_days}
- Total Chapters: ${originalPlan.total_chapters}
- Daily Hours: ${originalPlan.daily_hours}

**Progress:**
- Chapters Completed: ${completedChapterIds.length} / ${originalPlan.total_chapters}
- Missed Days: ${missedDays}
- Remaining Chapters: ${remainingChapters.length}

**Completed Chapters:**
${completedChapterIds.join(', ') || 'None'}

**Remaining Chapters:**
${remainingChapters.map(s => `- ${s.chapter_name} (${s.chapter_id})`).join('\n')}

${newDeadline ? `**New Deadline:** ${newDeadline}` : `**Original Deadline:** ${originalPlan.deadline}`}

**Instructions:**
1. Keep completed chapters as-is
2. Reschedule remaining chapters to fit available time
3. If behind schedule, consider:
   - Combining chapters with similar topics
   - Reducing time on easier chapters
   - Prioritizing high-weightage chapters
4. Maintain revision time if possible
5. Generate realistic daily schedules

Return the adjusted plan as a complete JSON object in the same format.`;
};

/**
 * Generate daily summary for a chapter plan
 */
export const getChapterDailySummaryPrompt = (
  todaySchedule: ChapterDaySchedule,
  yesterdayCompleted: boolean,
  overallProgress: number
): string => {
  return `Generate a brief motivational daily summary.

**Today's Schedule:**
- Chapter: ${todaySchedule.chapter_name}
- Focus Areas: ${todaySchedule.focus_areas.join(', ')}
- Estimated Time: ${todaySchedule.estimated_hours} hours
- Tasks: ${todaySchedule.tasks.length} tasks

**Progress:**
- Yesterday: ${yesterdayCompleted ? 'Completed!' : 'Not completed'}
- Overall: ${overallProgress}%

Generate a 2-3 sentence motivational message that:
1. Mentions today's chapter
2. Acknowledges yesterday's progress (or encourages if missed)
3. Motivates to complete today's goals

Keep it brief, encouraging, and student-friendly.`;
};

// =============================================================================
// TOPIC-WISE PLANNING
// =============================================================================

/**
 * Topic information for planning
 */
export interface TopicInfo {
  name: string;
  order: number;
  is_priority?: boolean;
}

/**
 * Chapter details for topic planning
 */
export interface ChapterDetails {
  id: string;
  name: string;
  description: string;
  topics: TopicInfo[];
  estimated_hours: number;
  weightage: 'low' | 'medium' | 'high';
  progress_percent?: number;
}

/**
 * Topic Plan Context
 */
export interface TopicPlanContext {
  studentClass: number;
  board: string;
  subject: string;
  chapter: ChapterDetails;
  deadline: string;
  dailyStudyHours: number;
  includeQuiz: boolean;
  currentDate: string;
}

/**
 * Topic-wise Study Plan Structure
 */
export interface TopicStudyPlan {
  title: string;
  subject: string;
  chapter_id: string;
  chapter_name: string;
  deadline: string;
  total_days: number;
  total_topics: number;
  daily_hours: number;
  topics: TopicSchedule[];
  quiz_day?: number;
}

export interface TopicSchedule {
  day: number;
  date: string;
  topic_name: string;
  topic_order: number;
  priority: 'high' | 'medium' | 'low';
  estimated_minutes: number;
  learning_objectives: string[];
  tasks: TopicTask[];
}

export interface TopicTask {
  title: string;
  description: string;
  duration_minutes: number;
  type: 'read' | 'understand' | 'practice' | 'solve' | 'memorize';
}

/**
 * Calculate available days between dates
 */
const calculateTopicPlanDays = (deadline: string, currentDate: string): number => {
  const end = new Date(deadline);
  const start = new Date(currentDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
};

/**
 * Generate topic-wise study plan prompt
 */
export const getTopicPlanPrompt = (context: TopicPlanContext): string => {
  const availableDays = calculateTopicPlanDays(context.deadline, context.currentDate);
  const totalMinutesPerDay = context.dailyStudyHours * 60;
  
  // Calculate minutes per topic (rough estimate)
  const totalTopics = context.chapter.topics.length;
  const estimatedMinutesPerTopic = Math.floor((context.chapter.estimated_hours * 60) / totalTopics);

  // Sort topics: priority first, then by order
  const sortedTopics = [...context.chapter.topics].sort((a, b) => {
    if (a.is_priority && !b.is_priority) return -1;
    if (!a.is_priority && b.is_priority) return 1;
    return a.order - b.order;
  });

  return `Create a topic-wise study schedule for a Class ${context.studentClass} ${context.board} student.

**Planning Parameters:**
- Subject: ${context.subject}
- Chapter: ${context.chapter.name} (ID: ${context.chapter.id})
- Chapter Description: ${context.chapter.description}
- Total Topics: ${totalTopics}
- Deadline: ${context.deadline}
- Days Available: ${availableDays}
- Daily Study Hours: ${context.dailyStudyHours} (${totalMinutesPerDay} minutes)
- Chapter Estimated Hours: ${context.chapter.estimated_hours}
- Chapter Weightage: ${context.chapter.weightage}
- Current Progress: ${context.chapter.progress_percent || 0}%
- Current Date: ${context.currentDate}
- Include Quiz: ${context.includeQuiz}

**Topics to Cover (in order):**
${sortedTopics.map((t, i) => 
  `${i + 1}. ${t.name}
   - Order: ${t.order}
   - Priority: ${t.is_priority ? 'HIGH' : 'Normal'}
   - Estimated: ~${estimatedMinutesPerTopic} minutes`
).join('\n')}

**Scheduling Rules:**
1. **Priority topics first** - Cover priority topics earlier in the schedule
2. **Logical flow** - Follow the natural order of topics when possible
3. **Time limits** - Each day should have max ${totalMinutesPerDay} minutes of study
4. **Multiple topics per day** - If time allows, cover 2-3 related topics together
5. **High-weightage chapter** - This is a ${context.chapter.weightage}-weightage chapter, allocate time accordingly
6. **Balanced tasks** - Each topic should have reading, understanding, and practice tasks

**Priority Levels for Topics:**
- **high**: Complex/important topics, need more time (${Math.round(estimatedMinutesPerTopic * 1.3)} min)
- **medium**: Standard topics (${estimatedMinutesPerTopic} min)
- **low**: Simpler/introductory topics (${Math.round(estimatedMinutesPerTopic * 0.7)} min)

**Task Types per Topic:**
- **read**: Initial reading of the topic (20% of time)
- **understand**: Deep understanding, diagrams, notes (30% of time)
- **practice**: Worked examples, NCERT solved (25% of time)
- **solve**: Exercise problems (20% of time)
- **memorize**: Formulas, definitions (5% of time)

${context.includeQuiz ? `**Quiz:**
- Add a quiz task on the final day after all topics
- Quiz should cover all topics in the chapter
- Quiz day number should be ${availableDays}` : ''}

**Output Format:**
Return ONLY a valid JSON object:

{
  "title": "${context.chapter.name} - Topic-wise Study Plan",
  "subject": "${context.subject}",
  "chapter_id": "${context.chapter.id}",
  "chapter_name": "${context.chapter.name}",
  "deadline": "${context.deadline}",
  "total_days": ${availableDays},
  "total_topics": ${totalTopics},
  "daily_hours": ${context.dailyStudyHours},
  "topics": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "topic_name": "${sortedTopics[0]?.name || 'Topic Name'}",
      "topic_order": ${sortedTopics[0]?.order || 1},
      "priority": "high",
      "estimated_minutes": ${estimatedMinutesPerTopic},
      "learning_objectives": [
        "Understand the concept of...",
        "Learn to apply..."
      ],
      "tasks": [
        {
          "title": "Read Topic Introduction",
          "description": "Read NCERT section on this topic",
          "duration_minutes": 15,
          "type": "read"
        },
        {
          "title": "Understand Key Concepts",
          "description": "Make notes on important points and diagrams",
          "duration_minutes": 20,
          "type": "understand"
        },
        {
          "title": "Practice Examples",
          "description": "Work through solved examples",
          "duration_minutes": 15,
          "type": "practice"
        }
      ]
    }
  ]${context.includeQuiz ? `,
  "quiz_day": ${availableDays}` : ''}
}

**Important:**
- Generate dates starting from ${context.currentDate}
- Cover ALL ${totalTopics} topics
- Each topic should have 3-5 tasks
- Total minutes per day should not exceed ${totalMinutesPerDay}
- If a topic is complex, it can span multiple days

Generate the complete topic-wise study plan now:`;
};
