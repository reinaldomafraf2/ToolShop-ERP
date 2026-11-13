const FOCUS_ESTOQUE_ITEM_KEY = 'toolshop_estoque_focus_item_id';

export function navigateToEstoqueItem(itemEstoqueId: string): void {
  if (!itemEstoqueId) return;
  try {
    sessionStorage.setItem(FOCUS_ESTOQUE_ITEM_KEY, itemEstoqueId);
  } catch {
    // ignore storage quota errors
  }
  if (window.location.hash === '#estoque') {
    window.dispatchEvent(new CustomEvent('toolshop:focus-estoque-item', { detail: { itemId: itemEstoqueId } }));
  } else {
    window.location.hash = 'estoque';
  }
}

export function consumeFocusEstoqueItem(): string | null {
  try {
    const id = sessionStorage.getItem(FOCUS_ESTOQUE_ITEM_KEY);
    if (id) {
      sessionStorage.removeItem(FOCUS_ESTOQUE_ITEM_KEY);
      return id;
    }
  } catch {
    // ignore
  }
  return null;
}
