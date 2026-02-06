'use client';

import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"

export function GlobalCommandBar({ open: externalOpen, onOpenChange }: { open?: boolean, onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  
  const open = externalOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (onOpenChange) {
          onOpenChange(!open)
        } else {
          setInternalOpen((prev: boolean) => !prev)
        }
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Dashboard</CommandItem>
            <CommandItem>Global Settings</CommandItem>
            <CommandItem>Users</CommandItem>
          </CommandGroup>
           <CommandGroup heading="Recent">
            <CommandItem>Invoice #INV-2024-001</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
