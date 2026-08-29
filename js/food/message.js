(function (global) {
    'use strict';

    function createMessageController(adapters) {
        adapters = adapters || {};
        var pauseCoordinator = adapters.pauseCoordinator;
        var transitionAdapter = adapters.transitionAdapter || null;
        if (!pauseCoordinator ||
            typeof pauseCoordinator.pause !== 'function' ||
            typeof pauseCoordinator.resume !== 'function') {
            throw new Error('createMessageController requires a pauseCoordinator with pause() and resume().');
        }

        function getElement(id) {
            if (typeof document === 'undefined') return null;
            return document.getElementById(id);
        }

        var overlay = adapters.overlay || (typeof document !== 'undefined' ? document.getElementById('overlay') : null);
        var getMsgIcon = adapters.getMsgIcon || function () {
            return getElement('msgIcon');
        };
        var getMsgText = adapters.getMsgText || function () {
            return getElement('msgText');
        };
        var getMsgSub = adapters.getMsgSub || function () {
            return getElement('msgSub');
        };
        var getMsgButtons = adapters.getMsgButtons || function () {
            return getElement('msgButtons');
        };
        var createElement = adapters.createElement || function (tag) {
            if (typeof document === 'undefined') return null;
            return document.createElement(tag);
        };
        var createTextNode = adapters.createTextNode || function (value) {
            if (typeof document === 'undefined') return null;
            return document.createTextNode(value);
        };

        var currentFlow = null;
        var pendingOptions = null;
        var pendingDrainQueued = false;
        var lastBackdropDismissAt = 0;

        // Instruction text wraps at commas only: each comma-separated
        // segment stays unbreakable so a line always ends with a comma.
        function appendWrappableText(target, value) {
            var text = String(value);
            if (text.indexOf('，') === -1 && text.indexOf(',') === -1) {
                target.textContent = text;
                return;
            }
            var segments = text.split(/([，,])/);
            target.textContent = '';
            segments.forEach(function (segment) {
                if (segment === '') return;
                if (createTextNode) target.appendChild(createTextNode(segment));
                if (segment === '，' || segment === ',') {
                    var breakOpportunity = createElement('wbr');
                    if (breakOpportunity) target.appendChild(breakOpportunity);
                }
            });
        }


        function render(options) {
            var icon = getMsgIcon();
            var text = getMsgText();
            var sub = getMsgSub();
            var buttonHost = getMsgButtons();

            if (icon) {
                icon.textContent = options.icon !== undefined
                    ? options.icon
                    : (options.isVictory ? '🏆' : '');
            }
            if (text) {
                if (options.titleHtml) {
                    text.innerHTML = options.title || '';
                } else {
                    appendWrappableText(text, options.title || '');
                }
                text.className = 'msg-text' +
                    (options.isVictory ? ' victory' : '') +
                    (options.extraLarge ? ' extra-large' : '') +
                    (options.textClass ? ' ' + options.textClass : '');
            }
            if (sub) {
                appendWrappableText(sub, options.subtitle || '');
                sub.classList.toggle('hidden', !options.subtitle);
            }
            if (buttonHost) {
                buttonHost.innerHTML = '';
                if (options.buttons && options.buttons.length) {
                    var group = createElement('div');
                    if (!group) return;
                    group.className = 'btn-group';
                    options.buttons.forEach(function (button) {
                        var btn = createElement('button');
                        if (!btn) return;
                        btn.className = 'btn-option ' + (button.className || button.class || 'btn-stay');
                        btn.textContent = button.text || '';
                        btn.addEventListener('click', function (e) {
                            if (e && e.stopPropagation) e.stopPropagation();
                            handleButton(button);
                        });
                        group.appendChild(btn);
                    });
                    buttonHost.appendChild(group);
                }
            }
        }

        function closeFlow(flow, runDismiss) {
            if (!flow || flow.closed) return;
            flow.closed = true;
            if (currentFlow === flow) {
                currentFlow = null;
                if (overlay) overlay.classList.remove('active');
            }
            if (flow.options.pauseTimer) {
                pauseCoordinator.resume();
            }
            if (runDismiss && !flow.consumed) {
                flow.consumed = true;
                if (typeof flow.options.onDismiss === 'function') {
                    flow.options.onDismiss();
                }
            }
        }

        function showNow(options) {
            if (currentFlow) closeFlow(currentFlow, false);
            var flow = {
                options: options || {},
                closed: false,
                consumed: false
            };
            currentFlow = flow;
            render(flow.options);
            if (overlay) overlay.classList.add('active');
            if (flow.options.pauseTimer) {
                pauseCoordinator.pause();
            }
            return flow;
        }

        function drainPendingShow() {
            pendingDrainQueued = false;
            if (pendingOptions === null) return;
            var options = pendingOptions;
            pendingOptions = null;
            showNow(options);
        }

        function show(options) {
            if (transitionAdapter &&
                typeof transitionAdapter.isTransitioning === 'function' &&
                transitionAdapter.isTransitioning() &&
                typeof transitionAdapter.afterTransition === 'function') {
                if (currentFlow) closeFlow(currentFlow, false);
                pendingOptions = options || {};
                if (!pendingDrainQueued) {
                    var queued = transitionAdapter.afterTransition(drainPendingShow);
                    if (queued) {
                        pendingDrainQueued = true;
                    } else {
                        pendingOptions = null;
                        return showNow(options);
                    }
                }
                return null;
            }
            return showNow(options);
        }

        function dismiss() {
            pendingOptions = null;
            closeFlow(currentFlow, true);
        }

        function close() {
            pendingOptions = null;
            closeFlow(currentFlow, false);
        }

        function handleButton(button) {
            var flow = currentFlow;
            if (!flow) return;
            flow.consumed = true;
            if (typeof button.action === 'function') {
                button.action();
            }
            if (currentFlow === flow) {
                closeFlow(flow, false);
            }
        }

        var api = {
            show: show,
            dismiss: dismiss,
            close: close,
            isActive: function () {
                return currentFlow !== null;
            }
        };

        if (overlay && overlay.addEventListener && adapters.attachBackdrop !== false) {
            overlay.addEventListener('click', function (e) {
                if (e.target !== overlay) return;
                var now = Date.now();
                if (now - lastBackdropDismissAt < 350) return;
                lastBackdropDismissAt = now;
                dismiss();
            });
        }

        return api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createMessageController: createMessageController
        };
    }

    if (typeof window !== 'undefined') {
        window.CognitiveMessage = createMessageController({
            pauseCoordinator: window.CognitiveActivityTimer.createPauseCoordinator(),
            transitionAdapter: window.CognitiveRouter || null
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
