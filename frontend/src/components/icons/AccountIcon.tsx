import { getAccountIcon } from "@/lib/accountIcons";
import { cn } from "@/lib/utils";

export default function AccountIcon({
  iconId,
  title,
  className = "h-4 w-4",
}: {
  iconId?: string | null;
  title?: string;
  className?: string;
}) {
  const { emoji } = getAccountIcon(iconId);
  return (
    <span
      title={title}
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
    >
      {emoji}
    </span>
  );
}
