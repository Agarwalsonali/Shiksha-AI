/**
 * Curriculum Data Module
 * Exports curriculum data for classes 9-12 (CBSE)
 */

import class9Data from './class9.json';
import class10Data from './class10.json';
import class11Data from './class11.json';
import class12Data from './class12.json';

// Type definitions
export interface Topic {
  name: string;
}

export interface Chapter {
  id: string;
  order: number;
  name: string;
  description: string;
  topics: string[];
  estimated_hours: number;
  weightage: 'low' | 'medium' | 'high';
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  total_chapters: number;
  chapters: Chapter[];
}

export interface CurriculumData {
  class: number;
  board: string;
  subjects: Subject[];
}

// Curriculum data map
const curriculumMap: Record<number, CurriculumData> = {
  9: class9Data as CurriculumData,
  10: class10Data as CurriculumData,
  11: class11Data as CurriculumData,
  12: class12Data as CurriculumData,
};

// Supported classes
export const SUPPORTED_CLASSES = [9, 10, 11, 12] as const;
export type SupportedClass = (typeof SUPPORTED_CLASSES)[number];

/**
 * Get curriculum data for a specific class
 */
export function getCurriculumByClass(classNum: number): CurriculumData | null {
  return curriculumMap[classNum] || null;
}

/**
 * Get all subjects for a class
 */
export function getSubjectsByClass(classNum: number): Subject[] {
  const curriculum = getCurriculumByClass(classNum);
  return curriculum?.subjects || [];
}

/**
 * Get a specific subject for a class
 */
export function getSubject(classNum: number, subjectId: string): Subject | null {
  const subjects = getSubjectsByClass(classNum);
  return subjects.find((s) => s.id === subjectId) || null;
}

/**
 * Get subject by name (case-insensitive)
 */
export function getSubjectByName(classNum: number, subjectName: string): Subject | null {
  const subjects = getSubjectsByClass(classNum);
  const normalizedName = subjectName.toLowerCase().trim();
  return (
    subjects.find(
      (s) =>
        s.name.toLowerCase() === normalizedName ||
        s.id.toLowerCase().includes(normalizedName)
    ) || null
  );
}

/**
 * Get chapters for a subject
 */
export function getChaptersBySubject(classNum: number, subjectId: string): Chapter[] {
  const subject = getSubject(classNum, subjectId);
  return subject?.chapters || [];
}

/**
 * Get a specific chapter by ID
 */
export function getChapterById(chapterId: string): {
  chapter: Chapter;
  subject: Subject;
  classNum: number;
} | null {
  for (const classNum of SUPPORTED_CLASSES) {
    const curriculum = getCurriculumByClass(classNum);
    if (!curriculum) continue;

    for (const subject of curriculum.subjects) {
      const chapter = subject.chapters.find((c) => c.id === chapterId);
      if (chapter) {
        return { chapter, subject, classNum };
      }
    }
  }
  return null;
}

/**
 * Get all chapters for a class (across all subjects)
 */
export function getAllChaptersByClass(classNum: number): Array<{
  chapter: Chapter;
  subject: Subject;
}> {
  const subjects = getSubjectsByClass(classNum);
  const chapters: Array<{ chapter: Chapter; subject: Subject }> = [];

  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      chapters.push({ chapter, subject });
    }
  }

  return chapters;
}

/**
 * Get total estimated hours for a subject
 */
export function getSubjectTotalHours(classNum: number, subjectId: string): number {
  const chapters = getChaptersBySubject(classNum, subjectId);
  return chapters.reduce((total, ch) => total + ch.estimated_hours, 0);
}

/**
 * Get chapter count statistics for a class
 */
export function getClassStats(classNum: number): {
  totalSubjects: number;
  totalChapters: number;
  totalEstimatedHours: number;
  subjectStats: Array<{
    subjectId: string;
    subjectName: string;
    chapterCount: number;
    estimatedHours: number;
  }>;
} {
  const subjects = getSubjectsByClass(classNum);

  const subjectStats = subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    chapterCount: s.chapters.length,
    estimatedHours: s.chapters.reduce((t, c) => t + c.estimated_hours, 0),
  }));

  return {
    totalSubjects: subjects.length,
    totalChapters: subjectStats.reduce((t, s) => t + s.chapterCount, 0),
    totalEstimatedHours: subjectStats.reduce((t, s) => t + s.estimatedHours, 0),
    subjectStats,
  };
}

/**
 * Validate if a class is supported
 */
export function isValidClass(classNum: number): classNum is SupportedClass {
  return SUPPORTED_CLASSES.includes(classNum as SupportedClass);
}

/**
 * Search chapters by name or topic (case-insensitive)
 */
export function searchChapters(
  query: string,
  classNum?: number
): Array<{
  chapter: Chapter;
  subject: Subject;
  classNum: number;
  matchType: 'name' | 'topic' | 'description';
}> {
  const results: Array<{
    chapter: Chapter;
    subject: Subject;
    classNum: number;
    matchType: 'name' | 'topic' | 'description';
  }> = [];

  const normalizedQuery = query.toLowerCase().trim();
  const classesToSearch = classNum ? [classNum] : [...SUPPORTED_CLASSES];

  for (const cls of classesToSearch) {
    const curriculum = getCurriculumByClass(cls);
    if (!curriculum) continue;

    for (const subject of curriculum.subjects) {
      for (const chapter of subject.chapters) {
        // Check chapter name
        if (chapter.name.toLowerCase().includes(normalizedQuery)) {
          results.push({ chapter, subject, classNum: cls, matchType: 'name' });
          continue;
        }

        // Check description
        if (chapter.description.toLowerCase().includes(normalizedQuery)) {
          results.push({ chapter, subject, classNum: cls, matchType: 'description' });
          continue;
        }

        // Check topics
        const topicMatch = chapter.topics.some((t) =>
          t.toLowerCase().includes(normalizedQuery)
        );
        if (topicMatch) {
          results.push({ chapter, subject, classNum: cls, matchType: 'topic' });
        }
      }
    }
  }

  return results;
}

// Default export
export default curriculumMap;
