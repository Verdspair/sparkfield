import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { CoursePackSchema, QuestionItemSchema, type QuestionItem } from '@pkg/contracts';
import {
  compileCoursePack, parseQuestionsCsv, parseLessonsMarkdown, serializeCoursePackToAuthoring,
  sha256, canonicalJson, type CoursePackMeta,
} from '../src/index.js';

const meta: CoursePackMeta={packId:'test',coursePackVersion:'1.0.0',subject:'math',title:'Original sample',
  syllabusTag:'CC0-1.0',knowledgeGraph:[{nodeId:'N1',title:'Basics',prerequisites:[]}]};
const rawBase={question_id:'Q1',family_id:'F1',subject:'math',knowledge_node:'N1',step_role:'practice',
  question_type:'single_choice',assessment_kind:'application',allow_material_review:'true',material_md:'Reference $a=2$',
  stem_md:'Which value?',option_a:'2',option_b:'3',option_c:'',option_d:'',answer_spec:'A',partial_rubric:'',hint_md:'Try $a$.',
  explanation_md:'The value is 2.',difficulty:2,weight:10,est_seconds:30,source_license:'CC0-1.0'};
const escapeCsv=(value:unknown) => `"${String(value).replaceAll('"','""')}"`;
function csv(...rows: Record<string,unknown>[]) {
  const columns=Object.keys({...rawBase,...Object.assign({},...rows)});
  return `${columns.join(',')}\r\n${rows.map((row) => columns.map((key) => escapeCsv(({...rawBase,...row} as Record<string,unknown>)[key] ?? '')).join(',')).join('\r\n')}\r\n`;
}
function md(overrides:Record<string,unknown>={},stem='Compute $2+2$.') {
  const raw:Record<string,unknown>={...rawBase,allow_material_review:true,options:{A:'2',B:'3'},...overrides};
  delete raw.stem_md;
  for (const key of ['a','b','c','d']) delete raw[`option_${key}`];
  return `---\n${stringify(raw,{lineWidth:0})}---\n${stem}\n`;
}
const compile=(text:string) => compileCoursePack({meta,csvSources:[{file:'questions.csv',text}]});
function question(overrides:Partial<QuestionItem>={}) {
  return QuestionItemSchema.parse({questionId:'Q1',familyId:'F1',subject:'math',knowledgeNode:'N1',stepRole:'practice',
    questionType:'single_choice',assessmentKind:'application',allowMaterialReview:true,stemMd:'Choose 2.',options:[{key:'A',text:'2'},{key:'B',text:'3'}],
    answerSpec:'A',explanationMd:'2 is correct.',sourceLicense:meta.syllabusTag,...overrides});
}

