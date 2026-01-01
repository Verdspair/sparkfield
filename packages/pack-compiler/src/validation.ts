import { QuestionItemSchema, type QuestionItem } from '@pkg/contracts';
import type { Diagnostic, SourcePosition } from './types.js';

export type FieldLocator = (field: string, characterOffset?: number) => SourcePosition;
export const AUTHOR_FIELDS = {
  questionId: 'question_id', familyId: 'family_id', subject: 'subject', knowledgeNode: 'knowledge_node',
  stepRole: 'step_role', questionType: 'question_type', assessmentKind: 'assessment_kind',
  allowMaterialReview: 'allow_material_review', materialMd: 'material_md', stemMd: 'stem_md',
  answerSpec: 'answer_spec', partialRubric: 'partial_rubric', hintMd: 'hint_md', explanationMd: 'explanation_md',
  difficulty: 'difficulty', weight: 'weight', estSeconds: 'est_seconds', sourceLicense: 'source_license',
  audioRefOptional: 'audio_ref_optional', options: 'options', matchingPairs: 'pairs', stepsRubric: 'steps_rubric',
} as const;

export function parseAssignments(spec: string): [string, string][] | null {
  const entries = spec.split(';').map((part) => {
    const equal = part.indexOf('=');
    return equal < 1 ? null : [part.slice(0, equal).trim(), part.slice(equal + 1).trim()] as [string, string];
  });
  return entries.some((entry) => !entry || !entry[0] || !entry[1]) ? null : entries as [string, string][];
}

export function normalizeQuestion(
  raw: Record<string, unknown>, file: string, locate: FieldLocator, diagnostics: Diagnostic[],
): QuestionItem | undefined {
  const fail = (field: string, message: string, offset?: number) => diagnostics.push({file, ...locate(field, offset), field, message});
  const jsonValue = (field: string): unknown => {
    const value = raw[field];
    if (typeof value !== 'string' || !value.trim()) return value === '' ? undefined : value;
    try { return JSON.parse(value); }
    catch { fail(field, 'Expected a valid JSON array or object.'); return undefined; }
  };
  const normalized: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(AUTHOR_FIELDS)) {
    const value = raw[snake];
    if (value !== undefined && value !== '') normalized[camel] = value;
  }
  for (const key of ['difficulty', 'weight', 'estSeconds']) {
    if (typeof normalized[key] === 'string') normalized[key] = Number(normalized[key]);
  }
  if (normalized.allowMaterialReview === 'true') normalized.allowMaterialReview = true;
  if (normalized.allowMaterialReview === 'false') normalized.allowMaterialReview = false;
  if (normalized.audioRefOptional === undefined) normalized.audioRefOptional = null;
  if (raw.options !== undefined && raw.options !== '') {
    const opts = jsonValue('options');
    normalized.options = opts && typeof opts === 'object' && !Array.isArray(opts)
      ? Object.entries(opts).map(([key, text]) => ({key, text})) : opts;
  } else {
    normalized.options = ['a','b','c','d'].flatMap((key) => {
      const text = raw[`option_${key}`];
      return text === undefined || text === '' ? [] : [{key: key.toUpperCase(), text}];
    });
  }
  const pairField = raw.pairs === undefined ? 'matching_pairs' : 'pairs';
  const pairs = raw[pairField];
  if (typeof pairs === 'string' && pairs && !pairs.trim().startsWith('[')) {
    const entries = parseAssignments(pairs);
    if (!entries) fail(pairField, 'Matching pairs must be a JSON array or left=right;left=right list.');
    normalized.matchingPairs = entries?.map(([left, right]) => ({left, right}));
  } else normalized.matchingPairs = pairs === undefined || pairs === '' ? [] : jsonValue(pairField);
  const rubric = raw.steps_rubric === undefined || raw.steps_rubric === '' ? [] : jsonValue('steps_rubric');
  normalized.stepsRubric = Array.isArray(rubric) ? rubric.map((step: unknown) => {
    if (step === null || typeof step !== 'object') return step;
    const s = step as Record<string, unknown>;
    return {stepId: s.step_id ?? s.stepId, prompt: s.prompt, expected: s.expected,
      ...(s.tolerance === undefined ? {} : {tolerance: s.tolerance}), weightShare: s.weight_share ?? s.weightShare};
  }) : rubric;
  const result = QuestionItemSchema.safeParse(normalized);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const name = String(issue.path[0] ?? (issue.message.includes('hints') ? 'hintMd' : issue.message.includes('retrieval') ? 'allowMaterialReview' : 'questionId'));
      const field = AUTHOR_FIELDS[name as keyof typeof AUTHOR_FIELDS] ?? name;
      fail(field, issue.message);
    }
    return undefined;
  }
  const item = result.data;
  validateAnswer(item, fail);
  const markdown: [string, string][] = [
    ['stem_md', item.stemMd], ['material_md', item.materialMd], ['hint_md', item.hintMd], ['explanation_md', item.explanationMd],
    ...item.options.map((option): [string,string] => [`option_${option.key.toLowerCase()}`, option.text]),
    ...item.stepsRubric.map((step): [string,string] => ['steps_rubric', step.prompt]),
    ...item.matchingPairs.flatMap((pair): [string,string][] => [['pairs',pair.left],['pairs',pair.right]]),
  ];
  for (const [field, text] of markdown) validateMathDelimiters(text, field, fail);
  return item;
}

