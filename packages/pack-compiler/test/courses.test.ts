import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
    expect(pack.items.length).toBeGreaterThanOrEqual(18);
    expect(pack.manifest.itemCount).toBe(pack.items.length);
    expect(pack.manifest.syllabusTag).toBe('CC0-1.0');
    if (packId === 'english-core-starter') {
      expect(pack.manifest.coursePackVersion).toBe('1.2.1');
      expect(pack.manifest.knowledgeGraph.find((node) => node.nodeId === 'ENG_N1_VOCAB_DIALOGUE')?.title).toBe('情景交际与日常沟通');
    }
    expect(pack.items.every((item) => item.sourceLicense==='CC0-1.0')).toBe(true);
    const supportedTypes = packId === 'english-core-starter'
      ? new Set(['single_choice', 'short_fill'])
      : new Set(['single_choice', 'short_fill', 'numeric', 'multi_step_numeric']);
    expect(pack.items.every((item) => supportedTypes.has(item.questionType))).toBe(true);
    expect(pack.items.some((item) => item.questionType === 'single_choice')).toBe(true);
    expect(pack.items.some((item) => item.questionType !== 'single_choice')).toBe(true);
    for (const node of pack.manifest.knowledgeGraph) for (const role of ['practice','resource_check','verification']) {
      expect(pack.items.filter((item) => item.knowledgeNode===node.nodeId && item.stepRole===role).length).toBeGreaterThanOrEqual(2);
    }
    const authoring=serializeCoursePackToAuthoring(pack);
    const roundtrip=compileCoursePack({meta:authoring.meta,csvSources:[{file:'reverse.csv',text:authoring.csvText}],mdSources:[{file:'reverse.md',text:authoring.mdText}],createdAtIso:authoring.createdAtIso});
    expect(roundtrip.ok ? roundtrip.pack : roundtrip.diagnostics).toEqual(pack);
    const output=resolve(repoRoot,'content/courses/compiled',`${packId}.json`);
    if (process.env.UPDATE_COMPILED_COURSES==='1') {
      mkdirSync(resolve(repoRoot,'content/courses/compiled'),{recursive:true});
      writeFileSync(output,JSON.stringify(pack,null,2)+'\n');
    }
    expect(CoursePackSchema.parse(JSON.parse(readFileSync(output,'utf8')))).toEqual(pack);
  });
});
