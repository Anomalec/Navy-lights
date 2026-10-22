export type Answer = "known" | "review";
export interface Card {
  id: string;
  image: string;
  answer: string;
  category: string;
  kind: string;
  page: number;
  position: number;
}
export interface Progress {
  version: 1;
  cards: Record<string, { status: Answer; attempts: number; lastSeen: string }>;
  days: Record<string, number>;
}
export const STORAGE_KEY = "navy-lights.progress.v1";
export const emptyProgress = (): Progress => ({
  version: 1,
  cards: {},
  days: {},
});
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function loadProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !data.cards ||
      !data.days ||
      Array.isArray(data.cards) ||
      Array.isArray(data.days)
    )
      return emptyProgress();
    const cards = Object.fromEntries(
      Object.entries(data.cards).filter(([id, record]) => {
        const item = record as Progress["cards"][string];
        return (
          /^\d{3}$/.test(id) &&
          item &&
          ["known", "review"].includes(item.status) &&
          Number.isInteger(item.attempts) &&
          item.attempts > 0 &&
          typeof item.lastSeen === "string"
        );
      }),
    );
    const days = Object.fromEntries(
      Object.entries(data.days).filter(
        ([date, count]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isInteger(count) &&
          (count as number) >= 0,
      ),
    );
    return { version: 1, cards, days } as Progress;
  } catch {
    return emptyProgress();
  }
}

export function recordAnswer(
  progress: Progress,
  id: string,
  status: Answer,
  now = new Date(),
): Progress {
  const date = localDate(now);
  return {
    version: 1,
    cards: {
      ...progress.cards,
      [id]: {
        status,
        attempts: (progress.cards[id]?.attempts ?? 0) + 1,
        lastSeen: now.toISOString(),
      },
    },
    days: { ...progress.days, [date]: (progress.days[date] ?? 0) + 1 },
  };
}

export function makeQueue(
  cards: Card[],
  progress: Progress,
  category = "all",
  mode = "all",
  kind = "all",
  shuffled = false,
): string[] {
  const ids = cards
    .filter(
      (card) =>
        (category === "all" || card.category === category) &&
        (kind === "all" || card.kind === kind) &&
        (mode !== "review" || progress.cards[card.id]?.status === "review"),
    )
    .map((card) => card.id);
  if (shuffled) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  return ids;
}

export function getCounts(cards: Card[], progress: Progress) {
  const records = cards.map((c) => progress.cards[c.id]).filter(Boolean);
  return {
    known: records.filter((c) => c.status === "known").length,
    review: records.filter((c) => c.status === "review").length,
    studied: records.length,
  };
}
