/**
 * Terminal-friendly text formatting.
 * Handles markdown-like rendering for terminal output.
 */

import { color, styled } from "./ansi.ts";

/**
 * Apply basic markdown formatting for terminal display.
 * Handles: bold, italic, inline code, code blocks, headers, lists.
 */
export function formatMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";

  for (const line of lines) {
    // Code block toggle
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
        const label = codeBlockLang ? styled(` ${codeBlockLang} `, color.dim) : "";
        result.push(`${styled("┌─", color.gray)}${label}${styled("─", color.gray)}`);
      } else {
        inCodeBlock = false;
        codeBlockLang = "";
        result.push(styled("└─", color.gray));
      }
      continue;
    }

    if (inCodeBlock) {
      result.push(`${styled("│ ", color.gray)}${line}`);
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1]!.length;
      const headerText = headerMatch[2]!;
      if (level === 1) {
        result.push(styled(headerText, color.bold, color.cyan));
      } else if (level === 2) {
        result.push(styled(headerText, color.bold, color.white));
      } else {
        result.push(styled(headerText, color.bold));
      }
      continue;
    }

    // Bullet lists
    const bulletMatch = line.match(/^(\s*)([-*])\s+(.*)/);
    if (bulletMatch) {
      const indent = bulletMatch[1]!;
      const content = bulletMatch[3]!;
      result.push(`${indent}${styled("•", color.cyan)} ${formatInline(content)}`);
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numMatch) {
      const indent = numMatch[1]!;
      const num = numMatch[2]!;
      const content = numMatch[3]!;
      result.push(`${indent}${styled(`${num}.`, color.cyan)} ${formatInline(content)}`);
      continue;
    }

    // Horizontal rules
    if (/^---+$/.test(line.trim())) {
      result.push(styled("─".repeat(40), color.gray));
      continue;
    }

    // Regular text with inline formatting
    result.push(formatInline(line));
  }

  return result.join("\n");
}

/**
 * Format inline markdown: bold, italic, inline code.
 */
export function formatInline(text: string): string {
  // Inline code (must be before bold/italic to avoid conflicts)
  text = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    return styled(code, color.yellow);
  });

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, (_match, bold: string) => {
    return styled(bold, color.bold);
  });

  // Italic
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_match, it: string) => {
    return styled(it, color.italic);
  });

  return text;
}

/**
 * Format a status bar line (fixed width, right-aligned info).
 */
export function formatStatusBar(left: string, right: string, width: number): string {
  const leftLen = stripAnsi(left).length;
  const rightLen = stripAnsi(right).length;
  const padding = Math.max(1, width - leftLen - rightLen);
  return `${styled(left + " ".repeat(padding) + right, color.dim)}`;
}

/**
 * Strip ANSI escape codes from a string (for length calculation).
 */
export function stripAnsi(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex -- intentional for ANSI stripping
    /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}

/**
 * Truncate text to fit within a given width, adding ellipsis if needed.
 */
export function truncate(text: string, maxWidth: number): string {
  const stripped = stripAnsi(text);
  if (stripped.length <= maxWidth) return text;
  return `${stripped.slice(0, maxWidth - 1)}…`;
}
