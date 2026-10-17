export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let errBody: any = null;
    try {
      errBody = await res.json();
    } catch {
      // not json
    }

    const code = errBody?.error?.code || `HTTP_${res.status}`;
    const message = errBody?.error?.message || `Request failed with status ${res.status}`;
    const details = errBody?.error?.details;

    throw new ApiClientError(code, message, res.status, details);
  }

  return res.json() as Promise<T>;
}
