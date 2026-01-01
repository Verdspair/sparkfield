import { CoursePackSchema, type CoursePack, type QuestionItem } from '@pkg/contracts';
import { stringify } from 'yaml';
import type { CoursePackMeta } from './types.js';

export const QUESTIONS_CSV_COLUMNS = [
  'question_id','family_id','subject','knowledge_node','step_role','question_type','assessment_kind',
  'allow_material_review','material_md','stem_md','option_a','option_b','option_c','option_d','options','pairs',
  'answer_spec','partial_rubric','hint_md','explanation_md','difficulty','weight','est_seconds','source_license','audio_ref_optional',
] as const;

export interface AuthoringCoursePack {
  meta: CoursePackMeta;
  csvText: string;
  mdText: string;
  createdAtIso: string;
}
function authorFields(item: QuestionItem): Record<string,unknown> {
  return {
    question_id:item.questionId,family_id:item.familyId,subject:item.subject,knowledge_node:item.knowledgeNode,
    step_role:item.stepRole,question_type:item.questionType,assessment_kind:item.assessmentKind,
    allow_material_review:item.allowMaterialReview,material_md:item.materialMd,stem_md:item.stemMd,
    options:item.options,pairs:item.matchingPairs,
    steps_rubric:item.stepsRubric.map((s) => ({step_id:s.stepId,prompt:s.prompt,expected:s.expected,tolerance:s.tolerance,weight_share:s.weightShare})),
    answer_spec:item.answerSpec,partial_rubric:item.partialRubric,hint_md:item.hintMd,explanation_md:item.explanationMd,
    difficulty:item.difficulty,weight:item.weight,est_seconds:item.estSeconds,source_license:item.sourceLicense,audio_ref_optional:item.audioRefOptional,
  };
}
const csvEscape=(value:unknown) => {
  const text=value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
};

export function serializeCoursePackToAuthoring(coursePack: CoursePack): AuthoringCoursePack {
  const pack=CoursePackSchema.parse(coursePack);
  const {contentSha256:_hash,itemCount:_count,createdAtIso,...meta}=pack.manifest;
  const csvRows:string[]=[QUESTIONS_CSV_COLUMNS.join(',')], mdBlocks:string[]=[];
  for (const item of pack.items) {
    const fields=authorFields(item);
    if (item.questionType==='multi_step_numeric' || item.stepsRubric.length) {
      delete fields.stem_md;
      if (!item.options.length) delete fields.options;
      else fields.options=item.options;
      if (!item.matchingPairs.length) delete fields.pairs;
      if (!item.stepsRubric.length) delete fields.steps_rubric;
      const specialStem=item.stemMd!==item.stemMd.trim() || /(?:^|\n)---\s*\r?\n(?:question_id|family_id|subject|knowledge_node|step_role|question_type)\s*:/.test(item.stemMd);
      if (specialStem) fields.stem_md=item.stemMd;
      mdBlocks.push(`---\n${stringify(fields,{lineWidth:0})}---\n${specialStem ? '<!-- Exact stem_md is preserved in frontmatter. -->' : item.stemMd}\n`);
    } else {
      const simpleOptions=item.options.every((option,index) => option.key==='ABCD'[index]);
      fields.options=simpleOptions ? '' : JSON.stringify(item.options);
      for (const key of ['a','b','c','d']) fields[`option_${key}`]=simpleOptions ? item.options.find((option) => option.key===key.toUpperCase())?.text ?? '' : '';
      fields.pairs=item.matchingPairs.length ? JSON.stringify(item.matchingPairs) : '';
      csvRows.push(QUESTIONS_CSV_COLUMNS.map((column) => csvEscape(fields[column])).join(','));
    }
  }
  return {meta,csvText:`${csvRows.join('\r\n')}\r\n`,mdText:mdBlocks.join('\n'),createdAtIso};
}
