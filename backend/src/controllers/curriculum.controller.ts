import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/apiResponse';
import { NotFoundError, ValidationError } from '../utils/apiError';
import { logger } from '../utils/logger';
import {
  getCurriculumByClass,
  getSubject,
  getSubjectByName,
  getChapterById,
  getChaptersBySubject,
  getClassStats,
  searchChapters,
  isValidClass,
  SUPPORTED_CLASSES,
} from '../data/curriculum';
import type {
  GetCurriculumInput,
  GetSubjectInput,
  GetChapterInput,
  SearchChaptersInput,
  GetClassStatsInput,
} from '../schemas/curriculum.schema';

/**
 * Get full curriculum for a class
 * GET /api/curriculum/:class
 */
export const getCurriculum = async (req: Request, res: Response) => {
  const { class: classParam } = req.params;
  const classNum = Number(classParam);

  logger.info({ class: classNum }, 'Fetching curriculum');

  if (!isValidClass(classNum)) {
    throw new ValidationError(`Invalid class. Supported classes: ${SUPPORTED_CLASSES.join(', ')}`);
  }

  const curriculum = getCurriculumByClass(classNum);

  if (!curriculum) {
    throw new NotFoundError(`Curriculum not found for class ${classNum}`);
  }

  res.json(
    successResponse({
      curriculum: {
        class: curriculum.class,
        board: curriculum.board,
        subjects: curriculum.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          color: s.color,
          total_chapters: s.total_chapters,
          chapters: s.chapters.map((ch) => ({
            id: ch.id,
            order: ch.order,
            name: ch.name,
            description: ch.description,
            estimated_hours: ch.estimated_hours,
            weightage: ch.weightage,
            topics_count: ch.topics.length,
          })),
        })),
      },
    })
  );
};

/**
 * Get subject details with chapters
 * GET /api/curriculum/:class/:subject
 */
export const getSubjectDetails = async (req: Request, res: Response) => {
  const { class: classParam, subject: subjectParam } = req.params;
  if (typeof classParam !== 'string' || typeof subjectParam !== 'string') {
    throw new ValidationError('Class and subject are required');
  }

  const classNum = Number(classParam);

  logger.info({ class: classNum, subject: subjectParam }, 'Fetching subject details');

  if (!isValidClass(classNum)) {
    throw new ValidationError(`Invalid class. Supported classes: ${SUPPORTED_CLASSES.join(', ')}`);
  }

  // Try to find by ID first, then by name
  let subject = getSubject(classNum, subjectParam);
  if (!subject) {
    subject = getSubjectByName(classNum, subjectParam);
  }

  if (!subject) {
    throw new NotFoundError(`Subject '${subjectParam}' not found for class ${classNum}`);
  }

  const totalHours = subject.chapters.reduce((t, ch) => t + ch.estimated_hours, 0);

  res.json(
    successResponse({
      subject: {
        id: subject.id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
        total_chapters: subject.total_chapters,
        total_estimated_hours: totalHours,
        chapters: subject.chapters.map((ch) => ({
          id: ch.id,
          order: ch.order,
          name: ch.name,
          description: ch.description,
          topics: ch.topics,
          estimated_hours: ch.estimated_hours,
          weightage: ch.weightage,
        })),
      },
    })
  );
};

/**
 * Get chapter details by ID
 * GET /api/curriculum/chapter/:chapter_id
 */
export const getChapterDetails = async (req: Request, res: Response) => {
  const { chapter_id } = req.params as GetChapterInput;

  logger.info({ chapter_id }, 'Fetching chapter details');

  const result = getChapterById(chapter_id);

  if (!result) {
    throw new NotFoundError(`Chapter '${chapter_id}' not found`);
  }

  const { chapter, subject, classNum } = result;

  res.json(
    successResponse({
      chapter: {
        id: chapter.id,
        order: chapter.order,
        name: chapter.name,
        description: chapter.description,
        topics: chapter.topics,
        estimated_hours: chapter.estimated_hours,
        weightage: chapter.weightage,
      },
      subject: {
        id: subject.id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
      },
      class: classNum,
    })
  );
};

/**
 * Search chapters by name, description, or topic
 * GET /api/curriculum/search
 */
export const searchCurriculum = async (req: Request, res: Response) => {
  const { query, class: classNum, limit } = req.query as unknown as SearchChaptersInput;

  logger.info({ query, class: classNum, limit }, 'Searching curriculum');

  const results = searchChapters(query, classNum);

  // Limit results
  const limitedResults = results.slice(0, limit);

  res.json(
    successResponse({
      query,
      total_results: results.length,
      results: limitedResults.map((r) => ({
        chapter: {
          id: r.chapter.id,
          name: r.chapter.name,
          description: r.chapter.description,
          estimated_hours: r.chapter.estimated_hours,
        },
        subject: {
          id: r.subject.id,
          name: r.subject.name,
          icon: r.subject.icon,
          color: r.subject.color,
        },
        class: r.classNum,
        match_type: r.matchType,
      })),
    })
  );
};

/**
 * Get class statistics
 * GET /api/curriculum/:class/stats
 */
export const getStats = async (req: Request, res: Response) => {
  const { class: classParam } = req.params;
  const classNum = Number(classParam);

  logger.info({ class: classNum }, 'Fetching class stats');

  if (!isValidClass(classNum)) {
    throw new ValidationError(`Invalid class. Supported classes: ${SUPPORTED_CLASSES.join(', ')}`);
  }

  const stats = getClassStats(classNum);

  res.json(
    successResponse({
      class: classNum,
      stats,
    })
  );
};

/**
 * Get all supported classes
 * GET /api/curriculum/classes
 */
export const getSupportedClasses = async (req: Request, res: Response) => {
  res.json(
    successResponse({
      supported_classes: SUPPORTED_CLASSES,
      board: 'CBSE',
    })
  );
};
