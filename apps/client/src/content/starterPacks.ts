import englishPackJson from '../../../../content/courses/compiled/english-core-starter.json' with { type: 'json' };
import mathPackJson from '../../../../content/courses/compiled/math-core-starter.json' with { type: 'json' };
import { CoursePackSchema, type CoursePack, type SubjectId } from '@pkg/contracts';
import { serializeCoursePackToAuthoring, type AuthoringCoursePack } from '@pkg/pack-compiler';

export const ENGLISH_STARTER_PACK: CoursePack = CoursePackSchema.parse(englishPackJson);
export const MATH_STARTER_PACK: CoursePack = CoursePackSchema.parse(mathPackJson);

export const STARTER_COURSE_PACKS: readonly CoursePack[] = [
  ENGLISH_STARTER_PACK,
  MATH_STARTER_PACK,
];

export const STARTER_PACK_BY_SUBJECT: Readonly<Record<SubjectId, CoursePack>> = {
  english: ENGLISH_STARTER_PACK,
  math: MATH_STARTER_PACK,
};

let cachedAuthoringTemplates: Readonly<Record<SubjectId, AuthoringCoursePack>> | null = null;

export function getStarterAuthoringTemplate(subject: SubjectId): AuthoringCoursePack {
  if (!cachedAuthoringTemplates) {
    cachedAuthoringTemplates = {
      english: serializeCoursePackToAuthoring(ENGLISH_STARTER_PACK),
      math: serializeCoursePackToAuthoring(MATH_STARTER_PACK),
    };
  }
  return cachedAuthoringTemplates[subject];
}
