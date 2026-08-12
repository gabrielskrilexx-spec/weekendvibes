import { describe, expect, it } from "vitest";
import { getAgendaWeekState } from "./agendaState";

describe("getAgendaWeekState", () => {
  it("cobre loading, erro, vazio e sucesso", () => {
    expect(getAgendaWeekState({ isLoading: true, isError: false })).toBe("loading");
    expect(getAgendaWeekState({ isLoading: false, isError: true })).toBe("error");
    expect(getAgendaWeekState({ isLoading: false, isError: false, events: [] })).toBe("empty");
    expect(getAgendaWeekState({ isLoading: false, isError: false, events: [{ id: 1 }] })).toBe("ready");
  });
});
