import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, checked, defaultChecked, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(checked || defaultChecked || false)

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked)
      }
    }, [checked])

    const handleToggle = () => {
      const newState = !isChecked
      setIsChecked(newState)
      if (onCheckedChange) {
        onCheckedChange(newState)
      }
    }

    return (
      <div 
        className={cn(
          "w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out relative",
          isChecked ? "bg-blue-600 shadow-lg shadow-blue-500/20" : "bg-gray-800 border border-white/5",
          className
        )}
        onClick={handleToggle}
      >
        <motion.div
          className="w-4 h-4 rounded-full bg-white shadow-sm"
          animate={{ x: isChecked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={isChecked}
          onChange={() => {}}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
