export function debounce(fn, waitMs) {
    let timer = null;
    const wrapped = (...args) => {
        if (timer !== null)
            window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = null;
            fn(...args);
        }, waitMs);
    };
    wrapped.cancel = () => {
        if (timer !== null)
            window.clearTimeout(timer);
        timer = null;
    };
    return wrapped;
}
//# sourceMappingURL=debounce.js.map