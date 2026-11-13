// Browser APIs that jsdom lacks but our components (chart, toasts, image preview) use.
export function installBrowserStubs() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  URL.createObjectURL ??= () => "blob:preview";
  URL.revokeObjectURL ??= () => {};
}
