(function (global) {
    'use strict';

    // Manual/auto playback state machine. Manual mode is the paused state:
    // the game module advances by clicking the stage. Auto mode starts the
    // shared CognitiveActivity; the speed control sets its interval.

    var MIN_SPEED = 1;
    var MAX_SPEED = 10;

    function createStroopPlayback(options) {
        options = options || {};
        var activityFactory = options.activity;
        var onAutoAdvance = options.onAutoAdvance || function () {};
        var canAutoAdvance = options.canAutoAdvance || function () { return true; };
        if (!activityFactory || typeof activityFactory.create !== 'function') {
            throw new Error('Stroop playback requires an activity factory');
        }

        var speed = options.defaultSpeed || 5;
        var playing = false;
        var activity = activityFactory.create({
            minInterval: options.minInterval || 1000,
            maxInterval: options.maxInterval || 6000,
            speedSteps: options.speedSteps || 10,
            defaultSpeed: speed,
            tick: function () {
                if (playing && canAutoAdvance()) onAutoAdvance();
            }
        });

        function clamp(value) {
            return Math.max(MIN_SPEED, Math.min(MAX_SPEED, value));
        }

        function start() {
            if (playing) return;
            playing = true;
            activity.start(speed);
        }

        function pause() {
            if (!playing) return;
            playing = false;
            activity.stop();
        }

        function toggle() {
            if (playing) pause();
            else start();
        }

        function stop() {
            playing = false;
            activity.stop();
        }

        function resetTimer() {
            if (playing) activity.reset();
        }

        function setSpeed(delta) {
            speed = clamp(speed + delta);
            activity.setSpeed(speed);
            if (playing) activity.reset();
            return speed;
        }

        return {
            start: start,
            pause: pause,
            toggle: toggle,
            stop: stop,
            resetTimer: resetTimer,
            setSpeed: setSpeed,
            isPlaying: function () { return playing; },
            getSpeed: function () { return speed; }
        };
    }

    var api = { createStroopPlayback: createStroopPlayback };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopPlayback = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopPlayback = api;
})(typeof window !== 'undefined' ? window : globalThis);
