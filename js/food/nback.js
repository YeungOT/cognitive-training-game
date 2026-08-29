(function (global) {
    'use strict';

    // =============================================================
    // 第三部分：N-back 記憶遊戲
    // =============================================================
    //
    // Pure helpers at module scope; lifecycle in mount(root, deps). All direct
    // DOM interaction is delegated to the injected nback-view module.

    function generateNbackSequence(length, n, foodData, sequence) {
        return sequence.generateTrials({
            choices: foodData,
            n: n,
            length: length,
            matchProbability: sequence.matchProbability,
            cloneValue: item => ({ ...item }),
            keyFor: item => item.name
        });
    }

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc) return null;

        var foodData = deps.foodData || (typeof global.CognitiveFoodData !== 'undefined' ? global.CognitiveFoodData : null);
        if (!foodData) return null;
        var FOOD_DATA = foodData.FOOD_DATA;

        var sequence = deps.sequence || (typeof global.CognitiveSequence !== 'undefined' ? global.CognitiveSequence : null);
        var activityFactory = deps.activity || (typeof global.CognitiveActivity !== 'undefined' ? global.CognitiveActivity : null);
        var message = deps.message || (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
        var feedback = deps.feedback || (typeof global.CognitiveFeedback !== 'undefined' ? global.CognitiveFeedback : null);
        var router = deps.router || (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
        var keyboard = deps.keyboard || (typeof global.CognitiveKeyboard !== 'undefined' ? global.CognitiveKeyboard : null);
        var audio = deps.audio || (typeof global.CognitiveAudio !== 'undefined' ? global.CognitiveAudio : null);
        var openMagnify = deps.openMagnify || (typeof global.openMagnify === 'function' ? global.openMagnify : null);
        var view = deps.view || (typeof global.CognitiveNbackView !== 'undefined' ? global.CognitiveNbackView : null);
        var gameScreen = deps.gameScreen || (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
        var nbackScreen = deps.nbackScreen || (typeof global.CognitiveNbackScreen !== 'undefined' ? global.CognitiveNbackScreen : null);

        if (!sequence || !activityFactory || !view) return null;

        var screenReady = false;
        if (gameScreen && nbackScreen) {
            try {
                gameScreen.createGameScreen(doc, {
                    gameRoot: doc.getElementById('nbackGame'),
                    ...nbackScreen.createNbackScreenDefinition()
                });
                screenReady = true;
            } catch (error) {
                screenReady = false;
            }
        }
        if (!screenReady && doc.getElementById('nbackImageContainer') === null) return null;
        if (typeof global.syncTopBarCentering === 'function') global.syncTopBarCentering();
        var els = view.createNbackEls(doc);

        var state = {
            n: 1,
            speed: 5,
            isPlaying: false,
            sequence: [],
            currentIndex: -1,
            score: 0,
            totalTrials: 0,
            correctHits: 0,
            correctRejections: 0,
            interval: 0,
            currentItem: null,
            matchPending: false
        };

        var controller = new AbortController();
        var listenOpts = { signal: controller.signal };

        var nbackActivity = activityFactory.create({
            minInterval: 500,
            maxInterval: 3000,
            speedSteps: 10,
            defaultSpeed: state.speed,
            tick: function () { if (state.isPlaying) nextNbackImage(true); },
            onPause: function () { nbackView.syncSessionButton(state.isPlaying, nbackActivity.isRunning()); },
            onResume: function () { nbackView.syncSessionButton(state.isPlaying, nbackActivity.isRunning()); }
        });

        var nbackView = view.createNbackView(doc, els, nbackActivity, 240);

        function buildSequence(length, seedValues) {
            return sequence.generateTrials({
                choices: FOOD_DATA,
                n: state.n,
                length: length,
                matchProbability: sequence.matchProbability,
                cloneValue: function (item) { return { ...item }; },
                keyFor: function (item) { return item.name; },
                seedValues: seedValues || []
            });
        }

        function startNback() {
            if (state.isPlaying) return;
            nbackView.clearTransition();
            state.sequence = buildSequence(50);
            state.currentIndex = 0;
            state.score = 0;
            state.totalTrials = 0;
            state.correctHits = 0;
            state.correctRejections = 0;
            nbackView.setScore(state.score);
            state.isPlaying = true;
            nbackView.syncPlayButton(state.isPlaying);
            state.currentItem = nbackView.commit(state.sequence[0], 0);
            state.matchPending = false;
            nbackActivity.start(state.speed);
        }

        function pauseNback() {
            nbackView.clearTransition();
            nbackActivity.pause();
            state.isPlaying = false;
            nbackView.syncPlayButton(state.isPlaying);
            feedback.clear(els.gridWrapper);
        }
        function resetNback() {
            if (nbackActivity) nbackActivity.stop();
            nbackView.clearTransition();
            state.isPlaying = false;
            state.sequence = [];
            state.currentIndex = -1;
            state.score = 0;
            state.totalTrials = 0;
            state.correctHits = 0;
            state.correctRejections = 0;
            state.currentItem = null;
            state.matchPending = false;
            nbackView.setScore(state.score);
            nbackView.syncPlayButton(state.isPlaying);
            feedback.clear(els.gridWrapper);
        }

        function nextNbackImage(fromTimer = false) {
            let next = state.currentIndex + 1;
            if (next >= state.sequence.length) {
                var tail = [];
                for (var t = Math.max(0, state.sequence.length - state.n); t < state.sequence.length; t++) {
                    tail.push(state.sequence[t].value);
                }
                state.sequence = buildSequence(50, tail);
                next = 0;
            }
            nbackView.showTrial(state.sequence, next, {
                onTrialStart: function () {
                    state.matchPending = true;
                },
                onTrialCommitted: function (item, committedIndex) {
                    state.currentIndex = committedIndex;
                    state.currentItem = item;
                    state.matchPending = false;
                }
            });
        }

        function handleNbackMatch(isMatch) {
            if (state.currentIndex < 0 || state.matchPending || nbackView.isTransitioning()) return;
            if (state.currentIndex < state.n) {
                nbackView.showFeedback(feedback, '還不夠 N 步', 'warn');
                return;
            }
            const actualMatch = Boolean(
                state.sequence[state.currentIndex] &&
                state.sequence[state.currentIndex].isMatch
            );
            const correct = (isMatch === actualMatch);
            state.matchPending = true;
            nbackActivity.hold();

            if (correct) {
                state.score++;
                if (isMatch) state.correctHits++;
                else state.correctRejections++;
                nbackView.showFeedback(feedback, '✅ 正確！', 'correct');
                audio.play('correct');
            } else {
                nbackView.showFeedback(feedback, '❌ 再試一次！', 'wrong');
                audio.play('wrong');
            }
            nbackView.flash(correct);
            state.totalTrials++;
            nbackView.setScore(state.score);

            if (correct) {
                setTimeout(() => {
                    if (state.isPlaying) nextNbackImage(true);
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

        function changeNbackSpeed(delta) {
            let newSpeed = state.speed + delta;
            if (newSpeed < 1) newSpeed = 1;
            if (newSpeed > 10) newSpeed = 10;
            state.speed = newSpeed;
            els.speedDisplay.textContent = newSpeed;
            nbackActivity.setSpeed(newSpeed);
            if (state.isPlaying) {
                nbackActivity.reset();
            }
        }

        function changeNbackN(newN) {
            const wasPlaying = state.isPlaying;
            state.n = newN;
            if (wasPlaying) pauseNback();
            nbackView.showInstruction(message, state.n);
        }

        function destroyNback() {
            if (nbackActivity) nbackActivity.stop();
            nbackView.clearTransition();
            try { controller.abort(); } catch (e) { /* already aborted */ }
            state.isPlaying = false;
        }
        nbackView.bindControls(keyboard, listenOpts, {
            onPlayPause: function () { if (state.isPlaying) { pauseNback(); } else { startNback(); } },
            onImageClick: function () { if (!state.matchPending && !nbackView.isTransitioning()) nextNbackImage(); },
            onMagnify: function () {
                if (state.currentItem && openMagnify) {
                    openMagnify(state.currentItem.image, state.currentItem.name);
                }
            },
            onMatch: function () { handleNbackMatch(true); },
            onNotMatch: function () { handleNbackMatch(false); },
            onSpeedDown: function () { changeNbackSpeed(-1); },
            onSpeedUp: function () { changeNbackSpeed(1); },
            onNChange: function (value) { changeNbackN(parseInt(value, 10)); },
            onBack: function () {
                if (router) {
                    router.goBack();
                } else {
                    els.game.style.display = 'none';
                    pauseNback();
                    if (typeof global.goToMainMenu === 'function') global.goToMainMenu();
                }
            },
            keyboard: {
                j: function () { handleNbackMatch(true); },
                k: function () { handleNbackMatch(false); },
                space: function () { if (!state.matchPending && !nbackView.isTransitioning()) nextNbackImage(); },
                '-': function () { changeNbackSpeed(-1); },
                '=': function () { changeNbackSpeed(1); },
                p: function () { if (state.isPlaying) { pauseNback(); } else { startNback(); } }
            }
        });

        els.speedDisplay.textContent = state.speed;
        els.nSelect.value = state.n;

        function prepareNbackGame() {
            pauseNback();
            nbackView.clearTransition();
            if (state.sequence.length === 0) {
                state.sequence = buildSequence(50);
                state.currentIndex = 0;
                state.currentItem = nbackView.commit(state.sequence[0], 0);
                state.matchPending = false;
                state.score = 0;
                state.totalTrials = 0;
                state.correctHits = 0;
                state.correctRejections = 0;
                nbackView.setScore(state.score);
            }
            els.speedDisplay.textContent = state.speed;
            nbackView.showInstruction(message, state.n);
        }

        if (router) {
            router.defineScreen('nbackGame', {
                enter: prepareNbackGame,
                exit: pauseNback,
                back: 'nbackModeSelect'
            });
        }

        return {
            start: startNback,
            pause: pauseNback,
            reset: resetNback,
            destroy: destroyNback
        };
    }

    var api = {
        mount: mount,
        generateNbackSequence: generateNbackSequence
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveNback = api;
        // Transitional self-mount preserving the original load-time behaviour.
        // Later strangler steps move this call into the router/orchestrator.
        api.mount(document, {
            foodData: window.CognitiveFoodData,
            sequence: window.CognitiveSequence,
            activity: window.CognitiveActivity,
            message: window.CognitiveMessage,
            feedback: window.CognitiveFeedback,
            router: window.CognitiveRouter,
            keyboard: window.CognitiveKeyboard,
            audio: window.CognitiveAudio,
            openMagnify: window.openMagnify,
            view: window.CognitiveNbackView,
            gameScreen: window.CognitiveGameScreen,
            nbackScreen: window.CognitiveNbackScreen
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);