import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getButtonHint,
  getPageHint,
  useHintsEnabled,
  type ButtonHintId,
  type HintContent,
} from "@/lib/hints";
import { useTourOptional } from "@/lib/tour";

const GAP = 8;
const PORTAL_Z = 9999;
const TOOLTIP_MAX_WIDTH = 320;

export type HintTooltipPlacement = "right-center" | "right-bottom" | "left-center" | "left-bottom";

/** Rich tooltip card: title, body copy, and text-style action. */
export function HintTooltipCard({
  hint,
  titleOverride,
  isNextStep,
  actionLabelOverride,
  actionToOverride,
  onActionClick,
  className,
}: {
  hint: HintContent;
  titleOverride?: string;
  isNextStep?: boolean;
  actionLabelOverride?: string;
  actionToOverride?: string;
  onActionClick?: () => void;
  className?: string;
}) {
  const title = titleOverride ?? hint.label;
  const actionLabel = actionLabelOverride ?? hint.actionLabel ?? hint.label;
  const actionTo = actionToOverride ?? hint.actionTo;
  const actionClass =
    "mt-4 block font-bold text-xs uppercase tracking-wider text-primary hover:underline cursor-pointer";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white text-gray-900 shadow-xl p-4 text-left min-w-[260px] max-w-[320px] dark:bg-gray-100 dark:text-gray-900 dark:border-gray-300",
        className
      )}
      role="tooltip"
    >
      <p
        className={cn(
          "font-bold text-sm",
          isNextStep ? "text-primary" : "text-gray-900 dark:text-gray-900"
        )}
      >
        {title}
      </p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-700 leading-relaxed">
        {hint.description}
      </p>
      {actionTo ? (
        <Link
          to={actionTo}
          className={cn(actionClass, "text-primary")}
          onClick={onActionClick}
        >
          {actionLabel}
        </Link>
      ) : onActionClick ? (
        <button
          type="button"
          className={cn(actionClass, "border-0 bg-transparent p-0")}
          onClick={onActionClick}
        >
          {actionLabel}
        </button>
      ) : (
        <span className={actionClass}>{actionLabel}</span>
      )}
    </div>
  );
}

/** Resolves placement to right or left based on viewport space; vertical part unchanged. */
function resolvePlacement(
  rect: DOMRect,
  placement: HintTooltipPlacement
): { left: number; top: number; transform: string; placeOnLeft: boolean } {
  const viewportWidth = window.innerWidth;
  const spaceRight = viewportWidth - (rect.right + GAP);
  const placeOnLeft =
    placement.startsWith("left") ||
    (placement.startsWith("right") && spaceRight < TOOLTIP_MAX_WIDTH);

  const isCenter =
    placement === "right-center" || placement === "left-center";
  const top = isCenter
    ? rect.top + rect.height / 2
    : rect.bottom + GAP;
  const transform = isCenter ? "translateY(-50%)" : "";

  const left = placeOnLeft
    ? Math.max(GAP, rect.left - TOOLTIP_MAX_WIDTH - GAP)
    : rect.right + GAP;

  return { left, top, transform, placeOnLeft };
}

/** Renders children in a portal, positioned next to the trigger. Flips to left when near right edge. */
export function HintTooltipPortal({
  show,
  triggerRef,
  placement,
  children,
}: {
  show: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  placement: HintTooltipPlacement;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    transform: string;
  } | null>(null);

  const updatePosition = useMemo(
    () => () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const resolved = resolvePlacement(rect, placement);
      setPosition({
        left: resolved.left,
        top: resolved.top,
        transform: resolved.transform,
      });
    },
    [triggerRef, placement]
  );

  useLayoutEffect(() => {
    if (!show) {
      setPosition(null);
      return;
    }
    const measure = () => updatePosition();
    measure();
    const rafId = requestAnimationFrame(measure);
    const timeoutId = window.setTimeout(measure, 50);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [show, updatePosition]);

  if (!show || !position) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: position.left,
    top: position.top,
    zIndex: PORTAL_Z,
    transform: position.transform || undefined,
    maxWidth: TOOLTIP_MAX_WIDTH,
  };

  return createPortal(
    <div style={style} className="hint-tooltip-portal">
      {children}
    </div>,
    document.body
  );
}

/** Info icon + tooltip for a button; only renders when hints are on or tour is active. Use subdued pulse when hints-only. */
export function ButtonHint({
  buttonId,
  placement = "right-center",
  className,
}: {
  buttonId: ButtonHintId;
  placement?: HintTooltipPlacement;
  className?: string;
}) {
  const hintsEnabled = useHintsEnabled();
  const tour = useTourOptional();
  const tourActive = Boolean(tour?.tourActive);
  const show = hintsEnabled || tourActive;
  const [hovered, setHovered] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hint = getButtonHint(buttonId);

  if (!show || !hint) return null;

  const isSubdued = hintsEnabled && !tourActive;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn(
          "inline-flex shrink-0",
          isSubdued ? "hint-info-icon-subdued" : "tour-info-icon",
          className
        )}
        style={{
          animation: isSubdued
            ? "hint-info-pulse-subdued 2.5s ease-in-out infinite"
            : "tour-info-pulse 1.8s ease-in-out infinite",
          willChange: "transform",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Info: ${hint.label}`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </span>
      <HintTooltipPortal
        show={hovered}
        triggerRef={triggerRef}
        placement={placement}
      >
        <HintTooltipCard hint={hint} />
      </HintTooltipPortal>
    </>
  );
}

/** For use in Sidebar: get page hint by path. Re-export for convenience. */
export { getPageHint };
