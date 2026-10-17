import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Backend API Endpoints Integration", () => {
  it("GET /api/v1/health returns ok status and configuration indicators", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
    expect(typeof res.body.bedrockConfigured).toBe("boolean");
    expect(typeof res.body.beeConfigured).toBe("boolean");
  });

  it("POST /api/v1/experiments/audit rejects empty transcripts with 400", async () => {
    const res = await request(app)
      .post("/api/v1/experiments/audit")
      .send({ transcript: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("INVALID_INPUT");
  });

  it("POST /api/v1/experiments/audit rejects oversized transcripts with 400", async () => {
    const oversized = "a".repeat(50001);
    const res = await request(app)
      .post("/api/v1/experiments/audit")
      .send({ transcript: oversized });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INPUT_TOO_LARGE");
  });

  it("GET /api/v1/bee/status returns disabled fallback info", async () => {
    const res = await request(app).get("/api/v1/bee/status");
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.status).toBe("not_configured");
  });

  it("GET /api/v1/bee/conversations returns 501 when unconfigured", async () => {
    const res = await request(app).get("/api/v1/bee/conversations");
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("BEE_NOT_CONFIGURED");
  });

  it("GET /api/v1/experiments returns paginated experiment list", async () => {
    const res = await request(app).get("/api/v1/experiments?limit=10&offset=0");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });
});