describe('RFC-4180 CSV and author-source diagnostics',() => {
  it('parses CRLF, multiline cells, escaped quotes and tracks real record lines',() => {
    const text=csv({stem_md:'First line\nSecond, "quoted" line'},{question_id:'Q2',family_id:'F2',stem_md:'Last row'});
    const parsed=parseQuestionsCsv(text,'table.csv');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.items[0]!.stemMd).toBe('First line\nSecond, "quoted" line');
    expect(parsed.locations.map((location) => location.line)).toEqual([2,4]);
    expect(parsed.locations[1]!.fields.stem_md!.line).toBe(4);
    expect(parseQuestionsCsv('\ufeff'+text,'bom.csv').items).toEqual(parsed.items);
  });
  it('reports the actual later record line, field and column; rejects the whole pack',() => {
    const text=csv({stem_md:'Two\nphysical lines'},{question_id:'Q2',answer_spec:'Z'});
    const result=compile(text);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({file:'questions.csv',line:4,field:'answer_spec',column:expect.any(Number)}));
    expect(result).not.toHaveProperty('pack');
  });
  it.each([
    ['unterminated quote','"abc',/Unclosed quoted/],
    ['stray quote','un"quoted',/unquoted CSV field/],
    ['characters after quote','"quoted"tail',/after the closing quote/],
  ])('rejects %s',(_label,cell,message) => {
    const result=parseQuestionsCsv('question_id\r\n'+cell,'bad.csv');
    expect(result.diagnostics.some((d) => message.test(d.message))).toBe(true);
  });
  it('rejects missing/duplicate headers and wrong field counts',() => {
    const parsed=parseQuestionsCsv('question_id,question_id\nQ1,Q1,extra','shape.csv');
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({field:'family_id',line:1}));
    expect(parsed.diagnostics.some((d) => d.message.includes('Duplicate CSV column'))).toBe(true);
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({field:'record',line:2}));
  });
  it('supports A..D, JSON options, pairing lists and JSON pairing arrays',() => {
    const parsed=parseQuestionsCsv(csv(
      {question_id:'C',options:JSON.stringify([{key:'x',text:'One'},{key:'y',text:'Two'}]),answer_spec:'y'},
      {question_id:'M1',question_type:'matching',pairs:'bolt=螺栓;nut=螺母',answer_spec:'bolt=螺栓;nut=螺母',partial_rubric:'per_pair'},
      {question_id:'M2',question_type:'matching',pairs:JSON.stringify([{left:'正',right:'positive'}]),answer_spec:'正=positive',partial_rubric:'per_pair'},
    ),'variants.csv');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.items[0]!.options.map((o) => o.key)).toEqual(['x','y']);
    expect(parsed.items[1]!.matchingPairs).toHaveLength(2);
  });
  it('detects an unmatched math delimiter on its exact physical line and ignores escaped dollars/code',() => {
    const text=csv({stem_md:'Line one\nUnclosed $x'});
    const result=compile(text);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({field:'stem_md',line:3,message:'Unclosed $ math delimiter.'}));
    expect(compile(csv({stem_md:'`$code` and \\$cash; $$x=2$$; $y=3$'})).ok).toBe(true);
    expect(compile(csv({stem_md:'$x$$'})).ok).toBe(false);
  });
});

describe('multi-block Markdown/YAML',() => {
  it('tracks the real source position of every later frontmatter field',() => {
    const first=md({},'First paragraph.\n\n---\n\nA horizontal rule in the body.');
    const second=md({question_id:'Q2',step_role:'verification',hint_md:'Forbidden hint.'},'Second question.');
    const text=first+'\n'+second;
    const parsed=parseLessonsMarkdown(text,'lessons.md');
    const offendingLine=text.slice(0,text.indexOf('hint_md: Forbidden')).split('\n').length;
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({file:'lessons.md',field:'hint_md',line:offendingLine}));
    expect(parsed.items[0]!.stemMd).toContain('A horizontal rule');
    expect(compileCoursePack({meta,mdSources:[{file:'lessons.md',text}]})).not.toHaveProperty('pack');
  });
  it('reports YAML syntax and opening/closing delimiter errors with source lines',() => {
    const first=md();
    const bad=first+'\n---\nquestion_id: [unclosed\n---\nBody';
    const parsed=parseLessonsMarkdown(bad,'syntax.md');
    expect(parsed.diagnostics.some((d) => d.field==='frontmatter' && d.line>first.split('\n').length-1)).toBe(true);
    expect(parseLessonsMarkdown('text without frontmatter','bad.md').diagnostics[0]!.line).toBe(1);
    expect(parseLessonsMarkdown('\n\n---\nquestion_id: Q1','bad.md').diagnostics[0]!.line).toBe(3);
  });
  it('reports math delimiters on body lines, not frontmatter-relative offsets',() => {
    const text=md({},'A paragraph\n\nMissing $end');
    const parsed=parseLessonsMarkdown(text,'math.md');
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({field:'stem_md',line:text.slice(0,text.indexOf('Missing $')).split('\n').length}));
  });
});

