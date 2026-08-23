(function (global) {
    'use strict';

    // =============================================================
    // 找不同遊戲
    // =============================================================
    //
    // Pure, DOM-free helpers are declared at module scope so they can be
    // unit-tested directly. The impure game lifecycle (DOM, timers, events)
    // lives in mount(root, deps), which the browser invokes once on load.

    function buildDifferentRound(imageCount, foodData, categoryNames, shuffle, pickRandom) {
        var count = imageCount;
        for (var attempt = 0; attempt < 50; attempt++) {
            var commonCategory = pickRandom(categoryNames);
            var oddCandidates = categoryNames.filter(cat => cat !== commonCategory);
            var oddCategory = pickRandom(oddCandidates);
            var commonPool = shuffle(foodData.filter(item => item.category === commonCategory));
            var oddPool = shuffle(foodData.filter(item => item.category === oddCategory));
            var commonItems = [];
            var usedNames = new Set();

            for (const item of commonPool) {
                if (commonItems.length >= count - 1) break;
                if (usedNames.has(item.name)) continue;
                commonItems.push(item);
                usedNames.add(item.name);
            }
            if (commonItems.length !== count - 1) continue;

            const oddItem = oddPool.find(item => !usedNames.has(item.name));
            if (!oddItem) continue;

            const items = shuffle([
                ...commonItems.map(item => ({ ...item, isCorrect: false })),
                { ...oddItem, isCorrect: true }
            ]);
            return { items: items, oddItem: oddItem };
        }

        const allFoods = shuffle(foodData);
        const items = allFoods.slice(0, count).map((item, index) => ({
            ...item,
            isCorrect: index === 0
        }));
        return { items: items, oddItem: items[0] };
    }

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var FOOD_DATA = foodData.FOOD_DATA;
        var CATEGORY_NAMES = foodData.CATEGORY_NAMES;
        var shuffle = foodData.shuffle;
        var pickRandom = foodData.pickRandom;

        var prefs = deps.prefs || (typeof global.CognitivePrefs !== 'undefined' ? global.CognitivePrefs : null);
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        var hideOverlay = deps.hideOverlay || (typeof global.hideOverlay === 'function' ? global.hideOverlay : null);
        var syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);
        var view = deps.view || (typeof global.CognitiveDifferentView !== 'undefined' ? global.CognitiveDifferentView : null);
        if (!view) return null;

        var $ = function (id) { return doc.getElementById(id); };
        var els = {
            game: $('differentGame'),
            gridWrapper: $('differentGridWrapper'),
            gridContainer: $('differentGridContainer'),
            scoreNum: $('differentScoreNum'),
            roundInfo: $('differentRoundInfo'),
            backBtn: $('differentBackBtn'),
            countSelect: $('differentCountSelect')
        };

        var state = {
            imageCount: 4,
            score: 0,
            round: 0,
            items: [],
            oddItem: null,
            isAnswered: false,
            isWaitingForNext: false,
            wrongFlashTimer: null,
            advanceTimer: null
        };

        var differentPreferences = prefs ? prefs.load('cognitiveDifferentPrefs') : null;
        if (differentPreferences) {
            state.imageCount = differentPreferences.imageCount;
            els.countSelect.value = String(state.imageCount);
        }

        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };


        function handleDifferentCardClick(index) {
            if (state.isAnswered || state.isWaitingForNext) return;
            const item = state.items[index];
            const card = els.gridContainer.querySelector(`.different-card[data-index="${index}"]`);
            if (!item || !card) return;

            if (item.isCorrect) {
                state.isAnswered = true;
                state.isWaitingForNext = true;
                state.score++;
                updateDifferentScore();
                card.classList.add('feedback-correct');
                Array.from(els.gridContainer.querySelectorAll('.different-card')).forEach(child => child.classList.add('disabled'));
                audio.play('correct');
                feedback.show(els.gridWrapper, '✅ 正確！', 'correct');
                clearTimeout(state.advanceTimer);
                state.advanceTimer = setTimeout(nextDifferentRound, 650);
            } else {
                audio.play('wrong');
                card.classList.add('feedback-wrong');
                feedback.show(els.gridWrapper, '❌ 再試一次！', 'wrong');
                clearTimeout(state.wrongFlashTimer);
                state.wrongFlashTimer = setTimeout(function () {
                    card.classList.remove('feedback-wrong');
                }, 600);
            }
        }

        function updateDifferentScore() {
            els.scoreNum.textContent = state.score;
        }

        function updateDifferentRound() {
            els.roundInfo.textContent = `第 ${state.round} 題`;
        }

        function nextDifferentRound() {
            if (hideOverlay) hideOverlay();
            state.round++;
            generateDifferentRound();
        }

        function generateDifferentRound() {
            const result = buildDifferentRound(state.imageCount, FOOD_DATA, CATEGORY_NAMES, shuffle, pickRandom);
            state.oddItem = result.oddItem;
            state.items = result.items;
            view.renderDifferentGrid(doc, els.gridContainer, state.items, {
                onCardClick: handleDifferentCardClick,
                onMagnify: openMagnify
            });
            updateDifferentRound();
            state.isAnswered = false;
            state.isWaitingForNext = false;
        }

        function pauseDifferent() {
            clearTimeout(state.wrongFlashTimer);
            clearTimeout(state.advanceTimer);
            feedback.clear(els.gridWrapper);
            state.isAnswered = false;
            state.isWaitingForNext = false;
        }

        function resetDifferent() {
            clearTimeout(state.wrongFlashTimer);
            clearTimeout(state.advanceTimer);
            state.score = 0;
            state.round = 0;
            state.items = [];
            state.oddItem = null;
            state.isAnswered = false;
            state.isWaitingForNext = false;
            updateDifferentScore();
            updateDifferentRound();
            feedback.clear(els.gridWrapper);
        }

        function prepareDifferentGame() {
            pauseDifferent();
            state.score = 0;
            state.round = 0;
            updateDifferentScore();
            generateDifferentRound();
            message.show({
                title: '找出與其他食物不同的一張',
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });

            if (router) {
                if (syncTopBarCentering) syncTopBarCentering();
            } else {
                els.game.style.display = 'flex';
                if (syncTopBarCentering) syncTopBarCentering();
            }
        }

        function destroyDifferent() {
            clearTimeout(state.wrongFlashTimer);
            clearTimeout(state.advanceTimer);
            try { controller.abort(); } catch (e) { /* already aborted */ }
        }

        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () {
                if (router) {
                    router.goBack();
                } else {
                    els.game.style.display = 'none';
                    pauseDifferent();
                    if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
                }
            }, listenOpts);
        }
        if (els.countSelect) {
            els.countSelect.addEventListener('change', function () {
                const count = parseInt(this.value, 10);
                if (count >= 3 && count <= 6) {
                    state.imageCount = count;
                    if (prefs) {
                        prefs.save('cognitiveDifferentPrefs', { imageCount: count });
                    }
                    generateDifferentRound();
                }
            }, listenOpts);
        }

        updateDifferentScore();
        updateDifferentRound();

        if (router) {
            router.defineScreen('differentGame', {
                enter: prepareDifferentGame,
                exit: pauseDifferent,
                back: 'mainMenu'
            });
        }

        return {
            start: prepareDifferentGame,
            pause: pauseDifferent,
            reset: resetDifferent,
            destroy: destroyDifferent
        };
    }

    var api = {
        mount: mount,
        buildDifferentRound: buildDifferentRound
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDifferent = api;
        // Transitional self-mount preserving the original load-time behaviour.
        // Later strangler steps move this call into the router/orchestrator.
        api.mount(document, {
            foodData: window.CognitiveFoodData,
            prefs: window.CognitivePrefs,
            message: window.CognitiveMessage,
            feedback: window.CognitiveFeedback,
            router: window.CognitiveRouter,
            audio: window.CognitiveAudio,
            openMagnify: window.openMagnify,
            hideOverlay: window.hideOverlay,
            syncTopBarCentering: window.syncTopBarCentering
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);