/**
 * Simple terminal spinner for indicating work in progress.
 */

import { color, screen, styled } from "./ansi.ts";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export type Spinner = {
  start: (text: string) => void;
  update: (text: string) => void;
  stop: (text: string) => void;
};

export function createSpinner(): Spinner {
  let frameIndex = 0;
  let interval: ReturnType<typeof setInterval> | undefined;
  let currentText = "";

  function render() {
    const frame = FRAMES[frameIndex % FRAMES.length]!;
    frameIndex++;
    process.stderr.write(`\r${screen.clearToEndOfLine}${styled(frame, color.cyan)} ${currentText}`);
  }

  return {
    start(text: string) {
      currentText = text;
      frameIndex = 0;
      render();
      interval = setInterval(render, 80);
    },
    update(text: string) {
      currentText = text;
    },
    stop(text: string) {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
      process.stderr.write(`\r${screen.clearToEndOfLine}${text}\n`);
    },
  };
}