describe('all-or-nothing static compilation',() => {
  it('compiles valid CSV+Markdown and satisfies the complete CoursePackSchema',() => {
    const result=compileCoursePack({meta,csvSources:[{file:'a.csv',text:csv({})}],mdSources:[{file:'b.md',text:md({question_id:'Q2'})}]});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(CoursePackSchema.safeParse(result.pack).success).toBe(true);
    expect(result.pack.manifest.itemCount).toBe(2);
    expect(result.pack.manifest.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('rejects duplicate IDs across formats and reports the duplicate field line',() => {
    const text=md();
    const result=compileCoursePack({meta,csvSources:[{file:'a.csv',text:csv({})}],mdSources:[{file:'b.md',text}]});
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({file:'b.md',line:2,field:'question_id',message:expect.stringContaining('Duplicate questionId')}));
  });
  it.each([
    {knowledgeGraph:[{nodeId:'N1',title:'One',prerequisites:['MISSING']}]},
    {knowledgeGraph:[{nodeId:'N1',title:'One',prerequisites:['N1']}]},
    {knowledgeGraph:[{nodeId:'N1',title:'One',prerequisites:['N2']},{nodeId:'N2',title:'Two',prerequisites:['N3']},{nodeId:'N3',title:'Three',prerequisites:['N1']}]},
    {knowledgeGraph:[{nodeId:'N1',title:'One',prerequisites:[]},{nodeId:'N1',title:'Repeated',prerequisites:[]}]},
  ])('rejects missing references, duplicate graph nodes and all directed cycles', (override) => {
    const result=compileCoursePack({meta:{...meta,...override},csvSources:[{file:'q.csv',text:csv({})}]});
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.field.startsWith('knowledgeGraph'))).toBe(true);
  });
  it('accepts shared prerequisite diamonds, but rejects unknown question nodes and wrong subject',() => {
    const graph=[{nodeId:'N1',title:'Base',prerequisites:[]},{nodeId:'N2',title:'Two',prerequisites:['N1']},{nodeId:'N3',title:'Three',prerequisites:['N1']},{nodeId:'N4',title:'Four',prerequisites:['N2','N3']}];
    expect(compileCoursePack({meta:{...meta,knowledgeGraph:graph},csvSources:[{file:'q.csv',text:csv({knowledge_node:'N4'})}]}).ok).toBe(true);
    const result=compile(csv({knowledge_node:'OTHER',subject:'english'}));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.field)).toEqual(expect.arrayContaining(['knowledge_node','subject']));
  });
  it.each([
    {assessment_kind:'retrieval',allow_material_review:'true'},
    {step_role:'resource_check',hint_md:'Forbidden'},
    {step_role:'verification',hint_md:'Forbidden'},
    {difficulty:'six'}, {allow_material_review:'yes'}, {source_license:''},
    {question_type:'numeric',answer_spec:'2:-1'},
    {question_type:'numeric',answer_spec:'Infinity:0'},
    {question_type:'multi_choice',answer_spec:'A|MISSING'},
    {question_type:'matching',pairs:'a=b',answer_spec:'a=c'},
    {question_type:'short_fill',answer_spec:'good||bad'},
    {material_md:'\\f command was accidentally serialized as \f'},
  ])('enforces question schema and objective answer specifications: %j',(override) => {
    expect(compile(csv(override)).ok).toBe(false);
  });
  it('accepts an explicit numeric unit and rejects an empty unit',() => {
    expect(compile(csv({question_type:'numeric',answer_spec:'2.5:0.01:mm'})).ok).toBe(true);
    expect(compile(csv({question_type:'numeric',answer_spec:'2.5:0.01:'})).ok).toBe(false);
  });
  it('checks exact rubric weights and agreement between answer_spec and every middle step',() => {
    const steps=[{step_id:'a',prompt:'Intermediate',expected:4,tolerance:0.01,weight_share:0.1},{step_id:'b',prompt:'Final',expected:8,tolerance:0.01,weight_share:0.9}];
    const text=md({question_type:'multi_step_numeric',options:[],steps_rubric:steps,answer_spec:'a=4;b=8',partial_rubric:'step_shares'});
    expect(compileCoursePack({meta,mdSources:[{file:'steps.md',text}]}).ok).toBe(true);
    for (const invalid of [text.replace('weight_share: 0.9','weight_share: 0.8'),text.replace('a=4;b=8','a=4;b=9')]) expect(compileCoursePack({meta,mdSources:[{file:'steps.md',text:invalid}]}).ok).toBe(false);
  });
  it('rejects missing/invalid metadata and zero-item packs',() => {
    expect(compileCoursePack({meta:{...meta,coursePackVersion:'v1'},csvSources:[]}).ok).toBe(false);
    expect(compileCoursePack({meta}).ok).toBe(false);
  });
});

