import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "large";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white font-bold disabled:bg-muted disabled:text-ink-faint",
  secondary: "bg-muted text-ink font-semibold disabled:opacity-50",
  ghost: "bg-transparent border border-primary text-primary font-semibold disabled:border-border disabled:text-ink-faint",
  danger: "bg-danger-soft text-danger font-semibold disabled:opacity-50",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  default: "h-12 px-5 text-base",
  large: "h-14 px-6 text-base",
};

// Plain utility, deliberately NOT in a "use client" file — a Server
// Component (like LinkButton) can call a plain function from a shared
// module, but not one exported from a "use client" file (only components
// from those can be rendered, not their functions called directly). Keeping
// this here lets <Button> (client, needs motion) and <LinkButton> (can stay
// server-rendered, it's just an <a>) share one definition of what each
// variant looks like.
export function buttonClassName(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, className?: string) {
  return cn(
    "rounded-pill inline-flex items-center justify-center",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth && "w-full",
    className,
  );
}
