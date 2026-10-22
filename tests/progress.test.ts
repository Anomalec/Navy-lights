import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  emptyProgress,
  getCounts,
  loadProgress,
  localDate,
  makeQueue,
  recordAnswer,
} from "../src/progress";
import cards from "../src/cards.json";

describe("PDF collection", () => {
  it("contains all six cards on all 24 pages, each with its own image and caption", () => {
    expect(cards).toHaveLength(144);
    expect(new Set(cards.map((card) => card.id)).size).toBe(144);
    for (let page = 1; page <= 24; page++) {
      expect(
        cards.filter((c) => c.page === page).map((c) => c.position),
      ).toEqual([1, 2, 3, 4, 5, 6]);
    }
    for (const card of cards) {
      expect(existsSync(`public${card.image}`)).toBe(true);
      expect(card.answer.length).toBeGreaterThan(20);
    }
    expect(cards.filter((c) => c.kind === "night")).toHaveLength(121);
    expect(cards.filter((c) => c.kind === "day")).toHaveLength(23);
  });
  it("preserves multiple valid explanations and the unlit moored vessel", () => {
    expect(cards[3].answer).toContain("Правило 30");
    expect(cards[3].answer).toContain("парусное");
    expect(cards[107].answer).toBe("Судно пришвартованное к берегу.");
    expect(cards[143].page).toBe(24);
    expect(cards[143].answer).toContain("оранжевого цвета");
  });
});

describe("learning progress", () => {
  const now = new Date(2026, 9, 22, 10, 30);
  it("records repeated attempts while counting each card once", () => {
    const original = emptyProgress();
    const first = recordAnswer(original, "001", "review", now);
    const second = recordAnswer(first, "001", "known", now);
    expect(original.cards).toEqual({});
    expect(first.cards["001"].status).toBe("review");
    expect(second.cards["001"].attempts).toBe(2);
    expect(second.days[localDate(now)]).toBe(2);
    expect(getCounts(cards, second)).toEqual({
      known: 1,
      review: 0,
      studied: 1,
    });
  });
  it("only offers flagged cards in review mode and respects category and illustration filters", () => {
    let progress = recordAnswer(emptyProgress(), "001", "review", now);
    progress = recordAnswer(progress, "037", "review", now);
    progress = recordAnswer(progress, "002", "known", now);
    expect(makeQueue(cards, progress, "all", "review")).toEqual(["001", "037"]);
    expect(makeQueue(cards, progress, "power", "review")).toEqual(["001"]);
    expect(makeQueue(cards, progress, "all", "review", "day")).toEqual(["037"]);
    expect(makeQueue(cards, emptyProgress(), "all", "review")).toEqual([]);
  });
  it("shuffling preserves the full filtered deck without duplicates", () => {
    const sorted = makeQueue(cards, emptyProgress(), "fishing");
    const shuffled = makeQueue(
      cards,
      emptyProgress(),
      "fishing",
      "all",
      "all",
      true,
    );
    expect(shuffled.slice().sort()).toEqual(sorted.slice().sort());
    expect(new Set(shuffled).size).toBe(sorted.length);
  });
  it("restores persisted progress and tolerates corrupt, outdated or partially invalid data", () => {
    const progress = recordAnswer(emptyProgress(), "001", "known", now);
    expect(loadProgress(JSON.stringify(progress))).toEqual(progress);
    for (const raw of [null, "{", "null", "[]", '{"version":2}'])
      expect(loadProgress(raw)).toEqual(emptyProgress());
    expect(
      loadProgress(
        '{"version":1,"cards":{"001":null,"002":{"status":"known","attempts":-2}},"days":{"2026-10-22":-1}}',
      ),
    ).toEqual(emptyProgress());
  });
  it("ignores records that are not in the current deck", () => {
    const progress = recordAnswer(emptyProgress(), "999", "known", now);
    expect(getCounts(cards, progress)).toEqual({
      known: 0,
      review: 0,
      studied: 0,
    });
  });
});
