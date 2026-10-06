(function (global) {
    'use strict';

    // Response feedback, scoring and the manual/auto advance rule. In auto
    // mode an answered trial advances after the feedback delay; in manual mode
    // the trial waits for the stage click.

    function createStroopResponse(options) {
        options = options || {};
        var session = options.session;
        var view = options.view;
        var feedback = options.feedback;
        var audio = options.audio;
        var els = options.els;
        var feedbackMs = options.feedbackMs || 600;
        var isPlaying = options.isPlaying || function () { return false; };
        var onAdvance = options.onAdvance || function () {};
        var pending = false;
        var timer = null;

        function clearTimer() {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        }

        function handle(answer) {
            if (!session || !session.canAnswer() || pending) return false;
            pending = true;
            var result = session.answer(answer);
            if (!result) {
                pending = false;
                return false;
            }
            if (result.correct) {
                view.setScore(els, session.score());
                if (audio && typeof audio.play === 'function') audio.play('correct');
                if (feedback) feedback.show(els.stage, '✅ 正確', 'correct');
                view.flashStage(els, true);
            } else {
                if (audio && typeof audio.play === 'function') audio.play('wrong');
                if (feedback) feedback.show(els.stage, '❌ 不正確', 'wrong');
                view.flashStage(els, false);
            }
            clearTimer();
            timer = setTimeout(function () {
                timer = null;
                pending = false;
                if (isPlaying()) onAdvance();
            }, feedbackMs);
            return true;
        }

        function destroy() {
            clearTimer();
            pending = false;
        }

        return {
            handle: handle,
            isPending: function () { return pending; },
            destroy: destroy
        };
    }

    var api = { createStroopResponse: createStroopResponse };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopResponse = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopResponse = api;
})(typeof window !== 'undefined' ? window : globalThis);
