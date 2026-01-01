import { isMap, isScalar, parseDocument } from 'yaml';
import type { Diagnostic, ParseResult, QuestionLocation } from './types.js';
import { positionAt } from './types.js';
import { normalizeQuestion } from './validation.js';

interface Line { text: string; offset: number; end: number }
function physicalLines(text: string): Line[] {
  const lines: Line[]=[];
  let start=0;
  for (const m of text.matchAll(/\r\n|\r|\n/g)) {
    lines.push({text:text.slice(start,m.index),offset:start,end:m.index+m[0].length});
    start=m.index+m[0].length;
  }
  lines.push({text:text.slice(start),offset:start,end:text.length});
  return lines;
}
const isDelimiter=(line: Line | undefined) => line !== undefined && /^---[ \t]*$/.test(line.text);
const looksLikeMetadata=(lines: Line[], start: number) => {
  let i=start;
  while (i<lines.length && (!lines[i]!.text.trim() || lines[i]!.text.trimStart().startsWith('#'))) i++;
  return /^(question_id|family_id|subject|knowledge_node|step_role|question_type)\s*:/.test(lines[i]?.text ?? '');
};

export function parseLessonsMarkdown(mdText: string, sourceName: string): ParseResult {
  const lines=physicalLines(mdText), at=positionAt(mdText);
  const diagnostics: Diagnostic[]=[], items: ParseResult['items']=[], locations: QuestionLocation[]=[];
  let opening=0;
  while (opening<lines.length && !lines[opening]!.text.trim()) opening++;
  if (opening===lines.length) return {items,diagnostics,locations};
  if (!isDelimiter(lines[opening])) return {items,locations,diagnostics:[{file:sourceName,...at(lines[opening]!.offset),field:'frontmatter',message:'Expected an opening --- YAML frontmatter delimiter.'}]};
  while (opening<lines.length) {
    let closing=opening+1;
    while (closing<lines.length && !isDelimiter(lines[closing])) closing++;
    if (closing===lines.length) {
      diagnostics.push({file:sourceName,...at(lines[opening]!.offset),field:'frontmatter',message:'Unclosed YAML frontmatter block.'}); break;
    }
    const yamlStart=lines[opening]!.end, yamlEnd=lines[closing]!.offset;
    const yamlText=mdText.slice(yamlStart,yamlEnd);
    let next=closing+1;
    while (next<lines.length && !(isDelimiter(lines[next]) && looksLikeMetadata(lines,next+1))) next++;
    const bodyStart=lines[closing]!.end, bodyEnd=next<lines.length ? lines[next]!.offset : mdText.length;
    const body=mdText.slice(bodyStart,bodyEnd);
    const stem=body.trim();
    const stemStart=bodyStart + body.indexOf(stem);
    const doc=parseDocument(yamlText, {uniqueKeys:true,keepSourceTokens:true});
    for (const error of doc.errors) diagnostics.push({file:sourceName,...at(yamlStart+error.pos[0]),field:'frontmatter',message:error.message});
    for (const warning of doc.warnings) diagnostics.push({file:sourceName,...at(yamlStart+warning.pos[0]),field:'frontmatter',message:warning.message});
    if (!doc.errors.length) {
      if (!isMap(doc.contents)) diagnostics.push({file:sourceName,...at(yamlStart),field:'frontmatter',message:'Frontmatter must be a YAML mapping.'});
      else {
        const ranges=new Map<string,{start:number;end:number}>();
        for (const pair of doc.contents.items) {
          if (!isScalar(pair.key)) continue;
          const value=pair.value;
          const range=value && typeof value === 'object' && 'range' in value ? value.range : pair.key.range;
          if (range) ranges.set(String(pair.key.value),{start:yamlStart+range[0],end:yamlStart+range[1]});
          if (String(pair.key.value)==='options' && isMap(value)) for (const option of value.items) {
            if (isScalar(option.key) && isScalar(option.value) && option.value.range) ranges.set(`option_${String(option.key.value).toLowerCase()}`,{start:yamlStart+option.value.range[0],end:yamlStart+option.value.range[1]});
          }
        }
        let raw: Record<string,unknown>;
        try { raw=doc.toJS({maxAliasCount:50}) as Record<string,unknown>; }
        catch (error) {
          diagnostics.push({file:sourceName,...at(yamlStart),field:'frontmatter',message:String(error)});
          opening=next; continue;
        }
        if (raw.stem_md === undefined) raw.stem_md=stem;
        const locate=(field: string, characterOffset?: number) => {
          if (field==='stem_md' && !ranges.has('stem_md')) return at(stemStart+(characterOffset ?? 0));
          const range=ranges.get(field) ?? ranges.get(field==='pairs' ? 'matching_pairs' : field);
          if (!range) return at(lines[opening]!.offset);
          if (characterOffset===undefined) return at(range.start);
          const scalar=raw[field];
          if (typeof scalar==='string') {
            let cursor=range.start;
            for (let i=0; i<=characterOffset; i++) {
              const found=mdText.indexOf(scalar[i]!,cursor);
              if (found<0 || found>=range.end) return at(range.start);
              if (i===characterOffset) return at(found);
              cursor=found+1;
            }
          }
          return at(range.start);
        };
        const item=normalizeQuestion(raw,sourceName,locate,diagnostics);
        if (item) {
          items.push(item);
          const fields=Object.fromEntries([...ranges.keys()].map((field) => [field,locate(field)]));
          fields.stem_md=locate('stem_md');
          locations.push({file:sourceName,line:at(lines[opening]!.offset).line,fields});
        }
      }
    }
    opening=next;
  }
  return {items,diagnostics,locations};
}
