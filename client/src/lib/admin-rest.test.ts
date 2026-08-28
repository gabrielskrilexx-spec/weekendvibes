import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { AdminRestError, postAdminJson } from "./admin-rest";

describe("postAdminJson authentication transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the preview session token as Bearer and includes cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn().mockReturnValue(`${COOKIE_NAME}=preview-token-123`),
    });

    await postAdminJson("/api/v2/admin/sync-stories", { sourceKey: "instagram:test" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/admin/sync-stories",
      expect.objectContaining({
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer preview-token-123",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("preserves a 403 REST response as a typed admin error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, message: "Acesso negado" }),
    }));

    await expect(postAdminJson("/api/v2/admin/remove-events", { ids: [1] })).rejects.toMatchObject({
      name: "AdminRestError",
      status: 403,
      code: "FORBIDDEN",
    } satisfies Partial<AdminRestError>);
  });
});
