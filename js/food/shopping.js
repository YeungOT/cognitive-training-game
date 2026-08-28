(function (global) {
    'use strict';

    // =============================================================
    // 第五部分：買餸記憶遊戲 — mount + lifecycle
    // =============================================================
    //
    // Pure round logic + option tables (shopping-logic.js) and all direct DOM
    // interaction (shopping-view.js) are injected via deps. This module keeps
    // the game-flow state machine: list/order/recall phases, countdown
    // timing, scoring, navigation.

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var logic = deps.logic || (typeof global.CognitiveShoppingLogic !== 'undefined' ? global.CognitiveShoppingLogic : null);
        var view = deps.view || (typeof global.CognitiveShoppingView !== 'undefined' ? global.CognitiveShoppingView : null);
        var prefs = deps.prefs || (typeof global.CognitivePrefs !== 'undefined' ? global.CognitivePrefs : null);
        var activityTimer = deps.activityTimer || (typeof global.CognitiveActivityTimer !== 'undefined' ? global.CognitiveActivityTimer : null);
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        var syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);
        var nameVisibility = deps.nameVisibility || null;

        if (!logic || !view) return null;
        var FOOD_DATA = foodData.FOOD_DATA;
        var shuffle = foodData.shuffle;
        var getFoodId = foodData.getFoodId;
        var STANDARD_MEMORY_OPTIONS = logic.STANDARD_MEMORY_OPTIONS;
        var ORDER_MEMORY_OPTIONS = logic.ORDER_MEMORY_OPTIONS;
        var ORDER_INDICATOR_MS = 1500;

        var els = view.createShoppingEls(doc);
        var lightbulb = view.createShoppingLightbulb(els);

        var state = {
            listDisplayMode: 'image',
            listCount: 3,
            listRevealMode: 'manual',
            listSeconds: 0,
            choiceCount: 6,
            orderRequired: false,
            recallTimed: false,
            recallSeconds: 0,
            score: 0,
            round: 0,
            list: [],
            gridItems: [],
            completedNames: [],
            nextOrderIndex: 0,
            phase: 'list',
            countdown: 0,
            timerActive: false,
            orderIndex: 0,
            orderMemoryComplete: false,
            orderTransitionTimer: null,
            orderTransitionToken: 0,
            roundLocked: false,
            wrongFlashTimer: null,
            introShownOnce: false
        };

        var shoppingCountdownTimer = activityTimer ? activityTimer.create() : null;

        var shoppingPreferences = prefs ? prefs.load('cognitiveShoppingPrefs') : null;
        if (shoppingPreferences) {
            els.listDisplayMode.value = shoppingPreferences.listDisplayMode;
            els.listCount.value = String(shoppingPreferences.listCount);
            els.memoryTime.value = shoppingPreferences.memoryTime;
            els.choiceCount.value = String(shoppingPreferences.choiceCount);
            els.orderRequired.value = String(shoppingPreferences.orderRequired);
            els.recallTime.value = shoppingPreferences.recallTime;
        }

        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };

        function applyShoppingRound() {
            const result = logic.buildShoppingRound(state.listCount, state.choiceCount, FOOD_DATA, shuffle, getFoodId);
            state.list = result.list;
            state.gridItems = result.gridItems;
            state.completedNames = [];
            state.nextOrderIndex = 0;
        }

        function stopOrderTransition() {
            state.orderTransitionToken++;
            if (state.orderTransitionTimer) {
                clearTimeout(state.orderTransitionTimer);
                state.orderTransitionTimer = null;
            }
        }
        function showOrderItem(index) {
            stopShoppingTimer();
            stopOrderTransition();
            if (index >= state.list.length) {
                finishOrderMemory();
                return;
            }
            state.orderIndex = index;
            state.orderMemoryComplete = false;
            els.manualStartBtn.classList.add('hidden');
            els.orderItem.innerHTML = '';
            els.orderIndicator.textContent = String(index + 1);
            els.orderIndicator.classList.remove('active');
            void els.orderIndicator.offsetWidth;
            els.orderIndicator.classList.add('active');

            const token = ++state.orderTransitionToken;
            state.orderTransitionTimer = setTimeout(function () {
                if (token !== state.orderTransitionToken) return;
                state.orderTransitionTimer = null;
                const isLast = index === state.list.length - 1;
                view.renderShoppingOrderItem(doc, els, {
                    item: state.list[index],
                    listDisplayMode: state.listDisplayMode,
                    showNames: nameVisibility ? nameVisibility.isEnabled : false,
                    onMagnify: openMagnify
                });
                if (nameVisibility) nameVisibility.apply();
                if (state.listRevealMode === 'timer') {
                    els.timer.classList.remove('hidden');
                    startShoppingCountdown(state.listSeconds, function () {
                        showOrderItem(index + 1);
                    });
                } else {
                    els.timer.classList.add('hidden');
                    updateShoppingTimer();
                    els.manualStartBtn.textContent = isLast ? '▶ 開始揀選' : '下一張';
                    if (isLast) state.orderMemoryComplete = true;
                    els.manualStartBtn.classList.remove('hidden');
                }
            }, ORDER_INDICATOR_MS);
        }

        function finishOrderMemory() {
            state.orderMemoryComplete = true;
            stopShoppingTimer();
            stopOrderTransition();
            els.orderItem.innerHTML = '';
            els.orderIndicator.classList.remove('active');
            els.manualStartBtn.classList.add('hidden');
            els.timer.classList.add('hidden');
            if (state.listRevealMode === 'timer') {
                showShoppingRecallIntro();
            } else {
                els.manualStartBtn.textContent = '▶ 開始揀選';
                els.manualStartBtn.classList.remove('hidden');
                els.phaseText.textContent = '已記住，開始揀選';
            }
        }

        function showShoppingOrderPhase(startFlow) {
            stopShoppingTimer();
            stopOrderTransition();
            state.phase = 'order';
            state.roundLocked = false;
            state.completedNames = [];
            state.nextOrderIndex = 0;
            els.listView.classList.add('hidden');
            els.recallView.classList.add('hidden');
            els.orderView.classList.remove('hidden');
            els.manualStartBtn.classList.add('hidden');
            els.timer.classList.toggle('hidden', state.listRevealMode !== 'timer');
            els.phaseText.textContent = '按順序逐一記住圖片';
            els.progress.classList.add('hidden');
            els.orderItem.innerHTML = '';
            els.orderIndicator.classList.remove('active');
            clearShoppingFeedback();
            if (syncTopBarCentering) syncTopBarCentering();
            if (startFlow) {
                state.orderMemoryComplete = false;
                state.orderIndex = 0;
                showOrderItem(0);
            } else {
                updateShoppingTimer();
            }
        }

        function stopShoppingTimer() {
            state.timerActive = false;
            state.countdown = 0;
            if (shoppingCountdownTimer) shoppingCountdownTimer.stop();
        }

        function pauseShoppingTimer() {
            state.timerActive = false;
            state.countdown = 0;
            if (shoppingCountdownTimer) shoppingCountdownTimer.pause();
        }

        function syncShoppingSessionUi() {
            updateShoppingTimer();
        }

        function startShoppingCountdown(seconds, onExpire) {
            stopShoppingTimer();
            state.countdown = seconds;
            state.timerActive = true;
            updateShoppingTimer();
            if (!shoppingCountdownTimer) return;
            shoppingCountdownTimer.start({
                mode: 'countdown',
                durationMs: seconds * 1000,
                tickIntervalMs: 1000,
                tick: function () {
                    state.countdown = Math.max(0, state.countdown - 1);
                    updateShoppingTimer();
                },
                onComplete: function () {
                    state.timerActive = false;
                    state.countdown = 0;
                    updateShoppingTimer();
                    if (typeof onExpire === 'function') {
                        onExpire();
                    }
                },
                onPause: syncShoppingSessionUi,
                onResume: syncShoppingSessionUi
            });
        }

        function updateShoppingTimer() {
            view.setTimer(els.timer, state.phase, state.timerActive, state.countdown);
        }
        function showShoppingListPhase(startTimer, renderList) {
            if (startTimer === undefined) startTimer = true;
            if (renderList === undefined) renderList = true;
            stopShoppingTimer();
            stopOrderTransition();
            state.phase = 'list';
            state.roundLocked = false;
            state.completedNames = [];
            state.nextOrderIndex = 0;
            els.listView.classList.remove('hidden');
            els.recallView.classList.add('hidden');
            els.orderView.classList.add('hidden');
            els.orderItem.innerHTML = '';
            els.orderIndicator.classList.remove('active');
            els.manualStartBtn.textContent = '▶ 開始揀選';
            els.manualStartBtn.classList.toggle('hidden', state.listRevealMode !== 'manual');
            els.timer.classList.toggle('hidden', state.listRevealMode !== 'timer');
            els.phaseText.textContent = `📋 購物清單（${state.list.length} 樣）`;
            els.progress.classList.add('hidden');
            if (renderList) {
                view.renderShoppingList(doc, els, {
                    list: state.list,
                    listDisplayMode: state.listDisplayMode,
                    showNames: nameVisibility ? nameVisibility.isEnabled : false,
                    onMagnify: openMagnify
                });
            } else {
                els.listGrid.innerHTML = '';
            }
            view.setProgress(els.progress, state.completedNames.length, state.list.length);
            clearShoppingFeedback();
            if (syncTopBarCentering) syncTopBarCentering();
            if (state.listRevealMode === 'timer') {
                if (startTimer) {
                    startShoppingCountdown(state.listSeconds, function () {
                        showShoppingRecallIntro();
                    });
                } else {
                    updateShoppingTimer();
                }
            } else {
                updateShoppingTimer();
            }
        }

        function beginShoppingListPhase() {
            const renderBeforeIntro = state.introShownOnce;
            state.introShownOnce = true;
            let title;
            let onDismiss;
            if (state.orderRequired) {
                showShoppingOrderPhase(false);
                onDismiss = function () { showShoppingOrderPhase(true); };
                title = '按順序逐一記住圖片';
            } else {
                showShoppingListPhase(false, renderBeforeIntro);
                onDismiss = function () { showShoppingListPhase(true); };
                const timed = state.listRevealMode === 'timer';
                title = timed
                    ? `記住清單，${state.listSeconds} 秒後開始揀選`
                    : '記住清單準備好後按<br><span class="start-hint">「開始揀選」</span>';
            }
            view.showBeginIntro(message, title, onDismiss);
        }

        function showShoppingRecallIntro() {
            view.showRecallIntro(message, startShoppingRecall);
        }

        function startShoppingRecall() {
            stopShoppingTimer();
            stopOrderTransition();
            state.phase = 'recall';
            els.listView.classList.add('hidden');
            els.orderView.classList.add('hidden');
            els.recallView.classList.remove('hidden');
            els.orderItem.innerHTML = '';
            els.orderIndicator.classList.remove('active');
            els.manualStartBtn.classList.add('hidden');
            els.timer.classList.toggle('hidden', !state.recallTimed);
            els.phaseText.textContent = '揀選清單中的食物';
            els.progress.classList.remove('hidden');
            view.renderShoppingRecallGrid(doc, els, {
                gridItems: state.gridItems,
                list: state.list,
                orderRequired: state.orderRequired,
                completedNames: state.completedNames,
                getFoodId: getFoodId,
                onCardClick: handleShoppingCardClick,
                onMagnify: openMagnify
            });
            if (nameVisibility) nameVisibility.apply();
            view.setProgress(els.progress, state.completedNames.length, state.list.length);
            clearShoppingFeedback();
            if (syncTopBarCentering) syncTopBarCentering();
            if (state.recallTimed) {
                startShoppingCountdown(state.recallSeconds, handleShoppingRecallTimeout);
            } else {
                updateShoppingTimer();
            }
        }

        function handleShoppingRecallTimeout() {
            if (state.roundLocked) return;
            state.roundLocked = true;
            audio.play('wrong');
            showShoppingFeedback('⏰ 時間到！再看一次清單', 'warn');
            setTimeout(function () {
                view.showTimeout(message, beginShoppingListPhase);
            }, 400);
        }
        function handleShoppingCardClick(index) {
            if (state.phase !== 'recall' || state.roundLocked) return;
            const item = state.gridItems[index];
            const card = els.recallGrid.children[index];
            if (!item || !card) return;
            if (state.completedNames.includes(getFoodId(item))) return;

            const isExpectedNext = state.orderRequired
                ? state.list[state.nextOrderIndex] &&
                  getFoodId(item) === getFoodId(state.list[state.nextOrderIndex])
                : item.isTarget;

            if (item.isTarget && isExpectedNext) {
                state.completedNames.push(getFoodId(item));
                if (state.orderRequired) state.nextOrderIndex++;
                state.score++;
                view.setScore(els.scoreNum, state.score);
                const orderNumber = state.list.findIndex(listItem => getFoodId(listItem) === getFoodId(item)) + 1;
                const badge = card.querySelector('.shopping-selected-badge');
                if (badge) {
                    badge.textContent = state.orderRequired ? String(orderNumber) : '✓';
                    badge.classList.add('visible');
                }
                card.classList.add('selected', 'feedback-correct');
                audio.play('correct');
                showShoppingFeedback('✅ 正確！', 'correct');
                view.setProgress(els.progress, state.completedNames.length, state.list.length);
                if (state.completedNames.length >= state.list.length) {
                    completeShoppingRound();
                }
            } else {
                audio.play('wrong');
                showShoppingFeedback('❌ 再試一次！', 'wrong');
                card.classList.add('feedback-wrong');
                state.wrongFlashTimer = setTimeout(function () {
                    card.classList.remove('feedback-wrong');
                }, 600);
            }
        }

        function completeShoppingRound() {
            if (state.roundLocked) return;
            state.roundLocked = true;
            stopShoppingTimer();
            view.setProgress(els.progress, state.completedNames.length, state.list.length);
            els.recallGrid.querySelectorAll('.shopping-recall-card').forEach(card => {
                if (!card.classList.contains('selected')) card.classList.add('dimmed');
            });
            audio.play('correct');
            view.showComplete(message, state.list.length, state.score, startShoppingRound);
        }

        function startShoppingRound() {
            state.round++;
            applyShoppingRound();
            beginShoppingListPhase();
        }

        function startShoppingSession() {
            pauseShopping();
            state.listDisplayMode = els.listDisplayMode.value;
            state.listCount = parseInt(els.listCount.value, 10);
            const memoryTimeValue = els.memoryTime.value;
            state.listRevealMode = memoryTimeValue === 'manual' ? 'manual' : 'timer';
            state.listSeconds = memoryTimeValue === 'manual' ? 0 : parseInt(memoryTimeValue, 10);
            state.choiceCount = Math.max(parseInt(els.choiceCount.value, 10), state.listCount);
            state.orderRequired = els.orderRequired.value === 'true';
            const recallTimeValue = els.recallTime.value;
            state.recallTimed = recallTimeValue !== '0';
            state.recallSeconds = recallTimeValue === '0' ? 0 : parseInt(recallTimeValue, 10);
            state.choiceCount = Math.max(
                state.choiceCount,
                state.listCount <= 4 ? 4 : 6
            );
            state.choiceCount = Math.min(state.choiceCount, 8);
            els.choiceCount.value = String(state.choiceCount);
            state.score = 0;
            state.round = 0;
            view.setScore(els.scoreNum, state.score);
            applyShoppingRound();
            beginShoppingListPhase();
        }

        function clearShoppingFeedback() {
            if (state.wrongFlashTimer) {
                clearTimeout(state.wrongFlashTimer);
                state.wrongFlashTimer = null;
            }
            view.clearFeedback(feedback, els.stage);
            els.recallGrid.querySelectorAll('.shopping-recall-card.feedback-wrong').forEach(el => el.classList.remove('feedback-wrong'));
        }

        function showShoppingFeedback(text, kind) {
            view.showFeedback(feedback, els.stage, text, kind);
        }

        function pauseShopping() {
            pauseShoppingTimer();
            stopOrderTransition();
            clearShoppingFeedback();
            if (message) message.close();
            state.orderIndex = 0;
            state.orderMemoryComplete = false;
            els.orderItem.innerHTML = '';
            els.orderIndicator.classList.remove('active');
            els.orderView.classList.add('hidden');
            state.roundLocked = false;
        }

        function resetShopping() {
            stopShoppingTimer();
            stopOrderTransition();
            if (state.wrongFlashTimer) {
                clearTimeout(state.wrongFlashTimer);
                state.wrongFlashTimer = null;
            }
            state.score = 0;
            state.round = 0;
            state.list = [];
            state.gridItems = [];
            state.completedNames = [];
            state.nextOrderIndex = 0;
            state.phase = 'list';
            state.roundLocked = false;
            state.introShownOnce = false;
            view.setScore(els.scoreNum, state.score);
            view.setProgress(els.progress, state.completedNames.length, state.list.length);
            clearShoppingFeedback();
        }

        function destroyShopping() {
            stopShoppingTimer();
            stopOrderTransition();
            if (state.wrongFlashTimer) clearTimeout(state.wrongFlashTimer);
            try { controller.abort(); } catch (e) { /* already aborted */ }
        }
        view.bindShoppingControls(els, listenOpts, {
            onOrderRequiredChange: function () { view.updateMemoryOptions(els, STANDARD_MEMORY_OPTIONS, ORDER_MEMORY_OPTIONS, lightbulb, true); },
            onMemoryTimeClick: function () { lightbulb.hide(); },
            onMemoryTimeChange: function () { lightbulb.hide(); },
            onSaveSettings: function () {
                const prefsObj = {
                    listDisplayMode: els.listDisplayMode.value,
                    listCount: parseInt(els.listCount.value, 10),
                    memoryTime: els.memoryTime.value,
                    choiceCount: parseInt(els.choiceCount.value, 10),
                    orderRequired: els.orderRequired.value === 'true',
                    recallTime: els.recallTime.value
                };
                if (prefs) {
                    prefs.save('cognitiveShoppingPrefs', prefsObj);
                }
                view.showSaved(message);
            },
            onManualStart: function () {
                if (state.phase === 'list') {
                    startShoppingRecall();
                    return;
                }
                if (state.phase === 'order') {
                    if (state.orderMemoryComplete) {
                        startShoppingRecall();
                        return;
                    }
                    showOrderItem(state.orderIndex + 1);
                }
            },
            onNameToggle: function (btn) {
                if (nameVisibility) {
                    nameVisibility.toggle();
                    btn.classList.toggle('name-hidden', !nameVisibility.isEnabled);
                }
            },
            onStart: function () {
                if (router) {
                    if (router.navigate('shoppingGame')) {
                        if (syncTopBarCentering) syncTopBarCentering();
                        startShoppingSession();
                    }
                } else {
                    els.settings.classList.add('hidden');
                    els.game.style.display = 'flex';
                    if (syncTopBarCentering) syncTopBarCentering();
                    startShoppingSession();
                }
            },
            onBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    els.game.style.display = 'none';
                    els.settings.classList.remove('hidden');
                    pauseShopping();
                }
            },
            onSettingsBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    els.settings.classList.add('hidden');
                    pauseShopping();
                    if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
                }
            }
        });

        view.updateMemoryOptions(els, STANDARD_MEMORY_OPTIONS, ORDER_MEMORY_OPTIONS, lightbulb, !!(els.orderRequired && els.orderRequired.value === 'true'));
        els.scoreNum.textContent = '0';
        els.progress.textContent = '已揀選 0 / 3';
        els.timer.textContent = '--';

        if (router) {
            router.defineScreen('shoppingSettings', {
                exit: pauseShopping,
                back: 'mainMenu'
            });
            router.defineScreen('shoppingGame', {
                exit: pauseShopping,
                back: 'shoppingSettings'
            });
        }

        return {
            start: startShoppingSession,
            pause: pauseShopping,
            reset: resetShopping,
            destroy: destroyShopping
        };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined' && window.CognitiveGames) {
        window.CognitiveShopping = api;
        window.CognitiveGames.register({
            id: 'shopping',
            title: '買餸',
            icon: '🛒',
            entryRoute: 'shoppingSettings',
            buttonId: 'gameShoppingBtn',
            menuOrder: 4,
            setup: function () {
                return api.mount(document, {
                    foodData: window.CognitiveFoodData,
                    logic: window.CognitiveShoppingLogic,
                    view: window.CognitiveShoppingView,
                    prefs: window.CognitivePrefs,
                    activityTimer: window.CognitiveActivityTimer,
                    message: window.CognitiveMessage,
                    feedback: window.CognitiveFeedback,
                    router: window.CognitiveRouter,
                    audio: window.CognitiveAudio,
                    openMagnify: window.openMagnify,
                    syncTopBarCentering: window.syncTopBarCentering,
                    nameVisibility: window.CognitiveNameVisibility ? window.CognitiveNameVisibility.shared : null
                });
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