type Fail = (field: string, message: string, offset?: number) => void;
const finiteNumber = (text: string) => text.trim() !== '' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()) && Number.isFinite(Number(text));
function validateAnswer(item: QuestionItem, fail: Fail): void {
  const answer = item.answerSpec.trim();
  const keys = item.options.map((option) => option.key);
  if (new Set(keys).size !== keys.length) fail('options', 'Option keys must be unique.');
  if (item.questionType === 'single_choice' || item.questionType === 'multi_choice') {
    if (keys.length < 2) fail('options', 'Choice questions require at least two options.');
    const answers = answer.split('|').map((s) => s.trim());
    if (item.questionType === 'single_choice' && answers.length !== 1) fail('answer_spec', 'Single choice requires exactly one answer key.');
    if (new Set(answers).size !== answers.length || answers.some((key) => !keys.includes(key))) fail('answer_spec', 'Every answer key must reference one unique existing option.');
    if (item.partialRubric && !(item.questionType === 'multi_choice' && item.partialRubric === 'partial_all_no_wrong:0.5')) fail('partial_rubric', 'Supported choice partial rubric: partial_all_no_wrong:0.5 (multi_choice only).');
  } else if (item.questionType === 'matching') {
    const pairs = item.matchingPairs;
    if (!pairs.length) fail('pairs', 'Matching questions require at least one pair.');
    if (new Set(pairs.map((p) => p.left)).size !== pairs.length || new Set(pairs.map((p) => p.right)).size !== pairs.length) fail('pairs', 'Matching left and right labels must each be unique.');
    const answers = parseAssignments(answer);
    if (!answers || new Set(answers.map(([left]) => left)).size !== answers.length || answers.length !== pairs.length || pairs.some((pair) => !answers.some(([left,right]) => left === pair.left && right === pair.right))) fail('answer_spec', 'Matching answer_spec must describe every declared pair exactly once.');
    if (item.partialRubric && item.partialRubric !== 'per_pair') fail('partial_rubric', 'Supported matching partial rubric: per_pair.');
  } else if (item.questionType === 'short_fill') {
    if (answer.split('|').some((s) => !s.trim())) fail('answer_spec', 'Short fill synonyms cannot be empty.');
    if (item.partialRubric) fail('partial_rubric', 'Short fill has no partial rubric.');
  } else if (item.questionType === 'numeric') {
    const parts = answer.split(':');
    if ((parts.length !== 2 && parts.length !== 3) || !finiteNumber(parts[0]!) || !finiteNumber(parts[1]!) || Number(parts[1]) < 0 || (parts.length === 3 && !parts[2]!.trim())) fail('answer_spec', 'Numeric answer_spec must be expected:tolerance[:unit] with finite values and tolerance >= 0.');
    if (item.partialRubric) fail('partial_rubric', 'Numeric questions use tolerance, not a partial rubric.');
  } else {
    const steps = item.stepsRubric;
    if (!steps.length) fail('steps_rubric', 'Multi-step numeric questions require a nonempty steps rubric.');
    if (new Set(steps.map((s) => s.stepId)).size !== steps.length) fail('steps_rubric', 'Rubric step IDs must be unique.');
    const shares = steps.map((step) => decimalFraction(step.weightShare));
    let num = 0n, den = 1n;
    for (const share of shares) { num = num * share.den + share.num * den; den *= share.den; }
    if (num !== den) fail('steps_rubric', 'Rubric weight_share values must sum to exactly 1.');
    const answers = parseAssignments(answer);
    if (!answers || new Set(answers.map(([key]) => key)).size !== answers.length || answers.length !== steps.length || steps.some((step) => !answers.some(([key,value]) => key === step.stepId && finiteNumber(value) && Number(value) === step.expected))) fail('answer_spec', 'Multi-step answer_spec must agree with all expected rubric values.');
    if (item.partialRubric && item.partialRubric !== 'step_shares') fail('partial_rubric', 'Supported multi-step partial rubric: step_shares.');
  }
}

function decimalFraction(value: number): {num: bigint; den: bigint} {
  const [coefficient, exponentText] = String(value).toLowerCase().split('e');
  const [whole, decimal = ''] = coefficient!.split('.');
  const exponent = Number(exponentText ?? 0) - decimal.length;
  const integer = BigInt(`${whole}${decimal}`);
  return exponent >= 0 ? {num:integer * 10n ** BigInt(exponent), den:1n} : {num:integer, den:10n ** BigInt(-exponent)};
}

function validateMathDelimiters(text: string, field: string, fail: Fail): void {
  let math: {size:number; offset:number} | undefined;
  let codeTicks = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) fail(field, 'Invalid control character in Markdown (check escaped TeX commands).', i);
    let backslashes = 0;
    for (let j=i-1; j>=0 && text[j] === '\\'; j--) backslashes++;
    if (backslashes % 2) continue;
    if (text[i] === '`' && !math) {
      let size=1;
      while (text[i+size] === '`') size++;
      if (codeTicks === size) codeTicks=0;
      else if (!codeTicks) codeTicks=size;
      i += size-1;
      continue;
    }
    if (text[i] !== '$' || codeTicks) continue;
    const size = text[i+1] === '$' ? 2 : 1;
    if (!math) math = {size, offset:i};
    else if (math.size === size) math=undefined;
    else fail(field, 'Mismatched $ and $$ math delimiters.', i);
    i += size-1;
  }
  if (math) fail(field, `Unclosed ${math.size === 2 ? '$$' : '$'} math delimiter.`, math.offset);
}
