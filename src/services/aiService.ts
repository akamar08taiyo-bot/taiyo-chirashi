import { config, isLocalMode } from '../config.js';
import type { AiSuggestionRequest, AiSuggestionResponse, AuthSession } from '../types.js';
import { AppError } from '../utils/errors.js';
import { supabaseRequest } from './supabaseRest.js';

export async function requestAiSuggestion(session: AuthSession, request: AiSuggestionRequest): Promise<AiSuggestionResponse> {
  if (isLocalMode) {
    throw new AppError('AI文章補助はSupabaseとOpenAIの接続後に利用できます。現在はローカル確認モードです。');
  }
  const result = await supabaseRequest<AiSuggestionResponse>(`/functions/v1/${encodeURIComponent(config.aiFunctionName)}`, {
    method: 'POST', token: session.accessToken, body: request, timeoutMs: 30000
  });
  if (!result?.suggestion?.trim()) throw new AppError('AIから文章を受け取れませんでした。もう一度お試しください。');
  return { suggestion: result.suggestion.trim() };
}
