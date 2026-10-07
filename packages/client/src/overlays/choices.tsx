/** @jsxImportSource preact */
import { ChoiceButton } from './choice-button.tsx'
import type { JSX } from 'preact'
import { Slot } from './slot.tsx'
import type { SlotProps } from '../slots.ts'

export function Choices({ choices, choose }: SlotProps['Choices']): JSX.Element {
  return (
    <>
      {choices.map((choice, index) => (
        // Labels can repeat, so the position is the only stable key.
        // oxlint-disable-next-line react/no-array-index-key
        <Slot builtIn={ChoiceButton} choice={choice} choose={choose} index={index} key={index} name="Choices.Button" />
      ))}
    </>
  )
}
