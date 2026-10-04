import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "destructive";
type Size = "md" | "sm" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-surface hover:bg-muted",
  ghost: "hover:bg-muted",
  destructive: "text-destructive hover:bg-muted",
};
const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  // タッチ端末は幅に関わらず 44px。マウス等の細かいポインターだけ詰める
  sm: "min-h-11 px-3 text-sm pointer-fine:min-h-9",
  icon: "size-11 pointer-fine:size-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
