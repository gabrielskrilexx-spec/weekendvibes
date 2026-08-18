import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("events.list", () => {
  it("retorna uma lista estável quando o banco ainda não está disponível", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).events.list({ day: "sexta", city: "Santos", neighborhood: "Gonzaga", size: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});
