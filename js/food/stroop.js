(function (global) {
    'use strict';

    // Emotional face-word Stroop lifecycle. Single face-target game: judge the
    // face and ignore the word. Pure trial generation lives in stroop-logic.js,
    // session state in stroop-session.js, playback in stroop-playback.js,
    // response policy in stroop-response.js, DOM in stroop-view.js.

    var TRIAL_COUNT = 48;

    function mount(root, deps) {
        deps = deps || {};
        var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.getElementById !== 'function') return null;

        var faceSet = deps.faceSet || global.CognitiveCelebrityFaces;
        var logic = deps.logic || global.CognitiveStroopLogic;
        var sessionFactory = deps.session || global.CognitiveStroopSession;
        var screen = deps.screen || global.CognitiveStroopScreen;
        var playbackFactory = deps.playback || global.CognitiveStroopPlayback;
        var responseFactory = deps.response || global.CognitiveStroopResponse;
        var view = deps.view || global.CognitiveStroopView;
        var gameScreen = deps.gameScreen || global.CognitiveGameScreen;
        var activityFactory = deps.activity || global.CognitiveActivity;
        var message = deps.message || global.CognitiveMessage;
        var feedback = deps.feedback || global.CognitiveFeedback;
        var router = deps.router || global.CognitiveRouter;
        var keyboard = deps.keyboard || global.CognitiveKeyboard;
        var audio = deps.audio || global.CognitiveAudio;

        if (!faceSet || !logic || !sessionFactory || !screen || !playbackFactory || !responseFactory ||
            !view || !gameScreen || !activityFactory) return null;
        var gameRoot = doc.getElementById('stroopGame');
        if (!gameRoot) return null;

        gameScreen.createGameScreen(doc, Object.assign({
            gameRoot: gameRoot
        }, screen.createStroopScreenDefinition()));
        var els = view.createStroopEls(doc);
        if (!els.stage || !els.face || !els.word || !els.positiveBtn || !els.negativeBtn || !els.playBtn) return null;

        var controller = new AbortController();
        var state = { session: null, response: null };
        var playback = playbackFactory.createStroopPlayback({
            activity: activityFactory,
            minInterval: 1000,
            maxInterval: 6000,
            speedSteps: 10,
            defaultSpeed: 5,
            canAutoAdvance: function () { return !state.response || !state.response.isPending(); },
            onAutoAdvance: function () { nextTrial({ recordTimeout: true }); }
        });

        function syncPlayButton() { view.syncPlayButton(els, playback.isPlaying()); }
        function syncSpeed() { view.setSpeed(els, playback.getSpeed()); }
        function buildSequence() {
            return logic.buildStroopSequence({
                faces: faceSet.listFaces(),
                count: TRIAL_COUNT,
                random: Math.random
            });
        }
        function clearFeedbackOnly() { if (feedback) feedback.clear(els.stage); view.clearFlash(els); }
        function clearStage() { clearFeedbackOnly(); view.clearStroopStage(els); }
        function resetSession() {
            return sessionFactory.createStroopSession({ logic: logic, sequence: buildSequence() });
        }
        function createResponseController() {
            return responseFactory.createStroopResponse({
                session: state.session,
                view: view,
                feedback: feedback,
                audio: audio,
                els: els,
                isPlaying: function () { return playback.isPlaying(); },
                onAdvance: function () { nextTrial({ recordTimeout: false }); }
            });
        }
        function finishRound() {
            if (state.response) state.response.destroy();
            playback.stop();
            syncPlayButton();
            clearStage();
            view.showRoundComplete(message, state.session ? state.session.score() : 0, TRIAL_COUNT, startStroop, function () {
                if (router) router.goBack();
            });
        }
        function nextTrial(options) {
            if (!state.session) return;
            var trial = state.session.advance(options);
            if (!trial) { finishRound(); return; }
            view.renderStroopTrial(els, trial);
            clearFeedbackOnly();
            playback.resetTimer();
        }
        function prepareStroop() {
            state.session = resetSession();
            if (state.response) state.response.destroy();
            state.response = createResponseController();
            playback.stop();
            view.setScore(els, 0);
            syncSpeed();
            syncPlayButton();
            nextTrial({ recordTimeout: false });
        }
        function startStroop() {
            if (playback.isPlaying()) return;
            state.session = resetSession();
            if (state.response) state.response.destroy();
            state.response = createResponseController();
            view.setScore(els, 0);
            syncSpeed();
            playback.start();
            syncPlayButton();
            nextTrial({ recordTimeout: false });
        }
        function pauseStroop() {
            playback.pause();
            if (state.response) state.response.destroy();
            syncPlayButton();
            clearFeedbackOnly();
        }
        function resetStroop() {
            pauseStroop();
            if (state.session) state.session.reset([]);
            state.response = null;
            view.setScore(els, 0);
            clearStage();
        }
        function destroyStroop() {
            if (state.response) state.response.destroy();
            playback.stop();
            try { controller.abort(); } catch (error) { /* already aborted */ }
        }
        function changeSpeed(delta) { view.setSpeed(els, playback.setSpeed(delta)); }
        function togglePlay() { if (playback.isPlaying()) pauseStroop(); else startStroop(); }
        function advanceManually() {
            if (state.response && state.response.isPending()) return;
            nextTrial({ recordTimeout: false });
        }
        function onEnterGame() {
            prepareStroop();
            view.showIntro(message);
        }

        var listenOptions = { signal: controller.signal };
        view.bindStroopControls(els, keyboard, listenOptions, {
            onBack: function () { if (router) router.goBack(); },
            onPlayPause: togglePlay,
            onSpeed: changeSpeed,
            onPositive: function () { if (state.response) state.response.handle('positive'); },
            onNegative: function () { if (state.response) state.response.handle('negative'); },
            onAdvance: advanceManually,
            keyboard: {
                j: function () { if (state.response) state.response.handle('positive'); },
                k: function () { if (state.response) state.response.handle('negative'); },
                space: advanceManually,
                '-': function () { changeSpeed(-1); },
                '=': function () { changeSpeed(1); },
                p: togglePlay
            }
        });

        if (router) {
            router.defineScreen('stroopGame', {
                enter: onEnterGame,
                exit: pauseStroop,
                back: 'mainMenu'
            });
        }

        syncSpeed();
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
        window.CognitiveGames.register({
            id: 'stroop',
            title: '情緒反應',
            icon: '🎭',
            entryRoute: 'stroopGame',
            buttonId: 'gameStroopBtn',
            menuOrder: 7
        });
        if (global.CognitiveStroopScreen && global.CognitiveGameScreen) {
            api.mount(document, {
                faceSet: global.CognitiveCelebrityFaces,
                logic: global.CognitiveStroopLogic,
                session: global.CognitiveStroopSession,
                screen: global.CognitiveStroopScreen,
                playback: global.CognitiveStroopPlayback,
                response: global.CognitiveStroopResponse,
                view: global.CognitiveStroopView,
                gameScreen: global.CognitiveGameScreen,
                activity: global.CognitiveActivity,
                message: global.CognitiveMessage,
                feedback: global.CognitiveFeedback,
                router: global.CognitiveRouter,
                keyboard: global.CognitiveKeyboard,
                audio: global.CognitiveAudio
            });
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
