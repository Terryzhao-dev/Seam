// Focus an element once the slide-in transition has started (avoids scroll jumps).
export function focus(node: HTMLElement) {
  const t = setTimeout(() => node.focus({ preventScroll: true }), 120);
  return { destroy: () => clearTimeout(t) };
}
