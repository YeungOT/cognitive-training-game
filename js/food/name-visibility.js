(function (global) {
    'use strict';

    // Session-only (never persisted) visibility of food/shopping item names.
    // Owns the boolean and the DOM application to the shared roots so the food
    // and shopping games can share it without a bare mutable global.
    //
    // Refinement of D011: there are two toggle buttons (food + shopping), each
    // managed by its own game; this module owns only the shared roots + badges.

    function createNameVisibility(els) {
        els = els || {};
        var state = { isEnabled: true };

        function apply() {
            var on = state.isEnabled;
            if (els.foodRoot) els.foodRoot.classList.toggle('hide-names', !on);
            if (els.shoppingRoot) els.shoppingRoot.classList.toggle('hide-names', !on);
            if (els.magnifyName) els.magnifyName.style.opacity = on ? '1' : '0';
            if (els.foodBadge) els.foodBadge.classList.toggle('on', on);
            if (els.shoppingBadge) els.shoppingBadge.classList.toggle('on', on);
        }

        function set(value) {
            state.isEnabled = !!value;
        }

        function toggle() {
            state.isEnabled = !state.isEnabled;
            apply();
        }

        return {
            get isEnabled() { return state.isEnabled; },
            set: set,
            toggle: toggle,
            apply: apply
        };
    }

    var api = { createNameVisibility: createNameVisibility };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    // Shared singleton: one NameVisibility instance owns the session-only
    // show/hide-names state across the food and shopping games. Created at
    // load (DOM is ready) and exposed as CognitiveNameVisibility.shared so
    // each game's mount consumes the same instance via deps instead of via
    // bare-global aliases. Initial apply() sets the badge/opacity/roots to
    // the default (names visible) - matches the original load-time call.
    if (typeof window !== 'undefined') {
        var shared = createNameVisibility({
            foodRoot: window.document.getElementById('foodGame'),
            shoppingRoot: window.document.getElementById('shoppingGame'),
            magnifyName: window.document.getElementById('magnifyName'),
            foodBadge: window.document.getElementById('nameBadge'),
            shoppingBadge: window.document.getElementById('shoppingNameBadge')
        });
        api.shared = shared;
        window.CognitiveNameVisibility = api;
        shared.apply();
    }
})(typeof window !== 'undefined' ? window : globalThis);
