import { CoursePackManifestSchema, CoursePackSchema, type QuestionItem } from '@pkg/contracts';
import { parseQuestionsCsv } from './csv.js';
import { parseLessonsMarkdown } from './markdown.js';
import { canonicalJson, sha256 } from './hash.js';
import type { CompileResult, Diagnostic, QuestionLocation, SourceText } from './types.js';

export interface CompileCoursePackInput {
  meta: unknown;
  csvSources?: readonly SourceText[];
  mdSources?: readonly SourceText[];
  metaSourceName?: string;
  createdAtIso?: string;
}

export function compileCoursePack(input: CompileCoursePackInput): CompileResult {
  const diagnostics: Diagnostic[]=[], items: QuestionItem[]=[], locations: QuestionLocation[]=[];
  const metaFile=input.metaSourceName ?? 'pack-meta.json';
  const parsedMeta=CoursePackManifestSchema.omit({contentSha256:true,itemCount:true,createdAtIso:true}).safeParse(input.meta);
  if (!parsedMeta.success) for (const issue of parsedMeta.error.issues) diagnostics.push({file:metaFile,line:1,field:issue.path.join('.'),message:issue.message});
  for (const [sources,parse] of [[input.csvSources ?? [],parseQuestionsCsv],[input.mdSources ?? [],parseLessonsMarkdown]] as const) {
    for (const source of sources) {
      const result=parse(source.text,source.file);
      items.push(...result.items); locations.push(...result.locations); diagnostics.push(...result.diagnostics);
    }
  }
  const seen=new Map<string,QuestionLocation>();
  items.forEach((item,i) => {
    const location=locations[i]!;
    const previous=seen.get(item.questionId);
    if (previous) diagnostics.push({file:location.file,...(location.fields.question_id ?? {line:location.line}),field:'question_id',message:`Duplicate questionId ${item.questionId}; first declared at ${previous.file}:${previous.fields.question_id?.line ?? previous.line}.`});
    else seen.set(item.questionId,location);
  });
  if (parsedMeta.success) {
    const meta=parsedMeta.data;
    const graph=meta.knowledgeGraph;
    const nodes=new Map<string,number>();
    const graphError=(field: string,message: string) => diagnostics.push({file:metaFile,line:1,field,message});
    graph.forEach((node,i) => {
      if (nodes.has(node.nodeId)) graphError(`knowledgeGraph.${i}.nodeId`,`Duplicate knowledge node ${node.nodeId}.`);
      else nodes.set(node.nodeId,i);
    });
    graph.forEach((node,i) => node.prerequisites.forEach((pre,j) => {
      if (!nodes.has(pre)) graphError(`knowledgeGraph.${i}.prerequisites.${j}`,`Unknown prerequisite knowledge node ${pre}.`);
    }));
    const colors=new Map<string,number>(), stack:string[]=[];
    const visit=(id: string) => {
      colors.set(id,1); stack.push(id);
      const index=nodes.get(id)!;
      for (const pre of graph[index]!.prerequisites) {
        if (!nodes.has(pre)) continue;
        if (colors.get(pre)===1) graphError(`knowledgeGraph.${index}.prerequisites`,`Knowledge graph must be a DAG; cycle: ${[...stack.slice(stack.indexOf(pre)),pre].join(' -> ')}.`);
        else if (!colors.has(pre)) visit(pre);
      }
      stack.pop(); colors.set(id,2);
    };
    for (const id of nodes.keys()) if (!colors.has(id)) visit(id);
    items.forEach((item,i) => {
      const location=locations[i]!;
      if (!nodes.has(item.knowledgeNode)) diagnostics.push({file:location.file,...(location.fields.knowledge_node ?? {line:location.line}),field:'knowledge_node',message:`Unknown knowledge node ${item.knowledgeNode}.`});
      if (item.subject!==meta.subject) diagnostics.push({file:location.file,...(location.fields.subject ?? {line:location.line}),field:'subject',message:`Question subject ${item.subject} does not match course subject ${meta.subject}.`});
    });
    if (!items.length) diagnostics.push({file:metaFile,line:1,field:'items',message:'Course pack must contain at least one valid question.'});
    if (diagnostics.length) return {ok:false,diagnostics};
    items.sort((a,b) => a.questionId<b.questionId ? -1 : a.questionId>b.questionId ? 1 : 0);
    const contentSha256=sha256(canonicalJson({meta,items}));
    const pack=CoursePackSchema.safeParse({manifest:{...meta,contentSha256,itemCount:items.length,createdAtIso:input.createdAtIso ?? '1970-01-01T00:00:00.000Z'},items});
    if (!pack.success) return {ok:false,diagnostics:pack.error.issues.map((issue) => ({file:metaFile,line:1,field:issue.path.join('.'),message:issue.message}))};
    return {ok:true,pack:pack.data,diagnostics:[]};
  }
  return {ok:false,diagnostics};
}
