import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../../config/env.js";

/**
 * Initializes the Bedrock Runtime client with appropriate credentials,
 * region, and token support.
 */
export function createBedrockClient(): BedrockRuntimeClient {
  const clientConfig: ConstructorParameters<typeof BedrockRuntimeClient>[0] = {
    region: config.awsRegion,
  };

  // Support custom Bedrock API Key bearer token authentication
  if (config.awsBearerTokenBedrock) {
    clientConfig.token = {
      token: config.awsBearerTokenBedrock,
    };
  }

  return new BedrockRuntimeClient(clientConfig);
}

export const bedrockClient = createBedrockClient();
export const bedrockModelId = config.bedrockModelId;