describe('cross-host hash and reverse authoring',() => {
  it.each(['','abc','星际研学样题 🎓','\ud800','a'.repeat(1000)])('matches SHA-256 golden vectors for %j',(text) => {
    expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
  });
  it('canonicalizes object keys and excludes build timestamp/source filenames from content identity',() => {
    expect(canonicalJson({z:1,a:{y:2,b:3}})).toBe('{"a":{"b":3,"y":2},"z":1}');
    const a=compileCoursePack({meta,csvSources:[{file:'a.csv',text:csv({})}],createdAtIso:'2026-01-01T00:00:00Z'});
    const b=compileCoursePack({meta:{...meta},csvSources:[{file:'renamed.csv',text:csv({})}],createdAtIso:'2026-02-01T00:00:00Z'});
    expect(a.ok && b.ok && a.pack.manifest.contentSha256===b.pack.manifest.contentSha256).toBe(true);
  });
  it('round trips all fields, all six types, multiline quotes, rich math and arbitrary option keys',() => {
    const items=[
      question({questionId:'A',stemMd:'First line\nSecond, "quoted" line',audioRefOptional:'audio/example.ogg'}),
      question({questionId:'B',questionType:'multi_choice',answerSpec:'A|B',partialRubric:'partial_all_no_wrong:0.5'}),
      question({questionId:'C',questionType:'matching',options:[],matchingPairs:[{left:'alpha',right:'一,二'},{left:'bolt',right:'螺栓'}],answerSpec:'alpha=一,二;bolt=螺栓',partialRubric:'per_pair'}),
      question({questionId:'D',questionType:'short_fill',options:[],answerSpec:'inspect|check'}),
      question({questionId:'E',questionType:'numeric',options:[],answerSpec:'8:0.01'}),
      question({questionId:'F',questionType:'multi_step_numeric',options:[],stemMd:'Compute $$a=2$$.\n\nThen $b=4$.',stepsRubric:[{stepId:'a',prompt:'First',expected:2,tolerance:0.01,weightShare:0.4},{stepId:'b',prompt:'Second',expected:4,tolerance:0,weightShare:0.6}],answerSpec:'a=2;b=4',partialRubric:'step_shares'}),
      question({questionId:'G',options:[{key:'X',text:'2'},{key:'Z',text:'3'}],answerSpec:'X'}),
    ];
    const pack=CoursePackSchema.parse({manifest:{...meta,contentSha256:'0'.repeat(64),itemCount:items.length,createdAtIso:'2026-01-01T00:00:00Z'},items});
    const authoring=serializeCoursePackToAuthoring(pack);
    expect(authoring.csvText).toContain('option_a');
    expect(authoring.mdText).toContain('steps_rubric:');
    const rebuilt=compileCoursePack({meta:authoring.meta,csvSources:[{file:'roundtrip.csv',text:authoring.csvText}],mdSources:[{file:'roundtrip.md',text:authoring.mdText}],createdAtIso:authoring.createdAtIso});
    expect(rebuilt.ok ? [] : rebuilt.diagnostics).toEqual([]);
    if (!rebuilt.ok) return;
    expect(rebuilt.pack.items).toEqual(items);
    const again=serializeCoursePackToAuthoring(rebuilt.pack);
    const twice=compileCoursePack({meta:again.meta,csvSources:[{file:'x.csv',text:again.csvText}],mdSources:[{file:'x.md',text:again.mdText}],createdAtIso:again.createdAtIso});
    expect(twice.ok && twice.pack).toEqual(rebuilt.pack);
  });
  it('round trips exceptional exact stem whitespace and delimiter-like body text',() => {
    for (const stemMd of ['  whitespace\n  ','---\nquestion_id: not-a-real-block']) {
      const item=question({questionType:'multi_step_numeric',stemMd,options:[],stepsRubric:[{stepId:'x',prompt:'Compute',expected:2,tolerance:0,weightShare:1}],answerSpec:'x=2',partialRubric:'step_shares'});
      const pack=CoursePackSchema.parse({manifest:{...meta,contentSha256:'0'.repeat(64),itemCount:1,createdAtIso:'epoch'},items:[item]});
      const source=serializeCoursePackToAuthoring(pack);
      const rebuilt=compileCoursePack({meta:source.meta,csvSources:[{file:'q.csv',text:source.csvText}],mdSources:[{file:'q.md',text:source.mdText}]});
      expect(rebuilt.ok ? rebuilt.pack.items[0]!.stemMd : rebuilt.diagnostics).toEqual(stemMd);
    }
  });
});
