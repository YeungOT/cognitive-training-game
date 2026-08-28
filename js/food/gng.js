(function (global) {
    'use strict';

    // =============================================================
    // 第四部分：Go/No Go 遊戲 — mount + lifecycle
    // =============================================================
    //
    // Pure sequence logic (gng-logic.js) and all direct DOM interaction
    // (gng-view.js) are injected via deps. This module keeps the game
    // lifecycle: state, timing, scoring, task switching, navigation.

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var logic = deps.logic || (typeof global.CognitiveGngLogic !== 'undefined' ? global.CognitiveGngLogic : null);
        var view = deps.view || (typeof global.CognitiveGngView !== 'undefined' ? global.CognitiveGngView : null);
        var prefs = deps.prefs || (typeof global.CognitivePrefs !== 'undefined' ? global.CognitivePrefs : null);
        var activityFactory = deps.activity || (typeof global.CognitiveActivity !== 'undefined' ? global.CognitiveActivity : null);
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var keyboard = deps.keyboard || (typeof global.CognitiveKeyboard !== 'undefined' ? global.CognitiveKeyboard : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        var syncTopBarCentering = deps.syncTopBarCentering || (typeof global.syncTopBarCentering === 'function' ? global.syncTopBarCentering : null);

        if (!logic || !view || !activityFactory) return null;
        var FOOD_DATA = foodData.FOOD_DATA;
        var CATEGORY_NAMES = foodData.CATEGORY_NAMES;
        var pickRandom = foodData.pickRandom;
        var getFoodId = foodData.getFoodId;

        var els = view.createGngEls(doc);

        var state = {
            goCategory: '水果',
            noGoCategory: '全部',
            autoSwitch: false,
            switchType: 'swap',
            switchFreq: 10,
            imageCount: 1,
            speed: 5,
            isPlaying: false,
            sequence: [],
            currentIndex: -1,
            score: 0,
            totalTrials: 0,
            correctHits: 0,
            interval: 0,
            currentItems: [],
            matchPending: false,
            roundCounter: 0,
            timerPaused: false,
            messagePaused: false,
        };

        var gngPreferences = prefs ? prefs.load('cognitiveGngPrefs') : null;
        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };

        var gngActivity = activityFactory ? activityFactory.create({
            minInterval: 1000,
            maxInterval: 6000,
            speedSteps: 10,
            defaultSpeed: state.speed,
            tick: function () { if (state.isPlaying && !state.timerPaused) nextGngImage(); },
            onPause: syncGngSessionUi,
            onResume: syncGngSessionUi
        }) : null;

        function syncGngPlayButton() {
            view.syncPlayButton(els.playBtn, state.isPlaying);
        }

        function syncGngSessionUi() {
            state.messagePaused = gngActivity.isPaused() && !state.timerPaused;
            view.syncSessionButton(els.playBtn, state.isPlaying && (state.timerPaused || gngActivity.isRunning()), true);
        }

        function resetGngTimer() {
            if (!state.isPlaying || state.timerPaused) return;
            if (state.messagePaused && gngActivity.isPaused()) {
                gngActivity.restart();
                return;
            }
            gngActivity.reset();
        }

        function buildSequence(length) {
            return logic.generateGngSequence({
                length: length,
                goCategory: state.goCategory,
                noGoCategory: state.noGoCategory,
                imageCount: state.imageCount,
                foodData: FOOD_DATA,
                categoryNames: CATEGORY_NAMES,
                pickRandom: pickRandom,
                getFoodId: getFoodId
            });
        }

        function getGngRule() {
            return { goCat: state.goCategory, noGoCat: state.noGoCategory };
        }

        function updateGngRuleDisplay(showPopup) {
            const { goCat, noGoCat } = getGngRule();
            view.updateRuleLabels(els, goCat, noGoCat);
            if (showPopup) view.showRuleChangePopup(message, goCat, noGoCat);
        }

        function showGngIntro() {
            view.showIntro(message, els.ruleText.textContent.trim());
        }

        function isGngGo(items) {
            return logic.isGngGoFor(items, state.goCategory, state.noGoCategory);
        }
        function switchGngTask() {
            const allCats = ['全部', ...CATEGORY_NAMES];
            const currentGo = state.goCategory;
            const currentNoGo = state.noGoCategory;

            if (state.switchType === 'random') {
                if (currentNoGo === '全部') {
                    let candidates = CATEGORY_NAMES.filter(c => c !== currentGo);
                    if (candidates.length === 0) return;
                    state.goCategory = pickRandom(candidates);
                    state.noGoCategory = '全部';
                    updateGngRuleDisplay(true);
                    state.sequence = buildSequence(state.sequence.length);
                    return;
                }
                if (currentGo === '全部') {
                    let candidates = CATEGORY_NAMES.filter(c => c !== currentNoGo);
                    if (candidates.length === 0) return;
                    state.noGoCategory = pickRandom(candidates);
                    state.goCategory = '全部';
                    updateGngRuleDisplay(true);
                    state.sequence = buildSequence(state.sequence.length);
                    return;
                }
                let goCandidates = CATEGORY_NAMES.filter(c => c !== currentGo && c !== currentNoGo);
                let noGoCandidates = CATEGORY_NAMES.filter(c => c !== currentGo && c !== currentNoGo);
                if (goCandidates.length === 0 || noGoCandidates.length === 0) return;
                state.goCategory = pickRandom(goCandidates);
                state.noGoCategory = pickRandom(noGoCandidates);
                if (state.goCategory === state.noGoCategory) {
                    const backup = CATEGORY_NAMES.filter(c => c !== state.goCategory);
                    if (backup.length > 0) {
                        state.noGoCategory = pickRandom(backup);
                    }
                }
                updateGngRuleDisplay(true);
                state.sequence = buildSequence(state.sequence.length);
            } else if (state.switchType === 'swap') {
                if (currentGo === '全部' && currentNoGo === '全部') {
                    return;
                }
                const temp = currentGo;
                state.goCategory = currentNoGo;
                state.noGoCategory = temp;
                updateGngRuleDisplay(true);
                state.sequence = buildSequence(state.sequence.length);
            }
        }

        function pauseGngTimer() {
            if (!state.isPlaying || state.timerPaused) return;
            state.timerPaused = true;
            gngActivity.pause();
        }

        function startGng() {
            if (state.isPlaying) return;
            state.sequence = buildSequence(50);
            state.currentIndex = -1;
            state.score = 0;
            state.totalTrials = 0;
            state.correctHits = 0;
            state.roundCounter = 0;
            state.timerPaused = false;
            state.messagePaused = false;
            view.setScore(els.scoreNum, state.score);
            updateGngRuleDisplay(false);
            state.isPlaying = true;
            syncGngPlayButton();
            state.matchPending = false;
            gngActivity.start(state.speed);
            nextGngImage();
        }

        function pauseGng() {
            gngActivity.stop();
            state.isPlaying = false;
            state.timerPaused = false;
            state.messagePaused = false;
            syncGngPlayButton();
            feedback.clear(els.gridWrapper);
        }

        function resetGng() {
            if (gngActivity) gngActivity.stop();
            state.isPlaying = false;
            state.timerPaused = false;
            state.messagePaused = false;
            state.sequence = [];
            state.currentIndex = -1;
            state.score = 0;
            state.totalTrials = 0;
            state.correctHits = 0;
            state.roundCounter = 0;
            state.matchPending = false;
            state.currentItems = [];
            view.setScore(els.scoreNum, state.score);
            syncGngPlayButton();
            if (feedback) feedback.clear(els.gridWrapper);
        }

        function destroyGng() {
            if (gngActivity) gngActivity.stop();
            try { controller.abort(); } catch (e) { /* already aborted */ }
            state.isPlaying = false;
        }

        function renderGngImage() {
            if (state.currentIndex < 0 || state.sequence.length === 0) return;
            const items = state.sequence[state.currentIndex];
            state.currentItems = items;
            state.matchPending = false;
            view.renderGngImage(doc, els, items, openMagnify);
        }

        function nextGngImage() {
            state.currentIndex++;
            if (state.currentIndex >= state.sequence.length) {
                state.sequence = buildSequence(50);
                state.currentIndex = 0;
            }

            state.roundCounter++;
            if (state.autoSwitch && state.roundCounter > state.switchFreq) {
                state.roundCounter = 0;
                switchGngTask();
            }

            renderGngImage();
            resetGngTimer();
        }

        function handleGngResponse(isGo) {
            if (state.currentIndex < 0 || state.matchPending) return;
            const items = state.currentItems;
            const actualGo = isGngGo(items);
            const correct = (isGo === actualGo);
            state.matchPending = true;
            pauseGngTimer();

            if (correct) {
                state.score++;
                state.correctHits++;
                audio.play('correct');
                feedback.show(els.gridWrapper, '✅ 正確！', 'correct');
            } else {
                audio.play('wrong');
                feedback.show(els.gridWrapper, '❌ 再試一次！', 'wrong');
            }
            view.flashGngCards(els, correct);
            state.totalTrials++;
            view.setScore(els.scoreNum, state.score);

            if (correct) {
                setTimeout(() => {
                    state.timerPaused = false;
                    if (state.isPlaying) nextGngImage();
                    else {
                        state.matchPending = false;
                    }
                }, 600);
            } else {
                setTimeout(() => {
                    state.matchPending = false;
                }, 600);
            }
        }

        function changeGngSpeed(delta) {
            let newSpeed = state.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            state.speed = newSpeed;
            els.speedDisplay.textContent = newSpeed;
            gngActivity.setSpeed(newSpeed);
            if (state.isPlaying && !state.timerPaused) {
                gngActivity.reset();
            }
        }
        function startGngFromSettings() {
            state.goCategory = els.goCategory.value;
            state.noGoCategory = els.noGoCategory.value;
            state.switchType = els.switchType.value;
            state.switchFreq = parseInt(els.switchFreq.value, 10);
            state.roundCounter = 0;
            updateGngRuleDisplay(false);
            state.score = 0;
            state.totalTrials = 0;
            state.correctHits = 0;
            view.setScore(els.scoreNum, state.score);
            state.currentIndex = -1;
            state.currentItems = [];
            state.matchPending = false;
            state.sequence = buildSequence(50);
            if (router) {
                if (router.navigate('gngGame')) {
                    router.afterTransition(function () {
                        if (syncTopBarCentering) syncTopBarCentering();
                        nextGngImage();
                        showGngIntro();
                    });
                }
            } else {
                doc.getElementById('gngSettings').classList.add('hidden');
                doc.getElementById('gngGame').style.display = 'flex';
                if (syncTopBarCentering) syncTopBarCentering();
                nextGngImage();
                showGngIntro();
            }
        }

        function onRuleTextClick(e) {
            e.stopPropagation();
            const currentGo = state.goCategory;
            const currentNoGo = state.noGoCategory;
            const goDisplay = currentGo === '全部' ? '其他' : currentGo;
            const noGoDisplay = currentNoGo === '全部' ? '其他' : currentNoGo;

            message.show({
                title: '🔄 立即切換任務',
                subtitle: `目前：✅ ${goDisplay} → ❌ ${noGoDisplay}`,
                buttons: [{
                    text: '🎲 隨機變更',
                    className: 'btn-stay',
                    action: function () {
                        const currentGo2 = state.goCategory;
                        const currentNoGo2 = state.noGoCategory;
                        if (currentNoGo2 === '全部') {
                            let candidates = CATEGORY_NAMES.filter(c => c !== currentGo2);
                            if (candidates.length === 0) return;
                            state.goCategory = pickRandom(candidates);
                            state.noGoCategory = '全部';
                        } else if (currentGo2 === '全部') {
                            let candidates = CATEGORY_NAMES.filter(c => c !== currentNoGo2);
                            if (candidates.length === 0) return;
                            state.noGoCategory = pickRandom(candidates);
                            state.goCategory = '全部';
                        } else {
                            let goCandidates = CATEGORY_NAMES.filter(c => c !== currentGo2 && c !== currentNoGo2);
                            let noGoCandidates = CATEGORY_NAMES.filter(c => c !== currentGo2 && c !== currentNoGo2);
                            if (goCandidates.length === 0 || noGoCandidates.length === 0) return;
                            state.goCategory = pickRandom(goCandidates);
                            state.noGoCategory = pickRandom(noGoCandidates);
                            if (state.goCategory === state.noGoCategory) {
                                const backup = CATEGORY_NAMES.filter(c => c !== state.goCategory);
                                if (backup.length > 0) {
                                    state.noGoCategory = pickRandom(backup);
                                }
                            }
                        }
                        updateGngRuleDisplay(true);
                        state.sequence = buildSequence(state.sequence.length);
                        state.roundCounter = 0;
                        resetGngTimer();
                    }
                }, {
                    text: '🔄 互換',
                    className: 'btn-stay',
                    action: function () {
                        const temp = state.goCategory;
                        state.goCategory = state.noGoCategory;
                        state.noGoCategory = temp;
                        updateGngRuleDisplay(true);
                        state.sequence = buildSequence(state.sequence.length);
                        state.roundCounter = 0;
                        resetGngTimer();
                    }
                }],
                pauseTimer: false
            });
        }

        function saveGngSettings() {
            const prefsObj = {
                goCategory: els.goCategory.value,
                noGoCategory: els.noGoCategory.value,
                autoSwitch: state.autoSwitch,
                switchType: els.switchType.value,
                switchFreq: parseInt(els.switchFreq.value, 10)
            };
            if (prefs) {
                prefs.save('cognitiveGngPrefs', prefsObj);
            }
            message.show({
                title: '設定已儲存',
                subtitle: '下次進入遊戲時會使用已儲存的偏好設定。',
                buttons: [{
                    text: '好的',
                    className: 'btn-stay',
                    action: function () {}
                }],
                pauseTimer: false
            });
        }
        view.bindGngControls(els, keyboard, listenOpts, {
            onAutoToggle: function (btn) {
                state.autoSwitch = !state.autoSwitch;
                view.syncAutoToggle(btn, state.autoSwitch);
            },
            onStart: startGngFromSettings,
            onBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    doc.getElementById('gngGame').style.display = 'none';
                    doc.getElementById('gngSettings').classList.remove('hidden');
                    pauseGng();
                }
            },
            onSettingsBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    doc.getElementById('gngSettings').classList.add('hidden');
                    pauseGng();
                    if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
                }
            },
            onPlayPause: function () { if (state.isPlaying) { pauseGng(); } else { startGng(); } },
            onGo: function () { handleGngResponse(true); },
            onNoGo: function () { handleGngResponse(false); },
            onSpeed: function (delta) { changeGngSpeed(delta); },
            onGridClick: function (e) {
                if (!state.matchPending && e.target.closest('.gng-card')) {
                    state.timerPaused = false;
                    nextGngImage();
                }
            },
            onRuleTextClick: onRuleTextClick,
            onSaveSettings: saveGngSettings,
            keyboard: {
                j: function () { handleGngResponse(true); },
                k: function () { handleGngResponse(false); },
                space: function () { if (!state.matchPending) { state.timerPaused = false; nextGngImage(); } },
                '-': function () { changeGngSpeed(-1); },
                '=': function () { changeGngSpeed(1); },
                p: function () { if (state.isPlaying) { pauseGng(); } else { startGng(); } }
            }
        });

        els.speedDisplay.textContent = state.speed;
        els.goCategory.value = '水果';
        els.noGoCategory.value = '全部';
        view.syncAutoToggle(els.autoToggle, false);
        els.switchType.value = 'swap';
        els.switchFreq.value = '10';

        if (gngPreferences) {
            view.applySettings(els, gngPreferences);
            state.autoSwitch = gngPreferences.autoSwitch;
            view.syncAutoToggle(els.autoToggle, state.autoSwitch);
        }

        if (router) {
            router.defineScreen('gngSettings', {
                exit: pauseGng,
                back: 'mainMenu'
            });
            router.defineScreen('gngGame', {
                exit: pauseGng,
                back: 'gngSettings'
            });
        }

        return {
            start: startGng,
            pause: pauseGng,
            reset: resetGng,
            destroy: destroyGng
        };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveGng = api;
        window.CognitiveGames.register({
            id: 'gng',
            title: 'Go/No Go',
            icon: '✅',
            entryRoute: 'gngSettings',
            buttonId: 'gameGngBtn',
            menuOrder: 2,
            setup: function () {
                return api.mount(document, {
                    foodData: window.CognitiveFoodData,
                    logic: window.CognitiveGngLogic,
                    view: window.CognitiveGngView,
                    prefs: window.CognitivePrefs,
                    activity: window.CognitiveActivity,
                    message: window.CognitiveMessage,
                    feedback: window.CognitiveFeedback,
                    router: window.CognitiveRouter,
                    keyboard: window.CognitiveKeyboard,
                    audio: window.CognitiveAudio,
                    openMagnify: window.openMagnify,
                    syncTopBarCentering: window.syncTopBarCentering
                });
            }
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
