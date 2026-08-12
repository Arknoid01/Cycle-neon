/**
 * Navigation menu autonome — zéro dépendance (pas de Three.js).
 * Capte toucher/clic sur Android et déclenche lc-menu-nav pour main.js.
 */
const SCREENS = ['home', 'play', 'custom', 'trophies', 'options'];

export function menuShowScreen(id) {
  if (!SCREENS.includes(id)) return;
  for (const key of SCREENS) {
    document.getElementById(`${key}-screen`)?.classList.toggle('hidden', key !== id);
  }
  window.dispatchEvent(new CustomEvent('lc-menu-nav', { detail: { id } }));
}

function onMenuActivate(e) {
  const tile = e.target.closest?.('.menu-tile[data-screen]');
  if (tile?.dataset.screen) {
    e.preventDefault();
    e.stopPropagation();
    menuShowScreen(tile.dataset.screen);
    return;
  }
  if (e.target.closest?.('[data-back]')) {
    e.preventDefault();
    e.stopPropagation();
    menuShowScreen('home');
  }
}

export function initMenuShell() {
  const root = document.getElementById('home-menu');
  if (!root || root.dataset.shellBound === '1') return;
  root.dataset.shellBound = '1';
  root.addEventListener('pointerup', onMenuActivate, { passive: false });
  root.addEventListener('touchend', onMenuActivate, { passive: false });
  root.addEventListener('click', onMenuActivate);
}

initMenuShell();
