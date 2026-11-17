import type { Json } from "@/lib/supabase/database.types";

export const EVENT_NAVIGATION_SECTION_IDS = ["pre-evento", "durante-evento", "pos-evento"] as const;
export type EventNavigationSectionId = (typeof EVENT_NAVIGATION_SECTION_IDS)[number];

export type EventNavigationSection = {
  id: EventNavigationSectionId;
  label: string;
  items: {
    id: string;
    href: string;
    label: string;
  }[];
};

export type EventNavigationOrder = Partial<Record<EventNavigationSectionId, string[]>>;

export function parseEventNavigationOrder(value: Json | null | undefined): EventNavigationOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    EVENT_NAVIGATION_SECTION_IDS.flatMap((sectionId) => {
      const sectionOrder = value[sectionId];
      if (!Array.isArray(sectionOrder)) return [];
      return [[sectionId, sectionOrder.filter((item): item is string => typeof item === "string")]];
    })
  );
}

export function applyEventNavigationOrder(
  sections: EventNavigationSection[],
  order: EventNavigationOrder
): EventNavigationSection[] {
  return sections.map((section) => {
    const preferredIds = order[section.id] ?? [];
    const rank = new Map(preferredIds.map((id, index) => [id, index]));
    return {
      ...section,
      items: section.items
        .map((item, defaultIndex) => ({ item, defaultIndex }))
        .sort((left, right) => {
          const leftRank = rank.get(left.item.id);
          const rightRank = rank.get(right.item.id);
          if (leftRank === undefined && rightRank === undefined) return left.defaultIndex - right.defaultIndex;
          if (leftRank === undefined) return 1;
          if (rightRank === undefined) return -1;
          return leftRank - rightRank;
        })
        .map(({ item }) => item),
    };
  });
}
