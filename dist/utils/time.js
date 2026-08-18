export function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return '';
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
//# sourceMappingURL=time.js.map