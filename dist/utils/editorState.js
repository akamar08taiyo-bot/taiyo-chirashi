function inferMode(state) {
    const current = state.mode;
    if (current === 'rental' || current === 'cases' || current === 'consumables')
        return current;
    const title = state.title ?? '';
    const eyebrow = state.eyebrow ?? '';
    if (/消耗品|衛生用品|施設用品/.test(`${title}${eyebrow}`))
        return 'consumables';
    if (/レンタル/.test(`${title}${eyebrow}`))
        return 'rental';
    return 'cases';
}
/** Backward-compatible defaults for editor state saved by older app versions. */
export function normalizeEditorState(state) {
    const next = structuredClone(state);
    next.mode = inferMode(next);
    next.contact = {
        personName: next.contact?.personName ?? '',
        mobilePhone: next.contact?.mobilePhone ?? ''
    };
    next.display = {
        showLogo: next.display?.showLogo ?? true,
        showUnits: next.mode === 'consumables' ? false : (next.display?.showUnits ?? true),
        showPrices: next.display?.showPrices ?? true,
        showBurden1: next.mode === 'consumables' ? false : (next.display?.showBurden1 ?? true),
        showBurden2: next.mode === 'consumables' ? false : (next.display?.showBurden2 ?? false),
        showBurden3: next.mode === 'consumables' ? false : (next.display?.showBurden3 ?? false)
    };
    next.items = next.items ?? [];
    for (const item of next.items) {
        item.equipmentCategory = item.equipmentCategory ?? '';
        item.maker = item.maker ?? '';
        item.taisCode = item.taisCode ?? '';
        item.consumableCategory = item.consumableCategory ?? '';
        item.consumableType = item.consumableType ?? '';
        item.specification = item.specification ?? '';
        item.packSize = item.packSize ?? '';
        item.priceYen = Math.max(0, Number(item.priceYen ?? 0) || 0);
        item.showPrice = item.showPrice ?? true;
        item.transform = {
            scale: item.transform?.scale ?? 100,
            x: item.transform?.x ?? 50,
            y: item.transform?.y ?? 50,
            rotation: item.transform?.rotation ?? 0,
            fitMode: item.transform?.fitMode ?? 'cover'
        };
    }
    return next;
}
/**
 * Removes short-lived/local media URLs before EditorState is persisted to a server.
 * The durable mediaId is enough to rehydrate authorized signed URLs at read time.
 */
export function sanitizeEditorStateForServer(state) {
    const next = normalizeEditorState(state);
    for (const item of next.items) {
        if (!item.media)
            continue;
        item.media = {
            mediaId: item.media.mediaId,
            previewUrl: '',
            originalUrl: '',
            localBlobKey: null,
            fileName: item.media.fileName
        };
    }
    return next;
}
//# sourceMappingURL=editorState.js.map