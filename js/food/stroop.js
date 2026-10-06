(function (global) {
    'use strict';

    // Emotional face-word Stroop. Pure trial generation lives in
    // stroop-logic.js, session state in stroop-session.js and all direct DOM
    // interaction in stroop-view.js; this module owns lifecycle and pacing.

    var MEASURED_TRIALS = 48;
    var PRACTICE_TRIALS = 6;
    var FEEDBACK_MS = 600;
    var MIN_SPEED = 1;
    var MAX_SPEED = 10;

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.getElementById !== 'function') return null;

        var faceSet = deps.faceSet || global.CognitiveCelebrityFaces;
        var logic = deps.logic || global.CognitiveStroopLogic;
        var sessionFactory = deps.session || global.CognitiveStroopSession;
        var screen = deps.stroopScreen || global.CognitiveStroopScreen;
        var view = deps.view || global.CognitiveStroopView;
        var gameScreen = deps.gameScreen || global.CognitiveGameScreen;
        var activityFactory = deps.activity || global.CognitiveActivity;
        var message = deps.message || global.CognitiveMessage;
        var feedback = deps.feedback || global.CognitiveFeedback;
        var router = deps.router || global.CognitiveRouter;
        var keyboard = deps.keyboard || global.CognitiveKeyboard;
        var prefs = deps.prefs || global.CognitivePrefs;
        var audio = deps.audio || global.CognitiveAudio;

        if (!faceSet || !logic || !sessionFactory || !screen || !view || !gameScreen || !activityFactory) return null;
        var gameRoot = doc.getElementById('stroopGame');
        if (!gameRoot) return null;

        gameScreen.createGameScreen(doc, Object.assign({
            gameRoot: gameRoot
        }, screen.createStroopScreenDefinition()));
        var els = view.createStroopEls(doc);
        if (!els.stage || !els.face || !els.word || !els.positiveBtn || !els.negativeBtn || !els.playBtn) return null;

        var controller = new AbortController();
        var state = {
            mode: 'face',
            speed: 5,
            isPlaying: false,
            session: null,
            advanceHandle: null
        };

        function clampSpeed(value) {
            return Math.max(MIN_SPEED, Math.min(MAX_SPEED, value));
        }

        var saved = prefs && typeof prefs.load === 'function' ? prefs.load('cognitiveStroopPrefs') : null;
        if (saved) {
            if (logic.STROOP_MODES.indexOf(saved.mode) !== -1) state.mode = saved.mode;
            if (typeof saved.speed === 'number') state.speed = clampSpeed(saved.speed);
        }

        var activity = activityFactory.create({
            minInterval: 1500,
            maxInterval: 5000,
            speedSteps: 10,
            defaultSpeed: state.speed,
            speedToInterval: logic.windowMsForSpeed,
            tick: function () {
                if (state.isPlaying) nextTrial();
            }
        });

        function savePrefs() {
            if (prefs && typeof prefs.save === 'function') {
                prefs.save('cognitiveStroopPrefs', { mode: state.mode, speed: state.speed });
            }
        }

        function syncPlayButton() {
            view.syncPlayButton(els, state.isPlaying);
        }

        function clearAdvance() {
            if (state.advanceHandle !== null) {
                clearTimeout(state.advanceHandle);
                state.advanceHandle = null;
            }
        }

        function buildSequence() {
            return logic.buildStroopSequence({
                faces: faceSet.listFaces(),
                mode: state.mode,
                measuredCount: MEASURED_TRIALS,
                practiceCount: PRACTICE_TRIALS,
                random: Math.random
            });
        }

        function clearStage() {
            if (feedback) feedback.clear(els.stage);
            view.clearFlash(els);
            view.clearStroopStage(els);
        }

        function finishRound() {
            activity.stop();
            state.isPlaying = false;
            syncPlayButton();
            clearStage();
            if (message) {
                message.show({
                    icon: '🏆',
                    title: '本回完成',
                    subtitle: '答對 ' + state.session.score() + ' / ' + MEASURED_TRIALS + ' 題',
                    buttons: [
                        { text: '再玩一次', className: 'btn-stay', action: startStroop },
                        { text: '返回', className: 'btn-stay', action: function () { if (router) router.goBack(); } }
                    ],
                    pauseTimer: false
                });
            }
        }
        function nextTrial() {
            if (!state.isPlaying || !state.session) return;
            clearAdvance();
            var trial = state.session.advance();
            if (!trial) {
                finishRound();
                return;
            }
            view.renderStroopTrial(els, trial);
            if (feedback) feedback.clear(els.stage);
            view.clearFlash(els);
            activity.reset();
        }

        function handleResponse(answer) {
            if (!state.isPlaying || !state.session || !state.session.canAnswer()) return;
            activity.pause();
            var result = state.session.answer(answer);
            if (!result) return;
            if (result.correct) {
                if (result.trial.phase === 'measured') view.setScore(els, state.session.score());
                if (audio && typeof audio.play === 'function') audio.play('correct');
                if (feedback) feedback.show(els.stage, '✅ 正確！', 'correct');
                view.flashStage(els, true);
            } else {
                if (audio && typeof audio.play === 'function') audio.play('wrong');
                if (feedback) feedback.show(els.stage, '❌ 再試一次！', 'wrong');
                view.flashStage(els, false);
            }
            clearAdvance();
            state.advanceHandle = setTimeout(function () {
                state.advanceHandle = null;
                if (state.isPlaying) nextTrial();
            }, FEEDBACK_MS);
        }

        function startStroop() {
            if (state.isPlaying) return;
            state.session = sessionFactory.createStroopSession({
                logic: logic,
                mode: state.mode,
                sequence: buildSequence()
            });
            view.setScore(els, 0);
            view.setRuleText(els, state.mode);
            view.setSpeed(els, state.speed);
            clearStage();
            state.isPlaying = true;
            syncPlayButton();
            activity.start(state.speed);
            nextTrial();
        }

        function pauseStroop() {
            clearAdvance();
            activity.stop();
            state.isPlaying = false;
            syncPlayButton();
            clearStage();
        }

        function resetStroop() {
            pauseStroop();
            if (state.session) state.session.reset([]);
            view.setScore(els, 0);
        }

        function destroyStroop() {
            clearAdvance();
            activity.stop();
            try { controller.abort(); } catch (error) { /* already aborted */ }
            state.isPlaying = false;
        }

        function changeSpeed(delta) {
            state.speed = clampSpeed(state.speed + delta);
            view.setSpeed(els, state.speed);
            activity.setSpeed(state.speed);
            savePrefs();
            if (state.isPlaying && state.session && state.session.canAnswer()) activity.reset();
        }

        function togglePlay() {
            if (state.isPlaying) pauseStroop();
            else startStroop();
        }

        function setMode(mode) {
            if (logic.STROOP_MODES.indexOf(mode) === -1 || mode === state.mode) return;
            state.mode = mode;
            view.setRuleText(els, state.mode);
            savePrefs();
            if (state.isPlaying) {
                pauseStroop();
                startStroop();
            }
        }

        function onRuleTextClick(event) {
            if (event && event.stopPropagation) event.stopPropagation();
            view.showModeSwitch(message, state.mode, setMode);
        }

        function showIntro() {
            view.showIntro(message, state.mode);
        }

        function onEnter() {
            startStroop();
            showIntro();
        }

        var listenOptions = { signal: controller.signal };
        if (els.backBtn) els.backBtn.addEventListener('click', function () { if (router) router.goBack(); }, listenOptions);
        els.playBtn.addEventListener('click', togglePlay, listenOptions);
        if (els.speedDown) els.speedDown.addEventListener('click', function () { changeSpeed(-1); }, listenOptions);
        if (els.speedUp) els.speedUp.addEventListener('click', function () { changeSpeed(1); }, listenOptions);
        els.positiveBtn.addEventListener('click', function () { handleResponse('positive'); }, listenOptions);
        els.negativeBtn.addEventListener('click', function () { handleResponse('negative'); }, listenOptions);
        if (els.ruleText) els.ruleText.addEventListener('click', onRuleTextClick, listenOptions);

        if (keyboard) {
            keyboard.registerScreen('stroopGame', {
                j: function () { handleResponse('positive'); },
                k: function () { handleResponse('negative'); },
                '-': function () { changeSpeed(-1); },
                '=': function () { changeSpeed(1); },
                p: togglePlay
            });
        }

        if (router) {
            router.defineScreen('stroopGame', {
                enter: onEnter,
                exit: pauseStroop,
                back: 'home'
            });
        }

        view.setRuleText(els, state.mode);
        view.setSpeed(els, state.speed);
        view.setScore(els, 0);
        clearStage();

        return {
            start: startStroop,
            pause: pauseStroop,
            reset: resetStroop,
            destroy: destroyStroop
        };
    }

    var api = { mount: mount };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') {
        window.CognitiveStroop = api;
        // Direct home-tile game (like palm and n-back), not a registry game.
        if (global.CognitiveStroopScreen && global.CognitiveGameScreen) {
            api.mount(document, {
                faceSet: global.CognitiveCelebrityFaces,
                logic: global.CognitiveStroopLogic,
                session: global.CognitiveStroopSession,
                stroopScreen: global.CognitiveStroopScreen,
                view: global.CognitiveStroopView,
                gameScreen: global.CognitiveGameScreen,
                activity: global.CognitiveActivity,
                message: global.CognitiveMessage,
                feedback: global.CognitiveFeedback,
                router: global.CognitiveRouter,
                keyboard: global.CognitiveKeyboard,
                prefs: global.CognitivePrefs,
                audio: global.CognitiveAudio
            });
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
