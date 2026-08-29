(function (global) {
    'use strict';

    function mount(root, deps) {
        deps = deps || {};
        const doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;
        const foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        const logic = deps.logic || (typeof global.CognitivePairsLogic !== 'undefined' ? global.CognitivePairsLogic : null);
        const view = deps.view || (typeof global.CognitivePairsView !== 'undefined' ? global.CognitivePairsView : null);
        const settings = deps.settings || (typeof global.CognitivePairsSettings !== 'undefined' ? global.CognitivePairsSettings : null);
        const gameScreen = deps.gameScreen || (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
        const feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        if (!foodData || !logic || !view || !settings || !gameScreen || !feedback) return null;
        const router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        const prefs = deps.prefs || (typeof global.CognitivePrefs !== 'undefined' ? global.CognitivePrefs : null);
        const message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        const audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        const hideOverlay = deps.hideOverlay || (typeof global.hideOverlay === 'function' ? global.hideOverlay : null);
        const syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);

        const screen = gameScreen.createGameScreen(doc, {
            gameRoot: doc.getElementById('pairsGame'),
            settingsRoot: doc.getElementById('pairsSettings'),
            ...settings.createPairsScreenDefinition()
        });

        const els = screen.els;
        els.gridWrapper = els.pairsGridWrapper;
        els.gridContainer = els.pairsGridContainer;
        els.scoreNum = els.pairsScoreNum;
        els.roundInfo = els.pairsRoundInfo;
        els.backBtn = els.pairsBackBtn;
        els.settingsBackBtn = els.pairsSettingsBackBtn;
        els.pairCountSelect = els.pairsCountSelect;
        els.previewTimeSelect = els.pairsPreviewTimeSelect;
        els.startBtn = els.pairsStartBtn;
        if (!els.pairsGame || !els.pairsGridWrapper || !els.pairsGridContainer || !els.pairsScoreNum ||
            !els.pairsRoundInfo || !els.pairsBackBtn || !els.pairsSettingsBackBtn ||
            !els.pairsCountSelect || !els.pairsPreviewTimeSelect || !els.pairsStartBtn) return null;

        const preferences = settings.loadPairsPreferences(prefs);
        if (els.pairsCountSelect) els.pairsCountSelect.value = String(preferences.pairCount);
        if (els.pairsPreviewTimeSelect) els.pairsPreviewTimeSelect.value = preferences.previewTime;

        const state = {
            pairCount: preferences.pairCount,
            previewTime: preferences.previewTime,
            score: 0,
            round: 1,
            cards: [],
            flippedIndexes: [],
            matchedPairs: 0,
            isChecking: false,
            isPreviewing: false,
            previewTimer: null,
            wrongTimer: null,
            advanceTimer: null
        };

        const controller = new AbortController();
        const listenOpts = { signal: controller.signal };

        function clearTimer(timerName) {
            if (!state[timerName]) return;
            clearTimeout(state[timerName]);
            state[timerName] = null;
        }

        function clearPreviewTimer() { clearTimer('previewTimer'); }
        function clearWrongTimer() { clearTimer('wrongTimer'); }
        function clearAdvanceTimer() { clearTimer('advanceTimer'); }

        function endPreview() {
            clearPreviewTimer();
            if (!state.isPreviewing) return;
            state.isPreviewing = false;
            els.pairsGridContainer.classList.remove('is-preview');
            if (message && typeof message.close === 'function' && typeof message.isActive === 'function' && message.isActive()) {
                message.close();
            }
        }

        function startPreview() {
            clearPreviewTimer();
            state.isPreviewing = true;
            els.pairsGridContainer.classList.add('is-preview');
            if (message && typeof message.show === 'function') {
                message.show({
                    title: '👀 記住卡片位置',
                    extraLarge: true,
                    pauseTimer: false
                });
            }
            if (state.previewTime !== 'manual') {
                const seconds = parseInt(state.previewTime, 10);
                state.previewTimer = setTimeout(endPreview, seconds * 1000);
            }
        }

        els.pairsGridWrapper.addEventListener('click', function (event) {
            if (!state.isPreviewing) return;
            if (message && typeof message.isActive === 'function' && message.isActive()) return;
            event.preventDefault();
            event.stopPropagation();
            endPreview();
        }, { capture: true, signal: controller.signal });
        function updateHud() {
            els.pairsScoreNum.textContent = String(state.score);
            els.pairsRoundInfo.textContent = '第 ' + state.round + ' 局';
        }

        function setCardClass(index, className, enabled) {
            view.setCardClass(els.pairsGridContainer, index, className, enabled);
        }

        function clearSelection() {
            view.clearCardSelection(els.pairsGridContainer, state.flippedIndexes);
            state.flippedIndexes = [];
        }

        function handleCardClick(index) {
            if (state.isPreviewing || state.isChecking || !state.cards[index]) return;
            if (state.flippedIndexes.indexOf(index) !== -1) return;
            const card = els.pairsGridContainer.querySelector(`.memory-card[data-index="${index}"]`);
            if (!card || card.classList.contains('is-matched')) return;

            setCardClass(index, 'is-flipped', true);
            state.flippedIndexes.push(index);
            if (state.flippedIndexes.length < 2) return;

            const [firstIndex, secondIndex] = state.flippedIndexes;
            const isMatch = state.cards[firstIndex].pairId === state.cards[secondIndex].pairId;

            if (!isMatch) {
                state.isChecking = true;
                setCardClass(firstIndex, 'is-wrong', true);
                setCardClass(secondIndex, 'is-wrong', true);
                if (audio && typeof audio.play === 'function') audio.play('wrong');
                feedback.show(els.pairsGridWrapper, '❌ 再試一次！', 'wrong');
                clearWrongTimer();
                state.wrongTimer = setTimeout(function () {
                    clearSelection();
                    state.isChecking = false;
                }, 900);
                return;
            }

            [firstIndex, secondIndex].forEach(function (cardIndex) {
                setCardClass(cardIndex, 'is-matched', true);
                setCardClass(cardIndex, 'disabled', true);
            });
            state.flippedIndexes = [];
            state.matchedPairs += 1;
            state.score += 1;
            updateHud();
            if (audio && typeof audio.play === 'function') audio.play('correct');
            feedback.show(els.pairsGridWrapper, '✅ 正確！', 'correct');

            if (state.matchedPairs === state.pairCount) {
                clearAdvanceTimer();
                state.advanceTimer = setTimeout(nextRound, 900);
            }
        }

        function generateRound() {
            clearWrongTimer();
            clearAdvanceTimer();
            clearPreviewTimer();
            state.isPreviewing = false;
            els.pairsGridContainer.classList.remove('is-preview');
            feedback.clear(els.pairsGridWrapper);
            const round = logic.buildMemoryPairsRound(
                state.pairCount,
                foodData.FOOD_DATA,
                foodData.shuffle,
                foodData.getFoodId
            );
            state.cards = round.cards;
            state.flippedIndexes = [];
            state.matchedPairs = 0;
            state.isChecking = false;
            view.renderMemoryPairsGrid(doc, els.pairsGridContainer, state.cards, state.pairCount, {
                onCardClick: handleCardClick
            });
            updateHud();
        }

        function nextRound() {
            if (hideOverlay) hideOverlay();
            state.round += 1;
            generateRound();
            startPreview();
        }

        function pause() {
            endPreview();
            clearWrongTimer();
            clearAdvanceTimer();
            feedback.clear(els.pairsGridWrapper);
            clearSelection();
            state.isChecking = false;
        }

        function reset() {
            clearPreviewTimer();
            state.isPreviewing = false;
            els.pairsGridContainer.classList.remove('is-preview');
            clearWrongTimer();
            clearAdvanceTimer();
            state.score = 0;
            state.round = 1;
            state.cards = [];
            state.flippedIndexes = [];
            state.matchedPairs = 0;
            state.isChecking = false;
            updateHud();
            feedback.clear(els.pairsGridWrapper);
        }

        function prepare() {
            pause();
            reset();
            generateRound();
            startPreview();
            if (syncTopBarCentering) syncTopBarCentering();
        }

        function destroy() {
            clearPreviewTimer();
            clearWrongTimer();
            clearAdvanceTimer();
            try { controller.abort(); } catch (error) { /* already aborted */ }
        }

        settings.bindPairsControls(els, listenOpts, {
            onSettingsBack: function () { if (router) router.goBack(); },
            onStart: function () { if (router) router.navigate('pairsGame'); },
            onGameBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    els.pairsGame.style.display = 'none';
                    pause();
                    if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
                }
            },
            onPairCountChange: function (count) { state.pairCount = count; },
            onPreviewTimeChange: function (value) { state.previewTime = value; }
        });

        updateHud();

        if (router) {
            router.defineScreen('pairsSettings', { back: 'mainMenu' });
            router.defineScreen('pairsGame', {
                enter: prepare,
                exit: pause,
                back: 'pairsSettings'
            });
        }

        return { start: prepare, pause: pause, reset: reset, destroy: destroy };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitivePairs = api;
        window.CognitiveGames.register({
            id: 'pairs',
            title: '配對記憶',
            icon: '🃏',
            entryRoute: 'pairsSettings',
            buttonId: 'gamePairsBtn',
            menuOrder: 5,
            setup: function () {
                return api.mount(document, {
                    foodData: window.CognitiveFoodData,
                    logic: window.CognitivePairsLogic,
                    view: window.CognitivePairsView,
                    settings: window.CognitivePairsSettings,
                    gameScreen: window.CognitiveGameScreen,
                    prefs: window.CognitivePrefs,
                    message: window.CognitiveMessage,
                    feedback: window.CognitiveFeedback,
                    router: window.CognitiveRouter,
                    audio: window.CognitiveAudio,
                    hideOverlay: window.hideOverlay,
                    syncTopBarCentering: window.syncTopBarCentering
                });
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);

