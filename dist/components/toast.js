let timer = 0;
export function showToast(message, kind = 'default') {
    let el = document.getElementById('app-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'app-toast';
        el.className = 'toast';
        el.setAttribute('role', 'status');
        document.body.append(el);
    }
    el.textContent = message;
    el.className = `toast show ${kind}`;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => el?.classList.remove('show'), 2800);
}
//# sourceMappingURL=toast.js.map