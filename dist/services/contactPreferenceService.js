import { isLocalMode } from '../config.js';
import { kvGet, kvSet } from '../storage/localDb.js';
import { supabaseRequest } from './supabaseRest.js';
function key(session) {
    return `flyer-contact:${session.userId}`;
}
export async function getRememberedFlyerContact(session) {
    const local = await kvGet(key(session));
    if (local)
        return { personName: local.personName ?? '', mobilePhone: local.mobilePhone ?? '' };
    return {
        personName: session.profile.flyerContactName || session.profile.displayName || '',
        mobilePhone: session.profile.mobilePhone || session.profile.phone || ''
    };
}
export async function saveRememberedFlyerContact(session, contact) {
    const value = { personName: contact.personName.trim(), mobilePhone: contact.mobilePhone.trim() };
    await kvSet(key(session), value);
    session.profile.flyerContactName = value.personName;
    session.profile.mobilePhone = value.mobilePhone;
    if (isLocalMode)
        return;
    await supabaseRequest('/rest/v1/rpc/update_my_flyer_contact', {
        method: 'POST',
        token: session.accessToken,
        body: { p_contact_name: value.personName, p_mobile_phone: value.mobilePhone }
    });
}
//# sourceMappingURL=contactPreferenceService.js.map