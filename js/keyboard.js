(function (global) {
    'use strict';

    // Minimal keyboard support for desktop use.
    //   - Esc is modal-first: message box -> slide menu -> magnify -> back.
    //   - Screens register small keymaps (J/K, P, -/=, Space) via registerScreen().
    //   - Keys are ignored while a message box is open (modal flow) or when
    //     focus is in an input/select.
    // The pure helpers (normalizeKey, resolveGlobalAction, isTypingTarget) are
    // exported for unit tests.

    var documentRef = global.document || null;

    // ------------------------------------------------------------------
    // Pure helpers (unit-testable)
    // ------------------------------------------------------------------

    function normalizeKey(key) {
        if (typeof key !== 'string' || key.length === 0) return '';
        var lower = key.toLowerCase();
        var named = {
            ' ': 'space',
            escape: 'escape',
            enter: 'enter',
            arrowleft: 'arrowleft',
            arrowright: 'arrowright',
            arrowup: 'arrowup',
            arrowdown: 'arrowdown'
        };
        if (named[lower]) return named[lower];
        if (lower.length === 1 && lower >= 'a' && lower <= 'z') return lower;
        return lower;
    }

    function isTypingTarget(el) {
        if (!el || typeof el.matches !== 'function') return false;
        return el.matches('input, textarea, select, [contenteditable="true"]');
    }

    // Which Esc action applies, given what is open. Message box wins, then
    // slide menu, then magnify overlay, then plain back.
    function resolveGlobalAction(key, state) {
        state = state || {};
        if (key !== 'escape') return null;
        if (state.messageOpen) return 'dismiss-message';
        if (state.menuOpen) return 'close-menu';
        if (state.magnifyOpen) return 'close-magnify';
        return 'back';
    }

    // ------------------------------------------------------------------
    // Registry
    // ------------------------------------------------------------------

    var screens = {}; // screenId -> { keys: { keyName: handler } }

    function registerScreen(id, handlers) {
        if (!screens[id]) screens[id] = { keys: {} };
        var target = screens[id].keys;
        Object.keys(handlers || {}).forEach(function (keyName) {
            var normalized = normalizeKey(keyName);
            if (normalized && typeof handlers[keyName] === 'function') {
                target[normalized] = handlers[keyName];
            }
        });
    }

    // ------------------------------------------------------------------
    // Dispatcher
    // ------------------------------------------------------------------

    function getActiveScreen() {
        if (global.CognitiveRouter &&
            typeof global.CognitiveRouter.getCurrent === 'function') {
            return global.CognitiveRouter.getCurrent();
        }
        return null;
    }

    function isMessageOpen() {
        return !!(global.CognitiveMessage &&
            typeof global.CognitiveMessage.isActive === 'function' &&
            global.CognitiveMessage.isActive());
    }

    function isMenuOpen() {
        return !!(global.CognitiveMenu &&
            typeof global.CognitiveMenu.isOpen === 'function' &&
            global.CognitiveMenu.isOpen());
    }

    function isMagnifyOpen() {
        if (!documentRef || !documentRef.getElementById) return false;
        var el = documentRef.getElementById('magnifyOverlay');
        return !!(el && el.classList && el.classList.contains('active'));
    }

    function closeMagnify() {
        if (!documentRef || !documentRef.getElementById) return;
        var el = documentRef.getElementById('magnifyOverlay');
        if (el) el.classList.remove('active');
    }

    function handleKeydown(event) {
        if (!event || event.defaultPrevented) return;
        var target = event.target || (documentRef && documentRef.body);
        if (isTypingTarget(target)) return;

        var key = normalizeKey(event.key || '');
        if (key === '') return;

        if (key === 'escape') {
            var action = resolveGlobalAction(key, {
                messageOpen: isMessageOpen(),
                menuOpen: isMenuOpen(),
                magnifyOpen: isMagnifyOpen()
            });
            if (action === 'dismiss-message') {
                event.preventDefault();
                if (global.CognitiveMessage &&
                    typeof global.CognitiveMessage.dismiss === 'function') {
                    global.CognitiveMessage.dismiss();
                }
                return;
            }
            if (action === 'close-menu') {
                event.preventDefault();
                if (global.CognitiveMenu &&
                    typeof global.CognitiveMenu.close === 'function') {
                    global.CognitiveMenu.close();
                }
                return;
            }
            if (action === 'close-magnify') {
                event.preventDefault();
                closeMagnify();
                return;
            }
            if (action === 'back') {
                event.preventDefault();
                if (global.CognitiveRouter &&
                    typeof global.CognitiveRouter.goBack === 'function') {
                    global.CognitiveRouter.goBack();
                }
                return;
            }
        }

        // Modal flow: while a message box is open, only Esc acts.
        if (isMessageOpen()) return;

        var screen = getActiveScreen();
        if (!screen) return;

        var keymap = screens[screen] && screens[screen].keys;
        if (keymap && typeof keymap[key] === 'function') {
            keymap[key](event);
            // Space would otherwise scroll the page or activate a focused
            // button; keep it for the game's "next image" action only.
            if (key === 'space') event.preventDefault();
            return;
        }
    }

    // ------------------------------------------------------------------
    // Help box
    // ------------------------------------------------------------------

    function getHelpHtml() {
        var line = function (keys, text) {
            return '<div class="help-line"><span class="help-key">' + keys +
                '</span> ' + text + '</div>';
        };
        return '<div class="help-heading">⌨️ 鍵盤操作</div>' +
            line('J / K', '— 按左 / 右按鈕（如：相同 / 不相同、Go / No-Go）') +
            line('Space', '— 下一張') +
            line('P', '— 開始 / 暫停') +
            line('- / =', '— 調節速度') +
            line('Esc', '— 返回');
    }

    function showHelp() {
        if (!global.CognitiveMessage ||
            typeof global.CognitiveMessage.show !== 'function') return;
        global.CognitiveMessage.show({
            title: getHelpHtml(),
            titleHtml: true,
            textClass: 'help-list',
            subtitle: '',
            pauseTimer: false,
            buttons: [{ text: '知道了', className: 'btn-stay' }]
        });
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------

    function start() {
        if (documentRef && typeof documentRef.addEventListener === 'function') {
            documentRef.addEventListener('keydown', handleKeydown);
        }
    }

    var api = {
        normalizeKey: normalizeKey,
        isTypingTarget: isTypingTarget,
        resolveGlobalAction: resolveGlobalAction,
        registerScreen: registerScreen,
        start: start,
        showHelp: showHelp
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof global !== 'undefined') {
        global.CognitiveKeyboard = api;
    }

    // Attach the dispatcher when running in a browser. In Node (unit tests)
    // documentRef is null, so this is a no-op.
    start();
})(typeof window !== 'undefined' ? window : globalThis);
