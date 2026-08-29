(function (global) {
    'use strict';

    // =============================================================
    // 第二部分：食物分類遊戲 — mount + lifecycle
    // =============================================================

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var logic = deps.logic || (typeof global.CognitiveFoodLogic !== 'undefined' ? global.CognitiveFoodLogic : null);
        var view = deps.view || (typeof global.CognitiveFoodView !== 'undefined' ? global.CognitiveFoodView : null);

        var FOOD_DATA = foodData.FOOD_DATA;
        var CATEGORY_NAMES = foodData.CATEGORY_NAMES;
        var CATEGORY_ICONS = foodData.CATEGORY_ICONS;
        var QUESTION_TEMPLATES = foodData.QUESTION_TEMPLATES;
        var shuffle = foodData.shuffle;
        var pickRandom = foodData.pickRandom;
        var getFoodId = foodData.getFoodId;
        var getFoodQuestionHtml = logic.getFoodQuestionHtml;
        var getAvailableItems = logic.getAvailableItems;
        var areAllCategoriesComplete = logic.areAllCategoriesComplete;
        var pickFoodDistractors = logic.pickFoodDistractors;

        var nameVisibility = deps.nameVisibility || null;
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        var syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);
        var hideOverlay = deps.hideOverlay || (typeof global.hideOverlay === 'function' ? global.hideOverlay : null);
        var gameScreen = deps.gameScreen || (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
        var foodScreen = deps.foodScreen || (typeof global.CognitiveFoodScreen !== 'undefined' ? global.CognitiveFoodScreen : null);

        if (!logic || !view || !gameScreen || !foodScreen) return null;

        gameScreen.createGameScreen(doc, {
            gameRoot: doc.getElementById('foodGame'),
            ...foodScreen.createFoodScreenDefinition()
        });
        var els = view.createFoodEls(doc);

        var state = {
            score: 0,
            round: 0,
            imageCount: 3,
            currentCategory: '',
            correctItem: null,
            items: [],
            isAnswered: false,
            isWaitingForNext: false,
            advanceTimer: null,
            gameMode: 'random',
            usedFoods: new Set(),
            categoryCompleted: {}
        };
        CATEGORY_NAMES.forEach(function (c) { state.categoryCompleted[c] = false; });

        var questionText = view.createQuestionText(els.questionText, function (category) {
            return getFoodQuestionHtml(category, QUESTION_TEMPLATES);
        }, syncTopBarCentering);

        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };
        if (typeof global.addEventListener === 'function') { global.addEventListener('resize', function () { questionText.schedule(); }, listenOpts); }

        function restartFood() {
            resetFoodProgress();
            goToFoodCategorySelect();
        }
        function resetFoodProgress() {
            state.usedFoods = new Set();
            CATEGORY_NAMES.forEach(function (c) { state.categoryCompleted[c] = false; });
            state.score = 0;
            state.round = 0;
            state.currentCategory = '';
            view.setScore(els.scoreNum, state.score);
            updateFoodMenuButtons();
        }

        function showCategoryComplete(category) {
            view.showCategoryComplete(message, category, CATEGORY_ICONS[category], goToFoodCategorySelect);
        }
        function availableCategories() { return CATEGORY_NAMES.filter(cat => !state.categoryCompleted[cat]); }

        function generateQuestion() {
            const prevCat = state.currentCategory;
            let targetCat = state.gameMode;
            if (targetCat === 'random') {
                const availableCats = availableCategories();
                if (availableCats.length === 0) { view.showVictoryScreen(message, restartFood); return; }
                let candidates = availableCats.filter(c => c !== prevCat);
                if (candidates.length === 0) candidates = availableCats;
                targetCat = pickRandom(candidates);
            }
            if (state.categoryCompleted[targetCat]) {
                if (state.gameMode === 'random') {
                    const availableCats = availableCategories();
                    if (availableCats.length === 0) { view.showVictoryScreen(message, restartFood); return; }
                    targetCat = pickRandom(availableCats);
                } else { showCategoryComplete(targetCat); return; }
            }
            state.currentCategory = targetCat;

            const availableCorrects = getAvailableItems(targetCat, FOOD_DATA, state.usedFoods, getFoodId);
            if (availableCorrects.length === 0) {
                state.categoryCompleted[targetCat] = true;
                if (state.gameMode === 'random') { generateQuestion(); return; } else { showCategoryComplete(
                    targetCat); return; }
            }
            const correct = pickRandom(availableCorrects);
            state.correctItem = correct;

            const distractors = pickFoodDistractors(targetCat, correct, state.imageCount, FOOD_DATA, CATEGORY_NAMES, state.usedFoods, shuffle, pickRandom, getFoodId);
            const allItems = [{ ...correct, isCorrect: true }, ...distractors.map(item => ({ ...item, isCorrect: false }))];
            state.items = shuffle(allItems);
            state.usedFoods.add(getFoodId(correct));
            distractors.forEach(item => state.usedFoods.add(getFoodId(item)));

            view.renderFoodGrid(doc, els.grid, state.items, {
                onCardClick: handleFoodCardClick,
                onMagnify: openMagnify
            });
            if (nameVisibility) nameVisibility.apply();
            questionText.set(targetCat);
            view.setRound(els.roundInfo, state.round);
            state.isAnswered = false;
            state.isWaitingForNext = false;
            view.clearFoodCards(doc);
            if (hideOverlay) hideOverlay();
            if (state.gameMode === 'random' ? prevCat !== targetCat : prevCat === '') {
                view.showIntro(message, getFoodQuestionHtml(targetCat, QUESTION_TEMPLATES));
            }
        }

        function handleFoodCardClick(index) {
            if (state.isAnswered || state.isWaitingForNext) return;
            const item = state.items[index];
            const cards = doc.querySelectorAll('.food-card');
            if (!item || !cards[index]) return;

            if (item.isCorrect) {
                state.isAnswered = true;
                state.isWaitingForNext = true;
                state.score += 1;
                view.setScore(els.scoreNum, state.score);
                audio.play('correct');
                feedback.show(els.gridWrapper, '✅ 正確！', 'correct');
                clearTimeout(state.advanceTimer);
                state.advanceTimer = setTimeout(function () { if (hideOverlay) hideOverlay(); state.round += 1; generateQuestion(); }, 650);
            } else {
                audio.play('wrong');
                feedback.show(els.gridWrapper, '❌ 再試一次！', 'wrong');
            }
            view.markFoodCard(doc, cards, index, item.isCorrect);
        }

        function buildFoodCategoryGrid() {
            view.buildFoodCategoryGrid(doc, els.categoryGrid, {
                categoryNames: CATEGORY_NAMES,
                categoryIcons: CATEGORY_ICONS,
                categoryCompleted: state.categoryCompleted,
                allDone: areAllCategoriesComplete(CATEGORY_NAMES, state.categoryCompleted),
                onCategoryClick: function (cat) {
                    if (state.categoryCompleted[cat]) { showCategoryComplete(cat); return; }
                    startFoodGame(cat);
                },
                onRandomClick: function (allDone) {
                    if (allDone) { view.showVictoryScreen(message, restartFood); return; }
                    startFoodGame('random');
                }
            });
        }

        function updateFoodMenuButtons() {
            view.updateFoodMenuButtons(doc, els.categoryGrid, {
                categoryCompleted: state.categoryCompleted,
                allDone: areAllCategoriesComplete(CATEGORY_NAMES, state.categoryCompleted)
            });
        }

        function startFoodGame(mode) {
            if (mode === 'random') resetFoodProgress();
            else {
                state.categoryCompleted[mode] = false;
                const toRemove = [];
                state.usedFoods.forEach(id => {
                    const item = FOOD_DATA.find(f => getFoodId(f) === id);
                    if (item && item.category === mode) toRemove.push(id);
                });
                toRemove.forEach(id => state.usedFoods.delete(id));
            }
            state.gameMode = mode;
            state.score = 0;
            state.round = 0;
            state.currentCategory = '';
            view.setScore(els.scoreNum, state.score);
            if (hideOverlay) hideOverlay();
            updateFoodMenuButtons();
            if (router) {
                if (router.navigate('foodGame')) {
                    if (hideOverlay) hideOverlay(); state.round += 1; generateQuestion();
                    if (syncTopBarCentering) syncTopBarCentering();
                }
            } else {
                els.foodGame.style.display = 'flex';
                els.foodCategorySelect.classList.add('hidden');
                if (syncTopBarCentering) syncTopBarCentering();
                nextFoodRound();
            }
        }

        function goToFoodCategorySelect() {
            clearTimeout(state.advanceTimer);
            if (feedback) feedback.clear(els.gridWrapper);
            if (router) {
                router.goBack();
            } else {
                els.foodGame.style.display = 'none';
                els.foodCategorySelect.classList.remove('hidden');
                buildFoodCategoryGrid();
                updateFoodMenuButtons();
            }
        }

        function pauseFood() {
            clearTimeout(state.advanceTimer);
            if (feedback) feedback.clear(els.gridWrapper);
            if (hideOverlay) hideOverlay();
        }

        function destroyFood() {
            clearTimeout(state.advanceTimer);
            questionText.destroy();
            try { controller.abort(); } catch (e) { /* already aborted */ }
        }
        view.bindFoodControls(els, listenOpts, {
            onBack: goToFoodCategorySelect,
            onCategoryBack: function () {
                if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
            },
            onCountChange: function (value) {
                const count = parseInt(value, 10);
                if (count >= 2 && count <= 4) { state.imageCount = count;
                    generateQuestion(); }
            },
            onToggleNames: function (btn) {
                if (nameVisibility) {
                    nameVisibility.toggle();
                    btn.classList.toggle('name-hidden', !nameVisibility.isEnabled);
                }
            }
        });

        if (router) {
            router.defineScreen('foodCategorySelect', {
                enter: function () {
                    buildFoodCategoryGrid();
                    updateFoodMenuButtons();
                },
                back: 'mainMenu'
            });
            router.defineScreen('foodGame', {
                exit: pauseFood,
                back: 'foodCategorySelect'
            });
        }

        return {
            start: startFoodGame,
            pause: pauseFood,
            reset: resetFoodProgress,
            destroy: destroyFood
        };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveFood = api;
        window.CognitiveGames.register({
            id: 'food',
            title: '食物分類',
            icon: '❓',
            entryRoute: 'foodCategorySelect',
            buttonId: 'gameFoodBtn',
            menuOrder: 1,
            setup: function () {
                return api.mount(document, {
                    foodData: window.CognitiveFoodData,
                    logic: window.CognitiveFoodLogic,
                    view: window.CognitiveFoodView,
                    nameVisibility: window.CognitiveNameVisibility ? window.CognitiveNameVisibility.shared : null,
                    gameScreen: window.CognitiveGameScreen,
                    foodScreen: window.CognitiveFoodScreen,
                    message: window.CognitiveMessage,
                    feedback: window.CognitiveFeedback,
                    router: window.CognitiveRouter,
                    audio: window.CognitiveAudio,
                    openMagnify: window.openMagnify,
                    syncTopBarCentering: window.syncTopBarCentering,
                    hideOverlay: window.hideOverlay
                });
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
