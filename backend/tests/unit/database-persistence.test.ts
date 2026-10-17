import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/database/connection.js";
import { SqliteExperimentRepository } from "../../src/database/experiment-repository.js";
import { SqliteAuditRepository } from "../../src/database/audit-repository.js";
import { Experiment, ExperimentSource, UUID } from "../../src/extraction/experiment-schema.js";

describe("SQLite Persistence", () => {
  let db: ReturnType<typeof Database>;
  let expRepo: SqliteExperimentRepository;
  let auditRepo: SqliteAuditRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    expRepo = new SqliteExperimentRepository(db);
    auditRepo = new SqliteAuditRepository(db);
  });

  it("persists and retrieves an experiment record accurately", () => {
    const id = "test-uuid-1" as UUID;
    const now = new Date().toISOString();

    const experiment: Experiment = {
      id,
      title: "ResNet 50 Baseline",
      hypothesis: "Test hypothesis",
      objective: "Train image classifier",
      status: "audited",
      model: {
        architecture: "ResNet-50",
        modelName: "ResNet",
        modelVersion: "v1",
        parameters: { depth: 50 },
      },
      dataset: {
        datasetName: "CIFAR-10",
        datasetVersion: "v1.0",
        datasetIdentifier: "cifar10",
        trainSplit: "train",
        validationSplit: null,
        testSplit: "test",
        preprocessing: { normalize: true },
      },
      training: {
        learningRate: 0.001,
        batchSize: 64,
        epochs: 50,
        optimizer: "SGD",
        randomSeed: 1234,
        framework: "PyTorch",
        frameworkVersion: "2.0",
        environment: {},
        otherParameters: {},
      },
      evaluation: {
        metrics: { top1_acc: 0.88 },
        evaluationProcedure: "Standard validation",
        evaluationDatasetIdentifier: null,
        codeCommit: "abc1234",
        notes: null,
      },
      baselineExperimentId: null,
      source: {
        sourceType: "manual",
        sourceId: null,
        sourceReference: null,
        transcriptHash: "hash123",
        sourceTimestamp: now,
      },
      extractedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const source: ExperimentSource = {
      sourceType: "manual",
      sourceId: null,
      sourceReference: null,
      transcriptText: "We trained ResNet-50 on CIFAR-10 with learning rate 0.001",
      transcriptHash: "hash123",
      sourceTimestamp: now,
    };

    expRepo.create(experiment, source);

    const fetched = expRepo.findById(id);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe("ResNet 50 Baseline");
    expect(fetched?.training.learningRate).toBe(0.001);
    expect(fetched?.training.randomSeed).toBe(1234);
    expect(fetched?.source.transcriptText).toBe(source.transcriptText);
  });

  it("persists audit findings and updates status without deleting evidence", () => {
    const expId = "test-uuid-2" as UUID;
    const now = new Date().toISOString();

    const exp: Experiment = {
      id: expId,
      title: "Exp 2",
      hypothesis: null,
      objective: null,
      status: "needs_review",
      model: { architecture: null, modelName: null, modelVersion: null, parameters: {} },
      dataset: { datasetName: null, datasetVersion: null, datasetIdentifier: null, trainSplit: null, validationSplit: null, testSplit: null, preprocessing: {} },
      training: { learningRate: null, batchSize: null, epochs: null, optimizer: null, randomSeed: null, framework: null, frameworkVersion: null, environment: {}, otherParameters: {} },
      evaluation: { metrics: {}, evaluationProcedure: null, evaluationDatasetIdentifier: null, codeCommit: null, notes: null },
      baselineExperimentId: null,
      source: { sourceType: "manual", sourceId: null, sourceReference: null, transcriptHash: null, sourceTimestamp: null },
      extractedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    expRepo.create(exp, exp.source);

    const findingId = "finding-1" as UUID;
    auditRepo.createMany([
      {
        id: findingId,
        experimentId: expId,
        ruleId: "MISSING_RANDOM_SEED",
        title: "Random seed missing",
        description: "Seed is not recorded",
        severity: "warning",
        status: "open",
        evidence: [
          {
            type: "experiment_field",
            experimentId: expId,
            fieldPath: "training.randomSeed",
            description: "Null seed",
            excerpt: null,
            previousValue: null,
            currentValue: null,
            sourceReference: null,
          },
        ],
        recommendation: "Record seed",
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const findingsBefore = auditRepo.listByExperiment(expId);
    expect(findingsBefore.length).toBe(1);
    expect(findingsBefore[0].status).toBe("open");

    // Update status to resolved
    const updated = auditRepo.updateStatus(findingId, "resolved", "Seed 42 verified in git repo");
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("resolved");
    expect(updated?.resolutionNote).toBe("Seed 42 verified in git repo");
    expect(updated?.evidence.length).toBe(1); // Evidence preserved!
  });
});
