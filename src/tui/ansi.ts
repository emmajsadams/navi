/**
 * ANSI escape code helpers for terminal rendering.
 * No dependencies — just raw escape sequences.
 */

export const ESC = "\x1b";
export const CSI = `${ESC}[`;

// Colors
export const color = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,

  // Foreground
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  gray: `${CSI}90m`,

  // Background
  bgRed: `${CSI}41m`,
  bgGreen: `${CSI}42m`,
  bgYellow: `${CSI}43m`,
  bgBlue: `${CSI}44m`,
};

// Cursor
export const cursor = {
  hide: `${CSI}?25l`,
  show: `${CSI}?25h`,
  save: `${ESC}7`,
  restore: `${ESC}8`,
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  moveUp: (n: number) => `${CSI}${n}A`,
  moveDown: (n: number) => `${CSI}${n}B`,
  moveToColumn: (col: number) => `${CSI}${col}G`,
};

// Screen
export const screen = {
  clear: `${CSI}2J${CSI}H`,
  clearLine: `${CSI}2K`,
  clearDown: `${CSI}J`,
  clearToEndOfLine: `${CSI}K`,
};

// Helpers
export function styled(text: string, ...styles: string[]): string {
  if (styles.length === 0) return text;
  return `${styles.join("")}${text}${color.reset}`;
}

export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows ?? 24,
    cols: process.stdout.columns ?? 80,
  };
}
