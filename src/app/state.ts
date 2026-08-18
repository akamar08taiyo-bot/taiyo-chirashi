import type { AppContext, AuthSession } from '../types.js';

export interface AppState {
  session: AuthSession | null;
  context: AppContext | null;
}

export const appState: AppState = { session: null, context: null };
