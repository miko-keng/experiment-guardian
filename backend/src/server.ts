import { app } from "./app.js";
import { config } from "./config/env.js";

const server = app.listen(config.port, () => {
  console.log(`[Experiment Guardian Backend] running on http://localhost:${config.port}`);
  console.log(`[Environment] NODE_ENV=${config.nodeEnv}`);
  console.log(`[Database] path=${config.databasePath}`);
  console.log(`[AWS Bedrock] Region=${config.awsRegion}, Model=${config.bedrockModelId}, Mock=${config.allowMockAi}`);
});

process.on("SIGINT", () => {
  server.close(() => {
    process.exit(0);
  });
});
