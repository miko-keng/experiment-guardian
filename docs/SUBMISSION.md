# Experiment Guardian — submission description

## Project description

Experiment Guardian is an Alexa+ research memory and reproducibility copilot. Researchers describe an experiment by voice, paste a transcript, or import meeting notes. In the submitted build, a clearly labeled deterministic Alexa+ Simulator coordinates real MCP tools that convert the discussion into a structured experiment record, run deterministic reproducibility checks, identify missing controls, ask the next useful question, and request explicit confirmation before changing the record.

The system preserves the evidence behind every value and decision. When a session ends, it produces an evidence-linked report showing the experiment configuration, audit findings, decision history, and unresolved risks. This turns informal laboratory conversations into an auditable record without forcing researchers to stop their work and complete a long form.

The judge-facing web simulation shows the Alexa+ conversation, the exact MCP tool being called, the deterministic audit engine, approval requests, and the generated report. The same capabilities are exposed by a real Streamable HTTP MCP server at `/mcp`.

The connected ML review path takes a GitLab merge request and MLflow run ID, pins the commit and run evidence, and compares recorded parameters with repository configuration using deterministic rules. The user has produced a real GitLab-backed MLflow run for this path. The Guardian deployment still requires connector credentials before this path can be demonstrated live.

## How it works

1. A researcher starts a session and speaks, types, or imports notes.
2. The configured extractor converts the text into a structured experiment.
3. Deterministic rules audit controls, confounding changes, and (when the ML research policy is enabled) separately stored artifact evidence.
4. Alexa+ selects a concise follow-up question from open findings.
5. New parameter values become proposed revisions rather than silent edits.
6. The researcher approves or rejects the exact proposed action.
7. Approved revisions create history and trigger a fresh audit.
8. Experiment Guardian generates an evidence-linked reproducibility report.

## Track

Primary track: **Alexa+** using the simulated-experience path with a working Streamable HTTP MCP server and an included Agent Skill.

AWS Builder status: **not claimed unless live AWS invocation is enabled and demonstrated before submission**. The repository contains Amazon Bedrock and Amazon Transcribe/S3 adapters, but account policies blocked live invocation. The current public demo uses the deterministic Bedrock Mock Extractor and browser speech recognition. The limitation and exact service feedback are documented in `docs/FEEDBACK_AND_FRICTION_LOG.md`.

## Technology used

- Alexa+ MCP Toolkit architecture and Agent Skill
- Model Context Protocol SDK with Streamable HTTP
- React, TypeScript, Vite, and Tailwind CSS
- Express and TypeScript
- SQLite with immutable revisions and audit history
- Optional Amazon Bedrock Converse API
- Optional Amazon Transcribe and Amazon S3
- Optional Bee CLI conversation adapter

## Work completed during the submission window

- Built the Alexa+ session conductor and MCP research tools, including a read-only verification and quality-gate tool.
- Added persisted conversation sessions, events, and tool traces.
- Added deterministic reproducibility audits and immutable audit runs.
- Added governed experiment revisions with explicit approval.
- Added research-decision evidence and generated reports.
- Added browser voice, document import, and optional recorded-audio ingestion.
- Added the animated Research Decision Observatory and tool timeline.
- Added optional Bee, Bedrock, Transcribe, and S3 integrations.
- Packaged the application for public HTTPS deployment.
- Added two repeatable database-backed anomaly demos, artifact uploads, verification states, an ML research policy, and a read-only quality-gate decision.
- Added a GitLab and MLflow linked-review importer, stored source snapshots, a browser review flow, and an advisory CI script.

The quality gate remains advisory. The connected-review code fetches a pinned GitLab commit and MLflow run, but has not yet been verified end-to-end with the deployed app and its server-side token. It does not enforce a pull-request check or independently hash remote model and dataset artifacts. Demo fixture metadata is labelled user-confirmed rather than independently verified. Live Bedrock access remains account-dependent.

## Repository review

The repository includes an MIT license, complete source, environment template, deployment definition, setup instructions, Agent Skill, MCP entry point, submission copy, demo script, and friction log.
