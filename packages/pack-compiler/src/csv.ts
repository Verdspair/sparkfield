import type { Diagnostic, ParseResult, QuestionLocation } from './types.js';
import { positionAt } from './types.js';
import { normalizeQuestion } from './validation.js';

interface Cell { value: string; offset: number; characterOffsets: number[] }
interface Row { cells: Cell[]; offset: number }
interface LexError { offset: number; fieldIndex: number; message: string }

function scanCsv(text: string): {rows: Row[]; errors: LexError[]} {
  const rows: Row[] = [], errors: LexError[] = [];
  let row: Row = {cells: [], offset: 0};
  let cell: Cell = {value: '', offset: 0, characterOffsets: []};
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  const append = (character: string, offset: number) => {cell.value += character; cell.characterOffsets.push(offset);};
  const endCell = (nextOffset: number) => {row.cells.push(cell); cell={value:'',offset:nextOffset,characterOffsets:[]}; state='start';};
  const endRow = (nextOffset: number) => {
    endCell(nextOffset);
    if (row.cells.some((c) => c.value.length > 0) || row.cells.length > 1) rows.push(row);
    row={cells:[],offset:nextOffset};
  };
  for (let i=0; i<text.length; i++) {
    const ch=text[i]!;
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i+1] === '"') {append('"',i); i++;}
        else state='closed';
      } else append(ch,i);
      continue;
    }
    if (ch === ',') {endCell(i+1); continue;}
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i+1] === '\n') i++;
      endRow(i+1); continue;
    }
    if (state === 'closed') {
      errors.push({offset:i,fieldIndex:row.cells.length,message:'Unexpected character after the closing quote; expected comma or record newline.'});
      state='plain'; append(ch,i); continue;
    }
    if (ch === '"') {
      if (state === 'start') {state='quoted'; cell.offset=i+1;}
      else {errors.push({offset:i,fieldIndex:row.cells.length,message:'A double quote inside an unquoted CSV field is invalid.'}); append(ch,i);}
      continue;
    }
    state='plain'; append(ch,i);
  }
  if (state === 'quoted') errors.push({offset:cell.offset-1,fieldIndex:row.cells.length,message:'Unclosed quoted CSV field.'});
  if (row.cells.length > 0 || cell.value !== '' || state !== 'start') endRow(text.length);
  return {rows,errors};
}

const REQUIRED_COLUMNS = ['question_id','family_id','subject','knowledge_node','step_role','question_type',
  'assessment_kind','allow_material_review','stem_md','answer_spec','explanation_md','source_license'];

export function parseQuestionsCsv(csvText: string, sourceName: string): ParseResult {
  const text=csvText.startsWith('\ufeff') ? csvText.slice(1) : csvText;
  const at=positionAt(text);
  const {rows,errors}=scanCsv(text);
  const diagnostics: Diagnostic[]=[];
  const items: ParseResult['items']=[], locations: QuestionLocation[]=[];
  const header=rows[0];
  const columns=header?.cells.map((cell) => cell.value.trim()) ?? [];
  for (const error of errors) diagnostics.push({file:sourceName,...at(error.offset),field:columns[error.fieldIndex] ?? 'record',message:error.message});
  for (const name of REQUIRED_COLUMNS) if (!columns.includes(name)) diagnostics.push({file:sourceName,line:header ? at(header.offset).line : 1,column:1,field:name,message:`Missing required CSV column: ${name}.`});
  const seen=new Set<string>();
  header?.cells.forEach((cell,index) => {
    const name=columns[index]!;
    if (seen.has(name)) diagnostics.push({file:sourceName,...at(cell.offset),field:name,message:`Duplicate CSV column: ${name}.`});
    seen.add(name);
  });
  for (const row of rows.slice(1)) {
    if (row.cells.length !== columns.length) {
      diagnostics.push({file:sourceName,...at(row.offset),field:'record',message:`Expected ${columns.length} fields but received ${row.cells.length}.`});
      continue;
    }
    const raw: Record<string,unknown>={}, cellByField=new Map<string,Cell>();
    row.cells.forEach((cell,i) => {raw[columns[i]!]=cell.value; cellByField.set(columns[i]!,cell);});
    const locate=(field: string, characterOffset?: number) => {
      const cell=cellByField.get(field) ?? (field === 'options' ? cellByField.get('option_a') : field === 'pairs' ? cellByField.get('matching_pairs') : undefined);
      return at(cell ? characterOffset === undefined ? cell.offset : cell.characterOffsets[characterOffset] ?? cell.offset : row.offset);
    };
    const item=normalizeQuestion(raw,sourceName,locate,diagnostics);
    if (item) {
      items.push(item);
      locations.push({file:sourceName,line:at(row.offset).line,fields:Object.fromEntries(columns.map((key) => [key,locate(key)]))});
    }
  }
  return {items,diagnostics,locations};
}
