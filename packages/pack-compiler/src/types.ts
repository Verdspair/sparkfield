import type { CoursePack, CoursePackManifest, QuestionItem } from '@pkg/contracts';

export interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  field: string;
  message: string;
}
export interface SourceText { file: string; text: string }
export type CoursePackMeta = Omit<CoursePackManifest, 'contentSha256' | 'itemCount' | 'createdAtIso'>;
export interface SourcePosition { line: number; column: number }
export interface QuestionLocation {
  file: string;
  line: number;
  fields: Record<string, SourcePosition>;
}
export interface ParseResult {
  items: QuestionItem[];
  diagnostics: Diagnostic[];
  locations: QuestionLocation[];
}
export type CompileResult =
  | { ok: true; pack: CoursePack; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };

export function positionAt(text: string): (offset: number) => SourcePosition {
  const starts = [0];
  for (const m of text.matchAll(/\r\n|\r|\n/g)) starts.push(m.index + m[0].length);
  return (offset) => {
    let lo = 0;
    let hi = starts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid;
    }
    return { line: lo + 1, column: offset - starts[lo]! + 1 };
  };
}
