// Node >= 25 expose son propre localStorage expérimental, qui masque celui de jsdom.
// On réexpose le stockage de jsdom pour que les tests se comportent comme un navigateur.
declare const jsdom: { window: Window } | undefined;

if (typeof jsdom !== 'undefined') {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: jsdom.window[key],
      configurable: true,
      writable: true,
    });
  }
}
