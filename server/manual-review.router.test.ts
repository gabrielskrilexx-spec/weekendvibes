import { describe, expect, it, vi } from "vitest";

const { listManualReviewEventsMock, getManualReviewMetricsMock, expireStaleManualReviewHighlightsMock, updateManualReviewEventMock, approveManualReviewEventMock, rejectManualReviewEventMock, undoManualReviewActionMock, undoManualReviewActionsMock, approveManualReviewEventsMock, rejectManualReviewEventsMock } = vi.hoisted(() => ({
  listManualReviewEventsMock: vi.fn(),
  getManualReviewMetricsMock: vi.fn(),
  expireStaleManualReviewHighlightsMock: vi.fn(),
  updateManualReviewEventMock: vi.fn(),
  approveManualReviewEventMock: vi.fn(),
  rejectManualReviewEventMock: vi.fn(),
  undoManualReviewActionMock: vi.fn(),
  undoManualReviewActionsMock: vi.fn(),
  approveManualReviewEventsMock: vi.fn(),
  rejectManualReviewEventsMock: vi.fn(),
}));

vi.mock("./manual-review", () => ({
  listManualReviewEvents: listManualReviewEventsMock,
  getManualReviewMetrics: getManualReviewMetricsMock,
  expireStaleManualReviewHighlights: expireStaleManualReviewHighlightsMock,
  updateManualReviewEvent: updateManualReviewEventMock,
  approveManualReviewEvent: approveManualReviewEventMock,
  rejectManualReviewEvent: rejectManualReviewEventMock,
  undoManualReviewAction: undoManualReviewActionMock,
  undoManualReviewActions: undoManualReviewActionsMock,
  approveManualReviewEvents: approveManualReviewEventsMock,
  rejectManualReviewEvents: rejectManualReviewEventsMock,
}));

import { appRouter } from "./routers";

const reviewEvent = {
  id: 7,
  sourceUrl: "https://www.instagram.com/meulugar.bar",
  sourceType: "instagram",
  title: "Sábado no Bar",
  summary: "Festa musical",
  eventDate: "2026-12-12T22:00:00.000Z",
  endDate: null,
  locationName: "Meu Lugar",
  address: "Av. Atlântica, 1",
  city: "Santos",
  category: "balada" as const,
  genre: null,
  priceCents: 0,
  imageUrl: null,
  rawText: "Sábado no Bar",
  reason: "revisao_manual_campos_parciais",
  status: "pending" as const,
  reviewedBy: null,
  reviewedAt: null,
  publishedEventId: null,
  createdAt: "2026-09-09T10:00:00.000Z",
  updatedAt: "2026-09-09T10:00:00.000Z",
};

