import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

const buttonVariants = cva(
  "shrink-0 outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "inline-flex items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-primary/90 [&_svg:not([class*='size-'])]:size-4",
        destructive:
          "inline-flex items-center justify-center gap-2 rounded-md bg-destructive text-sm font-medium whitespace-nowrap text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4",
        outline:
          "inline-flex items-center justify-center gap-2 rounded-md border bg-background text-sm font-medium whitespace-nowrap shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4",
        secondary:
          "inline-flex items-center justify-center gap-2 rounded-md bg-secondary text-sm font-medium whitespace-nowrap text-secondary-foreground hover:bg-secondary/80 [&_svg:not([class*='size-'])]:size-4",
        ghost:
          "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 [&_svg:not([class*='size-'])]:size-4",
        link: "inline-flex items-center justify-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline",
        bare: "",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        auto: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
