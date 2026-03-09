import { useEffect, useState } from "react";

export function getSelectedPersonId(): number | null {
  const raw = localStorage.getItem("selected_person_id");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function useSelectedPersonId(): number | null {
  const [id, setId] = useState<number | null>(() => getSelectedPersonId());

  useEffect(() => {
    const handler = () => setId(getSelectedPersonId());
    window.addEventListener("person-filter-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("person-filter-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return id;
}

