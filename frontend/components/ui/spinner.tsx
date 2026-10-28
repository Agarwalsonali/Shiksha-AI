import { cn } from "@/lib/utils"
import { RiLoaderLine } from "@remixicon/react"

interface SpinnerProps {
  className?: string;
}

function Spinner({ className }: SpinnerProps) {
  return (
    <RiLoaderLine 
      role="status" 
      aria-label="Loading" 
      className={cn("size-4 animate-spin", className)} 
    />
  )
}

export { Spinner }
