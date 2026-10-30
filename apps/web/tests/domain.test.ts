import { describe, expect, it } from "vitest";
import {
  escapeSearch,
  humanError,
  matchesDraft,
  payload,
  validateDraft,
} from "../src/domain";
import type { RequestRow } from "../src/domain";
describe("request input", () => {
  it("rejects blanks and missing category together", () => {
    expect(
      Object.keys(
        validateDraft({ title: "  ", description: "\n", category: "" }),
      ),
    ).toEqual(["title", "description", "category"]);
  });
  it("accepts trimmed limits and rejects overflow", () => {
    expect(
      validateDraft({
        title: " " + "a".repeat(160),
        description: "a".repeat(10000),
        category: "bot",
      }),
    ).toEqual({});
    expect(
      Object.keys(
        validateDraft({
          title: "a".repeat(161),
          description: "a".repeat(10001),
          category: "bot",
        }),
      ),
    ).toEqual(["title", "description"]);
  });
  it("normalizes payload without sending owner or status", () => {
    expect(
      payload({ title: " A ", description: " B\n", category: "report" }),
    ).toEqual({ title: "A", description: "B", category: "report" });
  });
});
describe("literal title search", () => {
  it("escapes SQL wildcard characters and backslashes but preserves punctuation", () => {
    expect(escapeSearch('100% _ \\ "тест"')).toBe('100\\% \\_ \\\\ "тест"');
  });
});
describe("retry comparison", () => {
  const row = {
    title: "Задача",
    description: "Описание",
    category: "bot",
  } as RequestRow;
  it("recognizes the same normalized content", () => {
    expect(
      matchesDraft(row, {
        title: " Задача ",
        description: "Описание\n",
        category: "bot",
      }),
    ).toBe(true);
  });
  it("does not report success if the retry changed content", () => {
    expect(
      matchesDraft(row, {
        title: "Другая задача",
        description: "Описание",
        category: "bot",
      }),
    ).toBe(false);
  });
});
it("does not show backend diagnostics or credentials in error text", () => {
  expect(humanError({ message: "postgres://private:secret@host" })).toBe(
    "Не удалось выполнить действие. Попробуйте ещё раз.",
  );
});