const ctx = (role: "admin" | "user" = "admin") => ({
  user: { id: 1, openId: "admin-open-id", name: "Admin", email: null, loginMethod: null, role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("adminRoutine.manualReview", () => {
  it("lista a fila com filtros e mantém a paginação no contrato", async () => {
    const page = { items: [reviewEvent], total: 1, offset: 0, limit: 25, nextOffset: null, hasNextPage: false };
    listManualReviewEventsMock.mockResolvedValueOnce(page);
    const result = await appRouter.createCaller(ctx()).adminRoutine.manualReview.list({ status: "pending", sourceType: "instagram", offset: 0, limit: 25 });
    expect(listManualReviewEventsMock).toHaveBeenCalledWith({ status: "pending", sourceType: "instagram", offset: 0, limit: 25 });
    expect(result).toEqual(page);
  });

  it("retorna métricas separadas e propaga a identidade do administrador nas mutations", async () => {
    getManualReviewMetricsMock.mockResolvedValueOnce({ published: 12, awaitingReview: 3, rejected: 1, total: 4 });
    updateManualReviewEventMock.mockResolvedValueOnce({ ...reviewEvent, locationName: "Meu Lugar Santos" });
    approveManualReviewEventMock.mockResolvedValueOnce({ ...reviewEvent, status: "approved", reviewedBy: "admin-open-id", publishedEventId: 42, reviewedAt: "2026-09-09T11:00:00.000Z" });
    const caller = appRouter.createCaller(ctx());
    await expect(caller.adminRoutine.manualReview.metrics()).resolves.toEqual({ published: 12, awaitingReview: 3, rejected: 1, total: 4 });
    await caller.adminRoutine.manualReview.update({ id: 7, title: reviewEvent.title, reason: reviewEvent.reason, locationName: "Meu Lugar Santos" });
    expect(updateManualReviewEventMock).toHaveBeenCalledWith(expect.objectContaining({ id: 7, locationName: "Meu Lugar Santos" }));
    await caller.adminRoutine.manualReview.approve({ id: 7 });
    expect(approveManualReviewEventMock).toHaveBeenCalledWith(7, "admin-open-id");
  });

  it("encaminha ações em lote com contrato primitivo e IDs deduplicados", async () => {
    approveManualReviewEventsMock.mockResolvedValueOnce({ success: true, count: 2, ids: [7, 8] });
    rejectManualReviewEventsMock.mockResolvedValueOnce({ success: true, count: 1, ids: [9] });
    const caller = appRouter.createCaller(ctx());
    await expect(caller.adminRoutine.manualReview.approveMany({ ids: [7, 7, 8] })).resolves.toEqual({ success: true, count: 2, ids: [7, 8] });
    await expect(caller.adminRoutine.manualReview.rejectMany({ ids: [9] })).resolves.toEqual({ success: true, count: 1, ids: [9] });
    expect(approveManualReviewEventsMock).toHaveBeenCalledWith([7, 7, 8], "admin-open-id");
    expect(rejectManualReviewEventsMock).toHaveBeenCalledWith([9], "admin-open-id");
  });

  it("expira destaques antigos com retorno JSON primitivo", async () => {
    expireStaleManualReviewHighlightsMock.mockResolvedValueOnce({ expiredCount: 3, cutoff: "2026-09-19T12:00:00.000Z", retentionDays: 7 });
    await expect(appRouter.createCaller(ctx()).adminRoutine.manualReview.expireStaleHighlights({})).resolves.toEqual({ success: true, expiredCount: 3, cutoff: "2026-09-19T12:00:00.000Z", retentionDays: 7 });
    expect(expireStaleManualReviewHighlightsMock).toHaveBeenCalledOnce();
  });
  it("bloqueia usuários comuns também nas ações em lote", async () => {
    await expect(appRouter.createCaller(ctx("user")).adminRoutine.manualReview.approveMany({ ids: [7] })).rejects.toThrow();
  });

  it("desfaz uma ação recente com a identidade do administrador", async () => {
    undoManualReviewActionMock.mockResolvedValueOnce({ ...reviewEvent, status: "pending" });
    await expect(appRouter.createCaller(ctx()).adminRoutine.manualReview.undo({ id: 7 })).resolves.toMatchObject({ id: 7, status: "pending" });
    expect(undoManualReviewActionMock).toHaveBeenCalledWith(7, "admin-open-id");
  });

  it("desfaz ações em massa com contrato primitivo", async () => {
    undoManualReviewActionsMock.mockResolvedValueOnce({ success: true, count: 2, ids: [7, 8] });
    await expect(appRouter.createCaller(ctx()).adminRoutine.manualReview.undoMany({ ids: [7, 8] })).resolves.toEqual({ success: true, count: 2, ids: [7, 8] });
    expect(undoManualReviewActionsMock).toHaveBeenCalledWith([7, 8], "admin-open-id");
  });

  it("bloqueia usuários comuns", async () => {
    await expect(appRouter.createCaller(ctx("user")).adminRoutine.manualReview.list({ offset: 0, limit: 25 })).rejects.toThrow();
  });
});
