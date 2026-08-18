export class AppError extends Error {
    userMessage;
    status;
    constructor(userMessage, status = 0, cause) {
        super(userMessage, { cause });
        this.userMessage = userMessage;
        this.status = status;
        this.name = 'AppError';
    }
}
export function toUserError(error, fallback) {
    if (error instanceof AppError)
        return error;
    if (error instanceof Error && error.name === 'AbortError')
        return new AppError('処理に時間がかかっています。通信状況を確認して、もう一度お試しください。');
    return new AppError(fallback, 0, error);
}
//# sourceMappingURL=errors.js.map