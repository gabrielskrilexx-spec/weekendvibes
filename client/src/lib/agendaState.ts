export type AgendaWeekState = "loading" | "error" | "empty" | "ready";

export function getAgendaWeekState(input: { isLoading: boolean; isError: boolean; events?: unknown[] }): AgendaWeekState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.events?.length ? "ready" : "empty";
}
