import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ingestion-reports", () => ({
  listAllFilteredStories: vi.fn(),
  buildFilteredStoriesCsv: vi.fn((stories: unknown[]) => `csv:${stories.length}`),
}));

import { buildFilteredStoriesCsv, listAllFilteredStories } from "./ingestion-reports";
import {
  createFilteredStoriesExportJob,
  getFilteredStoriesExportDownload,
  getFilteredStoriesExportJobStatus,
  resetFilteredStoriesExportJobsForTest,
} from "./filtered-story-export-jobs";

describe("filtered stories export jobs", () => {
  beforeEach(() => {
    resetFilteredStoriesExportJobsForTest();
    vi.mocked(listAllFilteredStories).mockReset();
    vi.mocked(buildFilteredStoriesCsv).mockClear();
  });

  it("isola filtros e conteúdo entre dois jobs", async () => {
    vi.mocked(listAllFilteredStories).mockImplementation(async filters => [{ id: filters.username ?? "sem-fonte" } as never]);
    const csvJob = createFilteredStoriesExportJob({ format: "csv", filters: { username: "alpha" } });
    const jsonJob = createFilteredStoriesExportJob({ format: "json", filters: { username: "beta" } });
    expect(csvJob.jobId).not.toBe(jsonJob.jobId);
    expect(getFilteredStoriesExportJobStatus(csvJob.jobId).status).toBe("queued");
    await new Promise(resolve => setTimeout(resolve, 10));
    const csv = getFilteredStoriesExportDownload(csvJob.jobId);
    const json = getFilteredStoriesExportDownload(jsonJob.jobId);
    expect(csv.content).toBe("csv:1");
    expect(JSON.parse(json.content)).toEqual([{ id: "beta" }]);
    expect(vi.mocked(listAllFilteredStories)).toHaveBeenCalledWith(expect.objectContaining({ username: "alpha" }));
    expect(vi.mocked(listAllFilteredStories)).toHaveBeenCalledWith(expect.objectContaining({ username: "beta" }));
  });

  it("expõe 100% e download somente depois do processamento", async () => {
    vi.mocked(listAllFilteredStories).mockResolvedValue([]);
    const job = createFilteredStoriesExportJob({ format: "json", filters: {} });
    expect(() => getFilteredStoriesExportDownload(job.jobId)).toThrow("ainda não está pronta");
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(getFilteredStoriesExportJobStatus(job.jobId)).toMatchObject({ status: "completed", progress: 100, contentType: "application/json", fileName: expect.stringMatching(/\.json$/) });
    expect(getFilteredStoriesExportDownload(job.jobId)).toMatchObject({ contentType: "application/json", content: "[]" });
  });
});
