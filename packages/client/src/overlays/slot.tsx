/** @jsxImportSource preact */
import type { SlotName, SlotOverrides, SlotProps, SlotRenderer } from '../slots.ts'
import { createContext, h } from 'preact'
import type { JSX } from 'preact'
import { OverrideHost } from './override-host.tsx'
import { useContext } from 'preact/hooks'

export const SlotOverridesContext = createContext<SlotOverrides>({})

type BuiltIn<Name extends SlotName> = (props: SlotProps[Name]) => JSX.Element

export function Slot<Name extends SlotName>({ name, builtIn, ...props }: SlotProps[Name] & { name: Name; builtIn: BuiltIn<Name> }): JSX.Element {
  const renderer: SlotRenderer<SlotProps[Name]> | undefined = useContext(SlotOverridesContext)[name]
  const slotProps = props as unknown as SlotProps[Name]

  // Keyed by slot, so Loading giving way to ErrorScreen at the same spot creates a new renderer, not one fed the old slot's props.
  if (renderer) {return <OverrideHost key={name} name={name} props={slotProps} renderer={renderer} />}
  return h(builtIn, slotProps)
}
