import type { ComponentType } from "react";
import {
  Banknote,
  ShoppingCart,
  Home,
  Car,
  Utensils,
  HeartPulse,
  Film,
  Plane,
  GraduationCap,
  Landmark,
  CircleHelp,
} from "lucide-react";

export const DEFAULT_CATEGORY_ICON = CircleHelp;

export function getCategoryIcon(categoryName?: string | null): ComponentType<{ className?: string }> {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return DEFAULT_CATEGORY_ICON;

  if (n.includes("salary") || n.includes("income") || n.includes("freelance")) return Banknote;
  if (n.includes("rent") || n.includes("housing") || n.includes("utilities") || n.includes("internet")) return Home;
  if (n.includes("transport") || n.includes("fuel") || n.includes("parking") || n.includes("rideshare") || n.includes("taxi")) return Car;
  if (n.includes("grocer") || n.includes("food") || n.includes("drink") || n.includes("restaurant") || n.includes("coffee") || n.includes("takeaway")) return Utensils;
  if (n.includes("shopping") || n.includes("clothing") || n.includes("electronics") || n.includes("online")) return ShoppingCart;
  if (n.includes("health") || n.includes("pharmacy") || n.includes("doctor") || n.includes("gym")) return HeartPulse;
  if (n.includes("entertain") || n.includes("subscription") || n.includes("streaming") || n.includes("hobbies")) return Film;
  if (n.includes("travel") || n.includes("flight") || n.includes("hotel") || n.includes("vacation")) return Plane;
  if (n.includes("education") || n.includes("book") || n.includes("course")) return GraduationCap;
  if (n.includes("financial") || n.includes("bank") || n.includes("tax") || n.includes("savings") || n.includes("investment")) return Landmark;

  return DEFAULT_CATEGORY_ICON;
}

