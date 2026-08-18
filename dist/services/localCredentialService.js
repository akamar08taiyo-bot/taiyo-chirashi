import { kvGet, kvSet } from '../storage/localDb.js';
import { demoProfiles } from './demoData.js';
const LOCAL_CREDENTIALS = 'demo.credentials.v1';
const DEFAULT_DEMO_PASSWORD = 'demo1234';
const PBKDF2_ITERATIONS = 120_000;
export async function ensureLocalCredentialSeeds() {
    let credentials = await kvGet(LOCAL_CREDENTIALS);
    if (credentials?.length)
        return;
    credentials = [];
    for (const profile of demoProfiles)
        credentials.push(await makeCredential(profile.employeeId, DEFAULT_DEMO_PASSWORD));
    await kvSet(LOCAL_CREDENTIALS, credentials);
}
export async function verifyLocalPassword(employeeId, password) {
    await ensureLocalCredentialSeeds();
    const credentials = (await kvGet(LOCAL_CREDENTIALS)) ?? [];
    const credential = credentials.find(c => c.employeeId === employeeId);
    if (!credential)
        return false;
    const candidate = await derive(password, fromBase64(credential.salt));
    return constantTimeEqual(candidate, fromBase64(credential.hash));
}
export async function setLocalPassword(employeeId, password) {
    await ensureLocalCredentialSeeds();
    const credentials = (await kvGet(LOCAL_CREDENTIALS)) ?? [];
    const next = await makeCredential(employeeId, password);
    const index = credentials.findIndex(c => c.employeeId === employeeId);
    if (index >= 0)
        credentials[index] = next;
    else
        credentials.push(next);
    await kvSet(LOCAL_CREDENTIALS, credentials);
}
async function makeCredential(employeeId, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt);
    return { employeeId, salt: toBase64(salt), hash: toBase64(hash) };
}
async function derive(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
    return new Uint8Array(bits);
}
function constantTimeEqual(a, b) { if (a.length !== b.length)
    return false; let diff = 0; for (let i = 0; i < a.length; i++)
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0); return diff === 0; }
function toBase64(bytes) { let binary = ''; for (const byte of bytes)
    binary += String.fromCharCode(byte); return btoa(binary); }
function fromBase64(value) { const binary = atob(value); const out = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++)
    out[i] = binary.charCodeAt(i); return out; }
export const localDefaultDemoPassword = DEFAULT_DEMO_PASSWORD;
//# sourceMappingURL=localCredentialService.js.map