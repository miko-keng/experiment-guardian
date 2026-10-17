export class BedrockIntegrationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
    statusCode: number = 500
  ) {
    super(message);
    this.name = "BedrockIntegrationError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static fromAwsError(err: any): BedrockIntegrationError {
    const errName = err.name || err.__type || "UnknownError";
    const message = err.message || "Unknown AWS Bedrock error occurred";

    if (errName === "AccessDeniedException") {
      return new BedrockIntegrationError(
        "PERMISSION_DENIED",
        `AWS Bedrock access denied: ${message}`,
        { awsError: errName },
        502
      );
    }

    if (
      errName === "UnrecognizedClientException" ||
      errName === "InvalidSignatureException" ||
      errName === "ExpiredTokenException"
    ) {
      return new BedrockIntegrationError(
        "AUTH_ERROR",
        `AWS Bedrock authentication failure: ${message}`,
        { awsError: errName },
        502
      );
    }

    if (errName === "ResourceNotFoundException") {
      return new BedrockIntegrationError(
        "MODEL_UNAVAILABLE",
        `Bedrock model not found or unavailable in configured region: ${message}`,
        { awsError: errName },
        502
      );
    }

    if (
      errName === "ThrottlingException" ||
      errName === "ModelNotReadyException" ||
      errName === "ServiceQuotaExceededException"
    ) {
      return new BedrockIntegrationError(
        "RATE_LIMITED",
        `Bedrock service throttling: ${message}`,
        { awsError: errName },
        429
      );
    }

    if (errName === "ModelTimeoutException" || errName === "TimeoutError") {
      return new BedrockIntegrationError(
        "TIMEOUT",
        `Bedrock invocation timed out: ${message}`,
        { awsError: errName },
        504
      );
    }

    return new BedrockIntegrationError(
      "BEDROCK_SERVICE_ERROR",
      `AWS Bedrock invocation failed: ${message}`,
      { awsError: errName },
      502
    );
  }
}
