import { archiveExpiredSoldOutEvents } from "./db";
import { runIngestionPipeline } from "./ingestion";
import { runInstagramPipeline } from "./instagram-pipeline";

export type AgendaStepOptions = { archive?: boolean };

export async function runPublicAgendaStep(options: AgendaStepOptions = {}) {
  const archived = options.archive === false ? 0 : await archiveExpiredSoldOutEvents();
  const result = await runIngestionPipeline();
  return { archived, result };
}

export async function runInstagramAgendaStep(options: AgendaStepOptions = {}) {
  const archived = options.archive === false ? 0 : await archiveExpiredSoldOutEvents();
  const result = await runInstagramPipeline();
  return { archived, result };
}

export async function runFullAgendaRoutine() {
  const archived = await archiveExpiredSoldOutEvents();
  const [publicStep, instagramStep] = await Promise.all([
    runPublicAgendaStep({ archive: false }),
    runInstagramAgendaStep({ archive: false }),
  ]);
  return {
    archived,
    publicSources: publicStep.result,
    instagram: instagramStep.result,
  };
}

export async function runAgendaStepForScheduler(step: "public" | "instagram") {
  return step === "public" ? runPublicAgendaStep() : runInstagramAgendaStep();
}

export const AGENDA_ROUTINE_COMPOSITION = ["archiveExpiredSoldOutEvents", "runIngestionPipeline", "runInstagramPipeline"] as const;
