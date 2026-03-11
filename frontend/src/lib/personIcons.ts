export const PERSON_ICONS: { id: string; emoji: string; label: string }[] = [
  { id: "grin", emoji: "😀", label: "Grin" },
  { id: "smile", emoji: "😊", label: "Smile" },
  { id: "wink", emoji: "😉", label: "Wink" },
  { id: "heart-eyes", emoji: "😍", label: "Heart eyes" },
  { id: "cool", emoji: "😎", label: "Cool" },
  { id: "star-struck", emoji: "🤩", label: "Star struck" },
  { id: "party", emoji: "🥳", label: "Party" },
  { id: "baby", emoji: "👶", label: "Baby" },
  { id: "person", emoji: "🧑", label: "Person" },
  { id: "superhero", emoji: "🦸", label: "Superhero" },
  { id: "princess", emoji: "👸", label: "Princess" },
  { id: "heart", emoji: "❤️", label: "Heart" },
  { id: "sparkles", emoji: "✨", label: "Sparkles" },
  { id: "rainbow", emoji: "🌈", label: "Rainbow" },
  { id: "butterfly", emoji: "🦋", label: "Butterfly" },
  { id: "rocket", emoji: "🚀", label: "Rocket" },
];

const PERSON_ICON_MAP = new Map(PERSON_ICONS.map((p) => [p.id, p]));

export function getPersonIcon(id: string | null | undefined) {
  if (!id) return PERSON_ICONS[0];
  return PERSON_ICON_MAP.get(id) ?? PERSON_ICONS[0];
}
