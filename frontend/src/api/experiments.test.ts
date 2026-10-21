import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAndAuditExperiment,
  createLinkedReview,
  getExperiment,
  listExperiments,
  updateFindingStatus,
} from "./experiments";

describe("Frontend API Client Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createAndAuditExperiment sends POST request with correct payload", async () => {
    const mockResponse = {
      experiment: { id: "exp-123", title: "Test Exp" },
      audit: { findings: [] },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await createAndAuditExperiment({
      transcript: "We trained model with lr 0.001",
      sourceType: "manual",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/experiments/audit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          transcript: "We trained model with lr 0.001",
          sourceType: "manual",
        }),
      })
    );
    expect(result.experiment.id).toBe("exp-123");
  });

  it("sends the selected repository config path with a linked review", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ experiment: { id: "linked-1" } }),
    } as any);
    await createLinkedReview({
      mergeRequestUrl: "https://gitlab.com/group/project/-/merge_requests/1",
      runId: "run-1",
      configFilePath: "configs/train.json",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/experiments/linked-review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mergeRequestUrl: "https://gitlab.com/group/project/-/merge_requests/1",
          runId: "run-1",
          configFilePath: "configs/train.json",
        }),
      })
    );
  });

  it("handles and formats error responses from backend", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "INVALID_INPUT",
          message: "Transcript cannot be empty",
        },
      }),
    } as any);

    await expect(
      createAndAuditExperiment({ transcript: "", sourceType: "manual" })
    ).rejects.toThrow("Transcript cannot be empty");
  });

  it("listExperiments constructs proper query parameters", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, limit: 10, offset: 0 }),
    } as any);

    await listExperiments({ limit: 10, offset: 0, status: "needs_review" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/experiments?limit=10&offset=0&status=needs_review",
      expect.anything()
    );
  });

  it("updateFindingStatus sends PATCH with status and note", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "f-1", status: "resolved" }),
    } as any);

    const res = await updateFindingStatus("f-1", "resolved", "Fixed seed");
    expect(res.status).toBe("resolved");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/audits/f-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "resolved", resolutionNote: "Fixed seed" }),
      })
    );
  });
});
