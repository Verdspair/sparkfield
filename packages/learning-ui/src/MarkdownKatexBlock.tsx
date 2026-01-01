import React, { useEffect, useMemo } from 'react';
import katex from 'katex';
import { ensureLearningUiStyles } from './learningUiStyles.js';

export interface MarkdownKatexBlockProps {
  readonly content: string;
  readonly inline?: boolean;
  readonly className?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderKatexSafe(tex: string, displayMode: boolean): string {
  const trimmed = tex.trim();
  if (!trimmed) return '';
  return katex.renderToString(trimmed, {
    displayMode,
    throwOnError: false,
    strict: false,
    output: 'htmlAndMathml',
  });
}

interface TokenStore {
  tokens: string[];
  stash(html: string): string;
  restore(text: string): string;
}

function createTokenStore(): TokenStore {
  const tokens: string[] = [];
  return {
    tokens,
    stash(html: string): string {
      const idx = tokens.length;
      tokens.push(html);
      return `\u0000LUI_TOK_${idx}_END\u0000`;
    },
    restore(text: string): string {
      return text.replace(/\u0000LUI_TOK_(\d+)_END\u0000/g, (_, idxStr: string) => {
        const idx = Number(idxStr);
        return tokens[idx] ?? '';
      });
    },
  };
}

function formatInlineMarkdown(rawLine: string, store: TokenStore): string {
  let text = rawLine.replace(/`([^`\n]+)`/g, (_, code: string) =>
    store.stash(`<code>${escapeHtml(code)}</code>`),
  );

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) =>
    store.stash(`<div class="lui-katex-block">${renderKatexSafe(tex, true)}</div>`),
  );

  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) =>
    store.stash(`<div class="lui-katex-block">${renderKatexSafe(tex, true)}</div>`),
  );

  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) =>
    store.stash(`<span class="lui-katex-inline">${renderKatexSafe(tex, false)}</span>`),
  );

  text = text.replace(/(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s|\$)\$/g, (_, tex: string) =>
    store.stash(`<span class="lui-katex-inline">${renderKatexSafe(tex, false)}</span>`),
  );
  text = text.replace(/(?<!\\)\$([^$\s])\$/g, (_, tex: string) =>
    store.stash(`<span class="lui-katex-inline">${renderKatexSafe(tex, false)}</span>`),
  );

  text = escapeHtml(text).replace(/\\\$/g, '$');

  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  return store.restore(text);
}

function isTableDivider(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  return cells.length >= 2 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function renderMarkdownWithKatexToHtml(
  markdown: string,
  options?: { inline?: boolean },
): string {
  const normalized = (markdown ?? '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return '';

  const store = createTokenStore();
  if (options?.inline) {
    return formatInlineMarkdown(normalized.replace(/\n+/g, ' '), store);
  }

  let src = normalized.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang: string, code: string) => {
    const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
    return `\n${store.stash(`<pre${langAttr}><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)}\n`;
  });

  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    return `\n${store.stash(`<div class="lui-katex-block">${renderKatexSafe(tex, true)}</div>`)}\n`;
  });

  const lines = src.split('\n');
  const htmlBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^\u0000LUI_TOK_\d+_END\u0000$/.test(trimmed)) {
      htmlBlocks.push(store.restore(trimmed));
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      htmlBlocks.push('<hr />');
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const body = formatInlineMarkdown(headingMatch[2]!, store);
      htmlBlocks.push(`<h${level}>${body}</h${level}>`);
      i += 1;
      continue;
    }

    const nextLine = lines[i + 1];
    if (trimmed.includes('|') && nextLine !== undefined && isTableDivider(nextLine)) {
      const headers = splitTableCells(rawLine);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i] ?? '';
        if (!rowLine.trim() || !rowLine.includes('|')) break;
        rows.push(splitTableCells(rowLine));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${formatInlineMarkdown(h, store)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${headers.map((_, ci) => `<td>${formatInlineMarkdown(r[ci] ?? '', store)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      htmlBlocks.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test((lines[i] ?? '').trim())) {
        quoteLines.push((lines[i] ?? '').trim().replace(/^>\s?/, ''));
        i += 1;
      }
      const inner = quoteLines.map((ql) => formatInlineMarkdown(ql, store)).join('<br />');
      htmlBlocks.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? '').trim())) {
        const itemText = (lines[i] ?? '').trim().replace(/^[-*]\s+/, '');
        items.push(`<li>${formatInlineMarkdown(itemText, store)}</li>`);
        i += 1;
      }
      htmlBlocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
        const itemText = (lines[i] ?? '').trim().replace(/^\d+\.\s+/, '');
        items.push(`<li>${formatInlineMarkdown(itemText, store)}</li>`);
        i += 1;
      }
      htmlBlocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const candidate = lines[i] ?? '';
      const ct = candidate.trim();
      if (
        !ct ||
        /^\u0000LUI_TOK_\d+_END\u0000$/.test(ct) ||
        /^(#{1,4})\s+/.test(ct) ||
        /^>\s?/.test(ct) ||
        /^[-*]\s+/.test(ct) ||
        /^\d+\.\s+/.test(ct) ||
        /^(-{3,}|\*{3,})$/.test(ct)
      ) {
        break;
      }
      paraLines.push(formatInlineMarkdown(ct, store));
      i += 1;
    }
    if (paraLines.length > 0) {
      htmlBlocks.push(`<p>${paraLines.join('<br />')}</p>`);
    }
  }

  return htmlBlocks.join('\n');
}

export function MarkdownKatexBlock({
  content,
  inline = false,
  className = '',
}: MarkdownKatexBlockProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const html = useMemo(
    () => renderMarkdownWithKatexToHtml(content, { inline }),
    [content, inline],
  );

  if (inline) {
    return (
      <span
        className={`lui-md lui-md--inline ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className={`lui-md ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
