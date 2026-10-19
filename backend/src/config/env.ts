import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { z } from "zod";

// Load .env from root or current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../../.env");
const localEnvPath = path.resolve(__dirname, "../../.env");

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databasePath: string;
  awsRegion: string;
  bedrockModelId: string;
  awsBearerTokenBedrock?: string;
  bedrockMaxTokens: number;
  bedrockTimeoutMs: number;
  bedrockTemperature: number;
  allowMockAi: boolean;
  persistTranscripts: boolean;
  maxTranscriptCharacters: number;
  beeEnabled: boolean;
  beeApiBaseUrl?: string;
  beeApiToken?: string;
  beeCliPath: string;
  beeCliTimeoutMs: number;
  transcribeEnabled: boolean;
  transcribeLanguageCode: string;
  transcribeInputBucket?: string;
  transcribeOutputBucket?: string;
  transcribeJobTimeoutMs: number;
  maxAudioBytes: number;
  frontendOrigin: string;
  gitlabBaseUrl: string;
  gitlabToken?: string;
  gitlabTrainingConfigPath: string;
  mlflowTrackingUrl?: string;
  mlflowToken?: string;
  appAccessPassword?: string;
}

const booleanFromEnv = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().trim().min(1).default("./data/experiment-guardian.sqlite"),
  AWS_REGION: z.string().trim().min(1).default("ap-southeast-2"),
  BEDROCK_MODEL_ID: z.string().trim().min(1).default("anthropic.claude-haiku-5-5"),
  AWS_BEARER_TOKEN_BEDROCK: z.string().trim().optional(),
  BEDROCK_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  BEDROCK_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  BEDROCK_TEMPERATURE: z.coerce.number().min(0).max(1).default(0),
  ALLOW_MOCK_AI: booleanFromEnv.default("false"),
  PERSIST_TRANSCRIPTS: booleanFromEnv.default("true"),
  MAX_TRANSCRIPT_CHARACTERS: z.coerce.number().int().positive().default(50000),
  BEE_ENABLED: booleanFromEnv.default("false"),
  BEE_API_BASE_URL: z.string().trim().url().optional().or(z.literal("")),
  BEE_API_TOKEN: z.string().trim().optional(),
  BEE_CLI_PATH: z.string().trim().min(1).default("bee"),
  BEE_CLI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  TRANSCRIBE_ENABLED: booleanFromEnv.default("false"),
  TRANSCRIBE_LANGUAGE_CODE: z.string().trim().min(2).default("en-US"),
  TRANSCRIBE_INPUT_BUCKET: z.string().trim().optional(),
  TRANSCRIBE_OUTPUT_BUCKET: z.string().trim().optional(),
  TRANSCRIBE_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  MAX_AUDIO_BYTES: z.coerce.number().int().positive().default(25000000),
  FRONTEND_ORIGIN: z.string().trim().url().default("http://localhost:5173"),
  GITLAB_BASE_URL: z.string().trim().url().default("https://gitlab.com"),
  GITLAB_TOKEN: z.string().trim().optional(),
  GITLAB_TRAINING_CONFIG_PATH: z.string().trim().min(1).default("experiment-guardian.json"),
  MLFLOW_TRACKING_URL: z.string().trim().url().optional().or(z.literal("")),
  MLFLOW_TOKEN: z.string().trim().optional(),
  APP_ACCESS_PASSWORD: z.string().min(12).optional().or(z.literal("")),
});

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid application environment configuration: ${details}`);
  }

  const values = parsed.data;
  if ((values.MLFLOW_TRACKING_URL || values.GITLAB_TOKEN || values.MLFLOW_TOKEN) && !values.APP_ACCESS_PASSWORD) {
    throw new Error("APP_ACCESS_PASSWORD (12+ characters) is required when linked evidence access is configured");
  }
  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    databasePath: values.DATABASE_PATH,
    awsRegion: values.AWS_REGION,
    bedrockModelId: values.BEDROCK_MODEL_ID,
    awsBearerTokenBedrock: values.AWS_BEARER_TOKEN_BEDROCK || undefined,
    bedrockMaxTokens: values.BEDROCK_MAX_TOKENS,
    bedrockTimeoutMs: values.BEDROCK_TIMEOUT_MS,
    bedrockTemperature: values.BEDROCK_TEMPERATURE,
    allowMockAi: values.ALLOW_MOCK_AI,
    persistTranscripts: values.PERSIST_TRANSCRIPTS,
    maxTranscriptCharacters: values.MAX_TRANSCRIPT_CHARACTERS,
    beeEnabled: values.BEE_ENABLED,
    beeApiBaseUrl: values.BEE_API_BASE_URL || undefined,
    beeApiToken: values.BEE_API_TOKEN || undefined,
    beeCliPath: values.BEE_CLI_PATH,
    beeCliTimeoutMs: values.BEE_CLI_TIMEOUT_MS,
    transcribeEnabled: values.TRANSCRIBE_ENABLED,
    transcribeLanguageCode: values.TRANSCRIBE_LANGUAGE_CODE,
    transcribeInputBucket: values.TRANSCRIBE_INPUT_BUCKET || undefined,
    transcribeOutputBucket: values.TRANSCRIBE_OUTPUT_BUCKET || undefined,
    transcribeJobTimeoutMs: values.TRANSCRIBE_JOB_TIMEOUT_MS,
    maxAudioBytes: values.MAX_AUDIO_BYTES,
    frontendOrigin: values.FRONTEND_ORIGIN,
    gitlabBaseUrl: values.GITLAB_BASE_URL.replace(/\/$/, ""),
    gitlabToken: values.GITLAB_TOKEN || undefined,
    gitlabTrainingConfigPath: values.GITLAB_TRAINING_CONFIG_PATH,
    mlflowTrackingUrl: values.MLFLOW_TRACKING_URL?.replace(/\/$/, "") || undefined,
    mlflowToken: values.MLFLOW_TOKEN || undefined,
    appAccessPassword: values.APP_ACCESS_PASSWORD || undefined,
  };
}

export const config = loadConfig();
