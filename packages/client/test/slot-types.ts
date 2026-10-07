// Checked by `tsc`, never run: each `@ts-expect-error` fails the typecheck if its line stops being an error.
import type { SlotHandle, SlotOverrides, SlotProps } from '../src/index.ts'

function portrait(element: HTMLElement, { src }: SlotProps['Dialogue.Portrait']): SlotHandle<SlotProps['Dialogue.Portrait']> {
  element.textContent = src
  return {
    update: (next) => { element.textContent = next.src },
    destroy: () => { element.textContent = '' },
  }
}

export const nestedOverride: SlotOverrides = { 'Dialogue.Portrait': portrait }

// @ts-expect-error A misspelt slot name.
export const misspeltSlot: SlotOverrides = { Dialog: portrait }

// @ts-expect-error A misspelt nested slot name.
export const misspeltNestedSlot: SlotOverrides = { 'Dialogue.portrait': portrait }

export const wrongRendererProps: SlotOverrides = {
  // @ts-expect-error ErrorScreen's props carry no `src`.
  ErrorScreen: portrait,
}
