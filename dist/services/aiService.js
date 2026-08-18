import { config, isLocalMode } from '../config.js';
import { AppError } from '../utils/errors.js';
import { supabaseRequest } from './supabaseRest.js';
export async function requestAiSuggestion(session, request) {
    if (isLocalMode) {
        throw new AppError('AI文章補助はSupabaseとOpenAIの接続後に利用できます。現在はローカル確認モードです。');
    }
    const result = await supabaseRequest(`/functions/v1/${encodeURIComponent(config.aiFunctionName)}`, {
        method: 'POST', token: session.accessToken, body: request, timeoutMs: 30000
    });
    if (!result?.suggestion?.trim())
        throw new AppError('AIから文章を受け取れませんでした。もう一度お試しください。');
    return { suggestion: result.suggestion.trim() };
}
//# sourceMappingURL=aiService.js.map