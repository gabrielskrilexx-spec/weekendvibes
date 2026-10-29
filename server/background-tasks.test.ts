import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ waitUntil: vi.fn() }));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));

import { registerBackgroundTask } from "./background-tasks";

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerBackgroundTask", () => {
  it("registra a Promise no lifecycle Vercel para continuar após o ACK HTTP", async () => {
    const task = Promise.resolve("done");
    registerBackgroundTask(task, "test job");
    expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
    await expect(mocks.waitUntil.mock.calls[0][0]).resolves.toBe("done");
  });

  it("captura falhas do worker para não gerar rejection não tratada", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const task = Promise.reject(new Error("upstream secret"));
    registerBackgroundTask(task, "test job");
    await expect(mocks.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("[Background task] test job failed", "upstream secret");
    errorLog.mockRestore();
  });
});
