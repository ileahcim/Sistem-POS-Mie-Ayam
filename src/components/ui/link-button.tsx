import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClassName, type ButtonVariant, type ButtonSize } from "./button-styles";

// A navigation link styled identically to <Button> — for CTAs that go to
// another route ("Lanjut ke Pembayaran") rather than run an action in
// place. No press-scale (Link doesn't need motion to feel responsive; the
// browser's own navigation is the feedback) — and no "use client" needed
// here, so it stays server-renderable.
export function LinkButton({
  href,
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClassName(variant, size, fullWidth, className)}>
      {children}
    </Link>
  );
}
