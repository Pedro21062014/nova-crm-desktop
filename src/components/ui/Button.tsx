import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  disabled,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      "bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs",
    secondary:
      "bg-muted text-foreground hover:bg-border",
    ghost:
      "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    danger:
      "bg-danger text-white hover:bg-danger/90 shadow-xs",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      type={type}
      onClick={onClick}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}

export { Button };
