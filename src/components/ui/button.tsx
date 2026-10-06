import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-normal ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Apple Signature Action Blue Pill
        default:
          "bg-primary text-primary-foreground font-normal rounded-full hover:brightness-105 active:brightness-95 shadow-none",
        
        // Apple Secondary Ghost Pill (1px Action Blue border)
        "secondary-pill":
          "border border-primary bg-transparent text-primary hover:bg-primary/5 active:bg-primary/10 rounded-full",
        
        // Apple Dark Utility (8px rounded rect for nav/bag/sign-in)
        "dark-utility":
          "bg-[#1d1d1f] dark:bg-[#2a2a2c] text-white rounded-lg border border-transparent dark:border-white/10 hover:brightness-110",
        
        // Apple Pearl Capsule (11px rounded capsule)
        "pearl-capsule":
          "bg-[#fafafc] dark:bg-[#252527] text-[#333333] dark:text-[#cccccc] border border-[#f0f0f0] dark:border-white/10 rounded-[11px] hover:bg-white dark:hover:bg-[#2a2a2c]",
        
        // Destructive / Danger
        destructive:
          "bg-destructive text-destructive-foreground rounded-full hover:brightness-95",
        
        // Hairline outline
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/50 rounded-full",
        
        // Secondary soft surface
        secondary:
          "bg-secondary text-secondary-foreground rounded-full hover:brightness-95",
        
        // Ghost
        ghost:
          "hover:bg-muted/50 text-foreground rounded-full",
        
        // Text link (Action Blue)
        link:
          "text-primary underline-offset-4 hover:underline active:scale-100 p-0 h-auto",
        
        // Circular icon control
        "icon-circular":
          "h-11 w-11 rounded-full bg-[rgba(210,210,215,0.64)] dark:bg-[rgba(255,255,255,0.14)] text-foreground hover:brightness-95 border-0 p-0",
      },
      size: {
        default: "h-10 px-5 py-2 text-[15px]",
        sm: "h-8 px-3.5 text-[13px] rounded-full",
        lg: "h-12 px-7 text-[17px] rounded-full",
        hero: "h-12 px-8 text-[18px] font-light rounded-full",
        utility: "h-8 px-4 text-[14px] rounded-lg",
        icon: "h-10 w-10 rounded-full p-0",
        "icon-sm": "h-8 w-8 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
