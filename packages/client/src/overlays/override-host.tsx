/** @jsxImportSource preact */
import type { SlotHandle, SlotName, SlotRenderer } from '../slots.ts'
import { useLayoutEffect, useRef } from 'preact/hooks'
import type { JSX } from 'preact'

// `display: contents`, so the host adds no box of its own; a span, so it stays phrasing content inside a `<button>`.
const HOST_STYLE = { display: 'contents' } as const

// Leaves an empty element for a Platform's renderer, created once and updated with every new set of props.
export function OverrideHost<Props>({ name, renderer, props }: { name: SlotName; renderer: SlotRenderer<Props>; props: Props }): JSX.Element {
  const hostRef = useRef<HTMLSpanElement>(null)

  // Preact 11's `useRef` has no zero-argument form.
  // oxlint-disable-next-line unicorn/no-useless-undefined
  const handleRef = useRef<SlotHandle<Props> | undefined>(undefined)
  const drawnPropsRef = useRef(props)

  useLayoutEffect(() => {
    const handle = renderer(hostRef.current!, drawnPropsRef.current)
    handleRef.current = handle
    return (): void => {
      handleRef.current = undefined
      handle.destroy()
    }
  }, [renderer])

  // Only for new props, so a renderer isn't updated with the props it was just created with.
  useLayoutEffect(() => {
    if (props === drawnPropsRef.current) {return}
    drawnPropsRef.current = props
    handleRef.current?.update(props)
  }, [props])

  return <span data-rpg-slot={name} ref={hostRef} style={HOST_STYLE} />
}
