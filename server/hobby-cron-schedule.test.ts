import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDueEventReminderWindow, REMINDER_LOOKBACK_HOURS } from "./db";

type VercelCron = { path: string; schedule: string };

describe("Vercel Hobby cron schedule", () => {
  it("mantém cada rota em uma execução diária ou semanal", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as { crons: VercelCron[] };

    expect(config.crons.length).toBeGreaterThan(0);
    for (const cron of config.crons) {
      const fields = cron.schedule.trim().split(/\s+/);
      expect(fields, `${cron.path} deve ter uma expressão cron válida`).toHaveLength(5);
      expect(fields[0], `${cron.path} não pode executar a cada minuto`).not.toBe("*");
      expect(fields[1], `${cron.path} não pode executar a cada hora`).not.toBe("*");
      expect(fields[2], `${cron.path} deve ser diário ou semanal`).toBe("*");
      expect(fields[3], `${cron.path} deve ser diário ou semanal`).toBe("*");
      expect(fields[4], `${cron.path} deve usar dia da semana fixo ou todos`).toMatch(/^(?:\*|[0-6])$/);
    }

    const reminderCron = config.crons.find(cron => cron.path === "/api/scheduled/push/reminders");
    expect(reminderCron?.schedule).toBe("0 20 * * *");
    expect(config.crons.filter(cron => cron.path === "/api/scheduled/push/weekend").map(cron => cron.schedule)).toEqual([
      "0 21 * * 4",
      "0 18 * * 5",
    ]);
  });

  it("calcula uma janela idempotente de 36 horas para lembretes diários", () => {
    const now = new Date("2026-11-20T20:00:00.000Z");
    const window = getDueEventReminderWindow(now);

    expect(REMINDER_LOOKBACK_HOURS).toBe(36);
    expect(window.to).toEqual(now);
    expect(window.from.toISOString()).toBe("2026-11-19T08:00:00.000Z");
  });
});
