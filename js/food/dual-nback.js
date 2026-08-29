(function (global) {
    'use strict';

    // =============================================================
    // 雙重 N-back — mount + lifecycle
    // =============================================================
    //
    // Pure logic/tables (dual-nback-logic.js) and all direct DOM interaction
    // (dual-nback-view.js) are injected via deps. This module keeps the game
    // lifecycle: state, sequences, timing, scoring, navigation.

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var logic = deps.logic || (typeof global.CognitiveDualNbackLogic !== 'undefined' ? global.CognitiveDualNbackLogic : null);
        var view = deps.view || (typeof global.CognitiveDualNbackView !== 'undefined' ? global.CognitiveDualNbackView : null);
        var sequence = deps.sequence || (typeof global.CognitiveSequence !== 'undefined' ? global.CognitiveSequence : null);
        var activityFactory = deps.activity || (typeof global.CognitiveActivity !== 'undefined' ? global.CognitiveActivity : null);
        var nbackAudioMap = deps.nbackAudioMap || (typeof global.CognitiveNbackAudioMap !== 'undefined' ? global.CognitiveNbackAudioMap : null);
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var keyboard = deps.keyboard || (typeof global.CognitiveKeyboard !== 'undefined' ? global.CognitiveKeyboard : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var hideOverlay = deps.hideOverlay || (typeof global.hideOverlay === 'function' ? global.hideOverlay : null);
        var gameScreen = deps.gameScreen || (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
        var dualScreen = deps.dualScreen || (typeof global.CognitiveDualNbackScreen !== 'undefined' ? global.CognitiveDualNbackScreen : null);

        if (!logic || !view || !sequence || !activityFactory || !gameScreen || !dualScreen) return null;
        var FOOD_DATA = foodData.FOOD_DATA;
        var DUAL_SEQ_LEN = logic.DUAL_NBACK_SEQUENCE_LENGTH;
        var DUAL_LABELS = logic.DUAL_MODALITY_LABELS;
        var DUAL_GRIDS = logic.DUAL_POSITION_GRIDS;
        var DUAL_PALETTES = logic.DUAL_COLOR_PALETTES;

        gameScreen.createGameScreen(doc, {
            gameRoot: doc.getElementById('dualNbackGame'),
            settingsRoot: doc.getElementById('dualNbackSettings'),
            ...dualScreen.createDualNbackScreenDefinition()
        });
        var els = view.createDualNbackEls(doc);

        var state = {
            modalities: [],
            positionGrid: '3x3',
            colorPalette: '6',
            n: 1,
            speed: 5,
            audioRate: 1,
            isPlaying: false,
            sequences: {},
            currentIndex: -1,
            currentItems: {},
            matchLocked: {},
            score: 0,
            totalTrials: 0,
            interval: 0,
            rebuildCount: 0
        };

        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };

        var dualNbackActivity = activityFactory.create({
            minInterval: 2000,
            maxInterval: 4000,
            speedSteps: 10,
            defaultSpeed: state.speed,
            tick: function () { if (state.isPlaying) nextDualNbackTrial(true); },
            onPause: syncDualNbackSessionUi,
            onResume: syncDualNbackSessionUi
        });

        function buildDualSequences(seedTails) {
            state.sequences = logic.generateDualSequences(state.modalities, state.n, DUAL_SEQ_LEN, state.positionGrid, state.colorPalette, FOOD_DATA, DUAL_GRIDS, DUAL_PALETTES, sequence, seedTails);
        }

        function syncDualNbackPlayButton() {
            els.playBtn.classList.toggle('playing', state.isPlaying);
        }

        function syncDualNbackSessionUi() {
            const active = state.isPlaying && dualNbackActivity.isRunning();
            els.playBtn.classList.toggle('playing', active);
        }

        function playDualNbackAudio() {
            if (state.modalities.indexOf('audio') === -1) return;
            const item = state.currentItems.audio;
            if (!item || !nbackAudioMap) return;
            const src = nbackAudioMap[logic.getDualFoodId(item)] ||
                        nbackAudioMap[item.name];
            if (!src) return;
            audio.stopFile();
            // Edge clips are generated at 0.5x, so play them at normal speed.
            audio.playFile(src, {
                volume: 1,
                preservesPitch: true,
                playbackRate: state.audioRate || 1,
                bypassSfx: true
            });
        }

        function commitDualNbackTrial(index, playAudio) {
            if (!state.modalities.length) return;
            state.currentIndex = index;
            state.currentItems = {};
            state.matchLocked = {};

            state.modalities.forEach(modality => {
                const trial = state.sequences[modality][index];
                state.currentItems[modality] = trial ? trial.value : undefined;
                state.matchLocked[modality] = false;
            });

            const showGrid = state.modalities.indexOf('position') !== -1;
            els.grid.classList.toggle('hidden', !showGrid);
            els.card.classList.toggle('hidden', showGrid);
            if (showGrid) {
                view.renderDualGrid(doc, els, { positionGrid: state.positionGrid, positionGrids: DUAL_GRIDS, modalities: state.modalities, currentItems: state.currentItems });
            } else {
                view.renderDualCard(doc, els, {
                    modalities: state.modalities,
                    currentItems: state.currentItems
                });
            }
            if (playAudio) playDualNbackAudio();
        }

        function nextDualNbackTrial() {
            if (!state.modalities.length) return;
            dualNbackActivity.hold();
            state.currentIndex++;
            if (state.currentIndex >= DUAL_SEQ_LEN) {
                var seedTails = {};
                state.modalities.forEach(function (modality) {
                    var tail = [];
                    var seq = state.sequences[modality];
                    for (var t = Math.max(0, seq.length - state.n); t < seq.length; t++) {
                        tail.push(seq[t].value);
                    }
                    seedTails[modality] = tail;
                });
                buildDualSequences(seedTails);
                state.currentIndex = 0;
                state.rebuildCount++;
            }
            commitDualNbackTrial(state.currentIndex, true);
            dualNbackActivity.reset();
        }
        function pauseDual() {
            dualNbackActivity.pause();
            state.isPlaying = false;
            syncDualNbackPlayButton();
            audio.stopFile();
            if (hideOverlay) hideOverlay();
            feedback.clear(els.stage);
        }

        function startDual() {
            if (state.isPlaying) {
                pauseDual();
                return;
            }
            buildDualSequences();
            state.currentIndex = 0;
            state.score = 0;
            state.totalTrials = 0;
            state.isPlaying = true;
            syncDualNbackPlayButton();
            commitDualNbackTrial(0, true);
            view.setScore(els.scoreNum, state.score);
            dualNbackActivity.start(state.speed);
        }

        function resetDual() {
            if (dualNbackActivity) dualNbackActivity.stop();
            state.isPlaying = false;
            state.sequences = {};
            state.currentIndex = -1;
            state.currentItems = {};
            state.matchLocked = {};
            state.score = 0;
            state.totalTrials = 0;
            view.setScore(els.scoreNum, state.score);
            syncDualNbackPlayButton();
            if (audio && audio.stopFile) audio.stopFile();
            if (hideOverlay) hideOverlay();
            feedback.clear(els.stage);
        }

        function handleDualNbackMatch(modality) {
            if (state.currentIndex < 0 ||
                state.matchLocked[modality]) return;
            if (state.currentIndex < state.n && !state.rebuildCount) {
                feedback.show(els.stage, '還不夠 ' + state.n + ' 步', 'warn');
                return;
            }

            const trial = state.sequences[modality][state.currentIndex];
            const correct = Boolean(trial && trial.isMatch);

            state.matchLocked[modality] = true;
            state.totalTrials++;
            if (correct) {
                state.score++;
                audio.play('correct');
            } else {
                audio.play('wrong');
            }
            view.setScore(els.scoreNum, state.score);
            view.flashDualFeedback(els, view.getDualVisibleContent(els, state.modalities), correct);
            feedback.show(els.stage, correct ? '✅ 正確！' : '❌ 再試一次！', correct ? 'correct' : 'wrong');
        }

        function changeDualNbackSpeed(delta) {
            let newSpeed = state.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            state.speed = newSpeed;
            els.speedDisplay.textContent = newSpeed;
            dualNbackActivity.setSpeed(newSpeed);
            if (state.isPlaying) dualNbackActivity.reset();
        }

        function changeDualNbackN(newN) {
            if (newN === state.n) return;
            const wasPlaying = state.isPlaying;
            if (wasPlaying) pauseDual();
            state.n = newN;
            els.nSelect.value = String(newN);
            buildDualSequences();
            state.currentIndex = 0;
            state.score = 0;
            state.totalTrials = 0;
            view.setScore(els.scoreNum, state.score);
            commitDualNbackTrial(0, false);
            view.showInstruction(message, state.modalities, DUAL_LABELS, state.n);
        }

        function startDualFromSettings() {
            const modality1 = els.modality1Select.value;
            const modality2 = els.modality2Select.value;
            if (!modality1 || !modality2 || modality1 === modality2) return;
            const needsPosition = modality1 === 'position' || modality2 === 'position';
            const needsColor = modality1 === 'color' || modality2 === 'color';
            if (needsPosition && !els.positionGridSelect.value) return;
            if (needsColor && !els.colorPaletteSelect.value) return;

            state.modalities = [modality1, modality2];
            state.n = parseInt(els.nSelect.value, 10) || 1;
            state.positionGrid = els.positionGridSelect.value || '3x3';
            state.colorPalette = els.colorPaletteSelect.value || '6';
            state.audioRate = 1;
            state.speed = 5;
            els.speedDisplay.textContent = '5';
            els.nSelect.value = String(state.n);
            view.buildDualMatchButtons(doc, els, state.modalities, DUAL_LABELS, handleDualNbackMatch);

            if (router) {
                router.navigate('dualNbackGame');
            }
        }

        function prepareDualNbackGame() {
            if (!state.modalities.length) return;
            pauseDual();
            buildDualSequences();
            state.currentIndex = 0;
            state.score = 0;
            state.totalTrials = 0;
            view.setScore(els.scoreNum, state.score);
            commitDualNbackTrial(0, false);
            view.showInstruction(message, state.modalities, DUAL_LABELS, state.n);
        }

        function destroyDual() {
            if (dualNbackActivity) dualNbackActivity.stop();
            try { controller.abort(); } catch (e) { /* already aborted */ }
            state.isPlaying = false;
        }
        function goBack() { if (router) router.goBack(); }

        view.bindDualControls(els, keyboard, listenOpts, {
            onPlayPause: startDual,
            onAdvance: nextDualNbackTrial,
            onSpeedDown: function () { changeDualNbackSpeed(-1); },
            onSpeedUp: function () { changeDualNbackSpeed(1); },
            onNChange: function (value) { changeDualNbackN(parseInt(value, 10)); },
            onBack: goBack,
            onSettingsBack: goBack,
            onModeBack: goBack,
            onSingle: function () { if (router) router.navigate('nbackGame'); },
            onDual: function () { if (router) router.navigate('dualNbackSettings'); },
            onSettingsChange: function () { view.updateDualSettingsState(els); },
            onStart: startDualFromSettings,
            keyboard: {
                j: function () {
                    const modalities = state.modalities;
                    if (modalities[0]) handleDualNbackMatch(modalities[0]);
                },
                k: function () {
                    const modalities = state.modalities;
                    if (modalities[1]) handleDualNbackMatch(modalities[1]);
                },
                space: nextDualNbackTrial,
                '-': function () { changeDualNbackSpeed(-1); },
                '=': function () { changeDualNbackSpeed(1); },
                p: startDual
            }
        });

        els.speedDisplay.textContent = state.speed;
        els.nSelect.value = String(state.n);
        view.updateDualSettingsState(els);

        if (router) {
            router.defineScreen('nbackModeSelect', {
                back: 'home'
            });
            router.defineScreen('dualNbackSettings', {
                back: 'nbackModeSelect'
            });
            router.defineScreen('dualNbackGame', {
                enter: prepareDualNbackGame,
                exit: pauseDual,
                back: 'dualNbackSettings'
            });
        }

        return {
            start: startDual,
            pause: pauseDual,
            reset: resetDual,
            destroy: destroyDual
        };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDualNback = api;
        // Transitional self-mount preserving the original load-time behaviour.
        // Later strangler steps move this call into the router/orchestrator.
        api.mount(document, {
            foodData: window.CognitiveFoodData,
            logic: window.CognitiveDualNbackLogic,
            view: window.CognitiveDualNbackView,
            sequence: window.CognitiveSequence,
            activity: window.CognitiveActivity,
            nbackAudioMap: window.CognitiveNbackAudioMap,
            message: window.CognitiveMessage,
            feedback: window.CognitiveFeedback,
            router: window.CognitiveRouter,
            keyboard: window.CognitiveKeyboard,
            audio: window.CognitiveAudio,
            hideOverlay: window.hideOverlay,
            gameScreen: window.CognitiveGameScreen,
            dualScreen: window.CognitiveDualNbackScreen
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);