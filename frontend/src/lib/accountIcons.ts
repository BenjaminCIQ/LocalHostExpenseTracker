export const ACCOUNT_ICONS: { id: string; emoji: string; label: string }[] = [
  { id: "wallet", emoji: "👛", label: "Wallet" },
  { id: "credit-card", emoji: "💳", label: "Credit card" },
  { id: "bank", emoji: "🏦", label: "Bank" },
  { id: "piggy-bank", emoji: "🐷", label: "Piggy bank" },
  { id: "money", emoji: "💵", label: "Money" },
  { id: "coins", emoji: "🪙", label: "Coins" },
  { id: "briefcase", emoji: "💼", label: "Briefcase" },
  { id: "receipt", emoji: "🧾", label: "Receipt" },
  { id: "chart", emoji: "📈", label: "Chart" },
  { id: "gem", emoji: "💎", label: "Gem" },
  { id: "safe", emoji: "🔐", label: "Safe" },
  { id: "house", emoji: "🏠", label: "House" },
  { id: "shopping", emoji: "🛒", label: "Shopping" },
  { id: "gift", emoji: "🎁", label: "Gift" },
  { id: "treasure", emoji: "📦", label: "Treasure" },
];

const ACCOUNT_ICON_MAP = new Map(ACCOUNT_ICONS.map((a) => [a.id, a]));

export function getAccountIcon(id: string | null | undefined) {
  if (!id) return ACCOUNT_ICONS[0];
  return ACCOUNT_ICON_MAP.get(id) ?? ACCOUNT_ICONS[0];
}

export function getAccountIconByType(accountType: string): string {
  const t = (accountType ?? "").toLowerCase();
  if (t.includes("saving")) return "piggy-bank";
  if (t.includes("credit")) return "credit-card";
  if (t.includes("cash")) return "money";
  if (t.includes("checking")) return "wallet";
  return "wallet";
}
