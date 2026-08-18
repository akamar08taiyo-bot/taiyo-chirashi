export class AppError extends Error {
  constructor(public readonly userMessage: string, public readonly status = 0, cause?: unknown) {
    super(userMessage, { cause });
    this.name = 'AppError';
  }
}

export function toUserError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === 'AbortError') return new AppError('処理に時間がかかっています。通信状況を確認して、もう一度お試しください。');
  return new AppError(fallback, 0, error);
}
