(function (global) {
    'use strict';

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

    function buildExpressionDifferentRound(imageCount, items, shuffle, pickRandom, random) {
        var count = imageCount;
        if (!Number.isInteger(count) || count < 3 || count > 6) {
            throw new Error('imageCount must be an integer between 3 and 6');
        }
        if (!Array.isArray(items) || items.length < count) {
            throw new Error('items must contain at least imageCount entries');
        }
        if (typeof shuffle !== 'function' || typeof pickRandom !== 'function') {
            throw new Error('shuffle and pickRandom must be functions');
        }

        var groups = {};
        items.forEach(function (item) {
            if (!item || !item.expressionKey || !item.personId || !item.image) {
                throw new Error('Each face item requires expressionKey, personId and image');
            }
            if (!groups[item.expressionKey]) groups[item.expressionKey] = [];
            groups[item.expressionKey].push(item);
        });

        var expressionKeys = Object.keys(groups);
        if (expressionKeys.length < 2) {
            throw new Error('At least two expression groups are required');
        }

        var commonExpression = pickRandom(expressionKeys);
        var oddCandidates = expressionKeys.filter(function (key) { return key !== commonExpression; });
        var oddExpression = pickRandom(oddCandidates);
        var commonPool = shuffle(groups[commonExpression], random);
        var oddPool = shuffle(groups[oddExpression], random);
        var usedPersonIds = new Set();
        var commonItems = [];

        for (var i = 0; i < commonPool.length && commonItems.length < count - 1; i++) {
            var candidate = commonPool[i];
            if (usedPersonIds.has(candidate.personId)) continue;
            usedPersonIds.add(candidate.personId);
            commonItems.push(candidate);
        }
        if (commonItems.length !== count - 1) {
            throw new Error('Not enough distinct people for the requested common expression');
        }

        var oddItem = oddPool.filter(function (item) {
            return !usedPersonIds.has(item.personId);
        })[0];
        if (!oddItem) {
            throw new Error('Not enough distinct people for the requested odd expression');
        }

        var result = shuffle(
            commonItems.map(function (item) { return Object.assign({}, item, { isCorrect: false }); })
                .concat([Object.assign({}, oddItem, { isCorrect: true })]),
            random
        );
        return { items: result, oddItem: oddItem };
    }

    function mount(root, deps) {
        deps = deps || {};
        const doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        const foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        const faceContent = deps.faceContent || (typeof global.CognitiveFaceGameContent !== 'undefined' ? global.CognitiveFaceGameContent : null);
        if (!foodData || !faceContent) return null;
        const FOOD_DATA = foodData.FOOD_DATA;
        const CATEGORY_NAMES = foodData.CATEGORY_NAMES;
        const shuffle = foodData.shuffle;
        const pickRandom = foodData.pickRandom;

        const prefs = deps.prefs || (typeof global.CognitivePrefs !== 'undefined' ? global.CognitivePrefs : null);
        const message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        const feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        const router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        const audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        const openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        const hideOverlay = deps.hideOverlay || (typeof global.hideOverlay === 'function' ? global.hideOverlay : null);
        const syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);
        const view = deps.view || (typeof global.CognitiveDifferentView !== 'undefined' ? global.CognitiveDifferentView : null);
        const gameScreen = deps.gameScreen || (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
        if (!view || !gameScreen) return null;

        const screen = gameScreen.createGameScreen(doc, {
            gameRoot: doc.getElementById('differentGame'),
            game: {
                topBar: {
                    backId: 'differentBackBtn',
                    titleId: 'differentQuestionText',
                    title: '🔍 找不同',
                    scoreId: 'differentScoreNum',
                    dropdown: {
                        selectId: 'differentCountSelect',
                        label: '顯示',
                        options: [
                            { value: '3', label: '3' },
                            { value: '4', label: '4', selected: true },
                            { value: '5', label: '5' }
                        ]
                    },
                    dropdowns: [{
                        selectId: 'differentContentMode',
                        ariaLabel: '內容',
                        options: [
                            { value: 'food', label: '食物', selected: true },
                            { value: 'face', label: '表情' }
                        ]
                    }],
                    hamburgerId: 'hamburgerBtnDifferent'
                },
                stage: {
                    id: 'differentGridWrapper',
                    className: 'different-grid-wrapper',
                    child: {
                        id: 'differentGridContainer',
                        className: 'different-grid-container count-4'
                    }
                },
                footer: {
                    hint: '🔍 找出與其他食物不同的一張',
                    hintId: 'differentHint',
                    roundId: 'differentRoundInfo',
                    roundText: '第 1 題'
                }
            }
        });

        const els = screen.els;
        if (!els.differentGame || !els.differentGridWrapper || !els.differentGridContainer ||
            !els.differentScoreNum || !els.differentRoundInfo || !els.differentBackBtn ||
            !els.differentCountSelect) return null;

        const state = {
            contentMode: 'food',
            imageCount: 4,
            score: 0,
            round: 1,
            items: [],
            oddItem: null,
            isAnswered: false,
            isWaitingForNext: false,
            wrongFlashTimer: null,
            advanceTimer: null
        };

        const differentPreferences = prefs ? prefs.load('cognitiveDifferentPrefs') : null;
        if (differentPreferences) {
            state.contentMode = differentPreferences.contentMode === 'face' ? 'face' : 'food';
            state.imageCount = differentPreferences.imageCount;
            if (els.differentContentMode) els.differentContentMode.value = state.contentMode;
            els.differentCountSelect.value = String(state.imageCount);
        }

        const controller = new AbortController();
        const listenOpts = { signal: controller.signal };

        function handleDifferentCardClick(index) {
            if (state.isAnswered || state.isWaitingForNext) return;
            const item = state.items[index];
            const card = els.differentGridContainer.querySelector(`.different-card[data-index="${index}"]`);
            if (!item || !card) return;

            if (item.isCorrect) {
                state.isAnswered = true;
                state.isWaitingForNext = true;
                state.score++;
                updateDifferentScore();
                card.classList.add('feedback-correct');
                Array.from(els.differentGridContainer.querySelectorAll('.different-card')).forEach(child => child.classList.add('disabled'));
                audio.play('correct');
                feedback.show(els.differentGridWrapper, '✅ 正確！', 'correct');
                clearTimeout(state.advanceTimer);
                state.advanceTimer = setTimeout(nextDifferentRound, 650);
                return;
            }

            audio.play('wrong');
            card.classList.add('feedback-wrong');
            feedback.show(els.differentGridWrapper, '❌ 再試一次！', 'wrong');
            clearTimeout(state.wrongFlashTimer);
            state.wrongFlashTimer = setTimeout(function () {
                card.classList.remove('feedback-wrong');
            }, 600);
        }

        function updateDifferentScore() {
            els.differentScoreNum.textContent = state.score;
        }

        function updateDifferentRound() {
            els.differentRoundInfo.textContent = `第 ${state.round} 題`;
        }

        function nextDifferentRound() {
            if (hideOverlay) hideOverlay();
            state.round++;
            generateDifferentRound();
        }

        function generateDifferentRound() {
            const result = state.contentMode === 'face'
                ? buildExpressionDifferentRound(
                    state.imageCount,
                    faceContent.listItems({ dimension: 'expression' }),
                    shuffle,
                    pickRandom
                )
                : buildDifferentRound(state.imageCount, FOOD_DATA, CATEGORY_NAMES, shuffle, pickRandom);
            state.oddItem = result.oddItem;
            state.items = result.items;
            if (els.differentHint) {
                els.differentHint.textContent = state.contentMode === 'face'
                    ? '🔍 找出與其他表情不同的一張'
                    : '🔍 找出與其他食物不同的一張';
            }
            view.renderDifferentGrid(doc, els.differentGridContainer, state.items, {
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
            feedback.clear(els.differentGridWrapper);
            state.isAnswered = false;
            state.isWaitingForNext = false;
        }

        function resetDifferent() {
            clearTimeout(state.wrongFlashTimer);
            clearTimeout(state.advanceTimer);
            state.score = 0;
            state.round = 1;
            state.items = [];
            state.oddItem = null;
            state.isAnswered = false;
            state.isWaitingForNext = false;
            updateDifferentScore();
            updateDifferentRound();
            feedback.clear(els.differentGridWrapper);
        }

        function prepareDifferentGame() {
            pauseDifferent();
            state.score = 0;
            state.round = 1;
            updateDifferentScore();
            generateDifferentRound();
            message.show({
                title: state.contentMode === 'face'
                    ? '找出與其他表情不同的一張'
                    : '找出與其他食物不同的一張',
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });

            if (syncTopBarCentering) syncTopBarCentering();
        }

        function destroyDifferent() {
            clearTimeout(state.wrongFlashTimer);
            clearTimeout(state.advanceTimer);
            try { controller.abort(); } catch (e) { /* already aborted */ }
        }

        els.differentBackBtn.addEventListener('click', function () {
            if (router) {
                router.goBack();
            } else {
                els.differentGame.style.display = 'none';
                pauseDifferent();
                if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
            }
        }, listenOpts);

        els.differentCountSelect.addEventListener('change', function () {
            const count = parseInt(this.value, 10);
            if (count >= 3 && count <= 5) {
                state.imageCount = count;
                if (prefs) prefs.save('cognitiveDifferentPrefs', { imageCount: count });
                generateDifferentRound();
            }
        }, listenOpts);
        if (els.differentContentMode) {
            els.differentContentMode.addEventListener('change', function () {
                const value = this.value === 'face' ? 'face' : 'food';
                state.contentMode = value;
                if (prefs) prefs.save('cognitiveDifferentPrefs', {
                    contentMode: value,
                    imageCount: state.imageCount
                });
                generateDifferentRound();
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
        buildDifferentRound: buildDifferentRound,
        buildExpressionDifferentRound: buildExpressionDifferentRound
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDifferent = api;
        window.CognitiveGames.register({
            id: 'different',
            title: '找不同',
            icon: '🔍',
            entryRoute: 'differentGame',
            buttonId: 'gameDifferentBtn',
            menuOrder: 3,
            setup: function () {
                return api.mount(document, {
                    foodData: window.CognitiveFoodData,
                    faceContent: window.CognitiveFaceGameContent,
                    prefs: window.CognitivePrefs,
                    message: window.CognitiveMessage,
                    feedback: window.CognitiveFeedback,
                    router: window.CognitiveRouter,
                    audio: window.CognitiveAudio,
                    openMagnify: window.openMagnify,
                    hideOverlay: window.hideOverlay,
                    syncTopBarCentering: window.syncTopBarCentering,
                    gameScreen: window.CognitiveGameScreen
                });
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
