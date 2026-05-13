import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: "sm" | "md" | "lg";
}

export function Card({ children, className, hover, onClick, padding = "md" }: CardProps) {
  const paddings = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const Component = hover ? motion.div : "div";
  const hoverProps = hover
    ? {
        whileHover: { y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <Component
      className={cn(
        "bg-card rounded-2xl border border-border shadow-xs",
        paddings[padding],
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      {...hoverProps}
    >
      {children}
    </Component>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}
