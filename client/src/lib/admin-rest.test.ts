import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { postAdminJson } from "./admin-rest";

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

    await postAdminJson("/api/admin/sync-stories", { sourceKey: "instagram:test" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/sync-stories",
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
});
