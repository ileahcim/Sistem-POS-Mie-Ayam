"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { buttonClassName, type ButtonVariant, type ButtonSize } from "./button-styles";

export type { ButtonVariant, ButtonSize };

export function Button({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
  children,
  onClick,
  disabled,
  type = "button",
  "aria-label": ariaLabel,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={buttonClassName(variant, size, fullWidth, className)}
    >
      {children}
    </motion.button>
  );
}
