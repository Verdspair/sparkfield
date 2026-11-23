import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CoursePackSchema } from '@pkg/contracts';
import { compileCoursePack, serializeCoursePackToAuthoring } from '../src/index.js';

const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const createdAtIso='2026-01-01T00:00:00.000Z';

describe('standard course pack compilation and round-trip',() => {
  it.each(['english-core-starter','math-core-starter'])('%s compiles atomically, covers all roles/types, round-trips and matches its checked-in artifact',(packId) => {
    const directory=resolve(repoRoot,'content/courses/sources',packId);
    const result=compileCoursePack({
      meta:JSON.parse(readFileSync(resolve(directory,'pack-meta.json'),'utf8')),
      csvSources:[{file:`${packId}/questions.csv`,text:readFileSync(resolve(directory,'questions.csv'),'utf8')}],
      mdSources:[{file:`${packId}/lessons.md`,text:readFileSync(resolve(directory,'lessons.md'),'utf8')}],
      createdAtIso,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pack=CoursePackSchema.parse(result.pack);
    expect(pack.items).toHaveLength(72);
    expect(pack.manifest.coursePackVersion).toBe('2.0.0');
    expect(pack.manifest.knowledgeGraph).toHaveLength(6);
    expect(pack.manifest.itemCount).toBe(pack.items.length);
    expect(pack.manifest.syllabusTag).toBe('CC0-1.0');
    const expectedGraph = packId === 'math-core-starter' ? [
      ['MATH_N1_SET_FUNC', '集合逻辑与函数性质', []],
      ['MATH_N2_TRIG_SEQ', '三角函数与恒等变换', ['MATH_N1_SET_FUNC']],
      ['MATH_N3_VEC_GEOM_PROB', '等差、等比数列与求和', ['MATH_N2_TRIG_SEQ']],
      ['MATH_N4_VECTOR_LINE', '平面向量与直线方程', ['MATH_N1_SET_FUNC']],
      ['MATH_N5_CIRCLE_CONIC', '圆的方程与解析几何', ['MATH_N4_VECTOR_LINE']],
      ['MATH_N6_PROB_STAT', '古典概型与统计特征', ['MATH_N1_SET_FUNC']],
    ] : [
      ['ENG_N1_VOCAB_DIALOGUE', '情景交际与日常高频词块', []],
      ['ENG_N2_GRAMMAR_CLAUSE', '时态语态与核心从句', ['ENG_N1_VOCAB_DIALOGUE']],
      ['ENG_N3_CLOZE_READING', '完形语境与信息推理', ['ENG_N1_VOCAB_DIALOGUE', 'ENG_N2_GRAMMAR_CLAUSE']],
      ['ENG_N4_ACADEMIC_VOCAB', '校园科技与高频词组搭配', ['ENG_N1_VOCAB_DIALOGUE']],
      ['ENG_N5_NONFINITE_SYNTAX', '非谓语动词与长难句分析', ['ENG_N2_GRAMMAR_CLAUSE']],
      ['ENG_N6_PASSAGE_INFER', '短篇阅读主旨与词义推断', ['ENG_N3_CLOZE_READING']],
    ];
    expect(pack.manifest.knowledgeGraph.map((node) => [node.nodeId,node.title,node.prerequisites])).toEqual(expectedGraph);
    if (packId === 'english-core-starter') {
      expect(pack.manifest.knowledgeGraph.find((node) => node.nodeId === 'ENG_N1_VOCAB_DIALOGUE')?.title).toBe('情景交际与日常高频词块');
      expect(pack.items.some((item) => item.knowledgeNode === 'ENG_N1_VOCAB_DIALOGUE' && item.stepRole === 'practice' && item.questionType === 'single_choice')).toBe(true);
    }
    expect(pack.items.every((item) => item.sourceLicense==='CC0-1.0')).toBe(true);
    const supportedTypes = packId === 'english-core-starter'
      ? new Set(['single_choice', 'short_fill'])
      : new Set(['single_choice', 'short_fill', 'numeric', 'multi_step_numeric']);
    expect(pack.items.every((item) => supportedTypes.has(item.questionType))).toBe(true);
    expect(pack.items.some((item) => item.questionType === 'single_choice')).toBe(true);
    expect(pack.items.some((item) => item.questionType !== 'single_choice')).toBe(true);
    for (const node of pack.manifest.knowledgeGraph) {
      const items = pack.items.filter((item) => item.knowledgeNode === node.nodeId);
      expect(items).toHaveLength(12);
      for (const role of ['practice','resource_check','verification']) {
        expect(items.filter((item) => item.stepRole === role)).toHaveLength(4);
      }
      const families = new Set(items.map((item) => item.familyId));
      expect(families.size).toBeGreaterThanOrEqual(4);
      for (const family of families) {
        const members = items.filter((item) => item.familyId === family);
        expect(members.some((item) => item.stepRole === 'practice')).toBe(true);
        expect(members.some((item) => item.stepRole === 'verification')).toBe(true);
      }
      for (const type of (packId === 'math-core-starter'
        ? ['single_choice', 'short_fill', 'numeric', 'multi_step_numeric']
        : ['single_choice', 'short_fill'])) {
        expect(items.some((item) => item.questionType === type)).toBe(true);
      }
      if (packId === 'math-core-starter') {
        for (const [difficulty, count] of [[1,3],[2,4],[3,3],[4,2]] as const) {
          expect(items.filter((item) => item.difficulty === difficulty)).toHaveLength(count);
        }
      } else {
        expect(new Set(items.map((item) => item.difficulty))).toEqual(new Set([1,2,3,4]));
      }
    }
    const authoring=serializeCoursePackToAuthoring(pack);
    const roundtrip=compileCoursePack({meta:authoring.meta,csvSources:[{file:'reverse.csv',text:authoring.csvText}],mdSources:[{file:'reverse.md',text:authoring.mdText}],createdAtIso:authoring.createdAtIso});
    expect(roundtrip.ok ? roundtrip.pack : roundtrip.diagnostics).toEqual(pack);
    const output=resolve(repoRoot,'content/courses/compiled',`${packId}.json`);
    if (process.env.UPDATE_COMPILED_COURSES==='1') {
      mkdirSync(resolve(repoRoot,'content/courses/compiled'),{recursive:true});
      const temporary = `${output}.${process.pid}.tmp`;
      writeFileSync(temporary,JSON.stringify(pack,null,2)+'\n');
      renameSync(temporary,output);
    }
    expect(CoursePackSchema.parse(JSON.parse(readFileSync(output,'utf8')))).toEqual(pack);
  });
});
