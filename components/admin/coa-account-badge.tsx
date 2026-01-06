"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

interface CoaAccountBadgeProps {
  code: string | null | undefined;
  name: string | null | undefined;
  variant?: BadgeVariant;
  className?: string;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
  suffix?: React.ReactNode;
}

export const CoaAccountBadge = ({
  code,
  name,
  variant = "outline",
  className,
  tooltipSide = "top",
  suffix,
}: CoaAccountBadgeProps) => {
  if (!code) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tooltipText = name?.trim();

  const badge = (
    <Badge
      variant={variant}
      className={cn("font-mono", className)}
      title={tooltipText ? `${code} — ${tooltipText}` : code}
    >
      {code}
      {suffix}
    </Badge>
  );

  if (!tooltipText) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={4}>
        <span className="font-medium">{tooltipText}</span>
      </TooltipContent>
    </Tooltip>
  );
};
