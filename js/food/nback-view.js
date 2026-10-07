(function (global) {
    'use strict';

    // =============================================================
    // N-back 記憶遊戲 — view/presenter (UI layer)
    // =============================================================
    //
    // Owns every direct DOM interaction of the N-back screen: element lookup,
    // image presentation state machine (enter/exit transition + feedback
    // flash + DOM commit), score/feedback/instruction display, and control
    // binding (buttons, selects, keyboard). The mount keeps lifecycle and
    // game logic and delegates UI here via callbacks.

    var DEFAULT_TRANSITION_MS = 240;
    var DEFAULT_FLASH_MS = 600;

    function createNbackEls(doc) {
        var $ = function (id) { return doc.getElementById(id); };
        return {
            image: $('nbackImage'),
            gridWrapper: $('nbackGridWrapper'),
            overlay: $('nbackOverlay'),
            stepLabel: $('nbackStepLabel'),
            scoreNum: $('nbackScoreNum'),
            playBtn: $('nbackPlayBtn'),
            speedDisplay: $('nbackSpeedDisplay'),
            speedDown: $('nbackSpeedDown'),
            speedUp: $('nbackSpeedUp'),
            matchBtn: $('nbackMatchBtn'),
            notMatchBtn: $('nbackNotMatchBtn'),
            imageContainer: $('nbackImageContainer'),
            nSelect: $('nbackNSelect'),
            contentModeSelect: $('nbackContentModeSelect'),
            backBtn: $('nbackBackBtn'),
            magnifyBtn: $('nbackMagnifyBtn'),
            game: $('nbackGame')
        };
    }

    function createNbackView(doc, els, activity, transitionMs) {
        transitionMs = transitionMs || DEFAULT_TRANSITION_MS;
        var animationToken = 0;
        var transitionTimer = null;
        var imageTimer = null;
        var transitioning = false;

        function isTransitioning() {
            return transitioning;
        }

        function clearTransition() {
            animationToken++;
            if (transitionTimer) {
                clearTimeout(transitionTimer);
                transitionTimer = null;
            }
            if (els.imageContainer) {
                els.imageContainer.classList.remove('is-exiting', 'is-entering');
            }
            transitioning = false;
        }

        function commit(trial, index) {
            const item = trial && trial.value ? trial.value : trial;
            els.image.style.display = 'block';
            els.magnifyBtn.style.display = 'flex';
            els.image.style.backgroundColor = 'transparent';
            els.image.src = item.image;
            els.image.alt = '';
            els.image.setAttribute('aria-label', item.name);
            els.overlay.style.opacity = 0;
            els.overlay.textContent = '';
            els.stepLabel.textContent = `#${index + 1}`;
            return item;
        }

        // Full enter/exit transition for a trial. The caller's callbacks run at
        // the same points the original inline logic mutated game state:
        //   onTrialStart()      - when the exit animation begins (locks input)
        //   onTrialCommitted(item, index) - when the new image is shown
        function showTrial(sequence, index, callbacks) {
            callbacks = callbacks || {};
            if (transitioning) return;
            if (activity) activity.hold();
            transitioning = true;
            if (callbacks.onTrialStart) callbacks.onTrialStart();
            const token = ++animationToken;
            els.imageContainer.classList.remove('is-entering');
            els.imageContainer.classList.add('is-exiting');
            transitionTimer = setTimeout(function () {
                if (token !== animationToken) return;
                const trial = sequence[index];
                els.imageContainer.classList.remove('is-exiting');
                els.imageContainer.classList.add('is-entering');
                const item = commit(trial, index);
                if (callbacks.onTrialCommitted) callbacks.onTrialCommitted(item, index);
                transitionTimer = setTimeout(function () {
                    if (token !== animationToken) return;
                    els.imageContainer.classList.remove('is-entering');
                    transitioning = false;
                    if (callbacks.onTransitionEnd) callbacks.onTransitionEnd();
                }, transitionMs);
                if (activity) activity.reset();
            }, transitionMs);
        }

        // 回饋燈光落在遊戲圖片容器上（而非按鈕）
        function flash(correct) {
            clearTimeout(imageTimer);
            els.imageContainer.classList.remove('feedback-correct', 'feedback-wrong');
            void els.imageContainer.offsetWidth;
            els.imageContainer.classList.add(correct ? 'feedback-correct' : 'feedback-wrong');
            imageTimer = setTimeout(function () {
                els.imageContainer.classList.remove('feedback-correct', 'feedback-wrong');
            }, DEFAULT_FLASH_MS);
        }

        function setScore(score) {
            els.scoreNum.textContent = score;
        }

        function showFeedback(feedback, text, kind) {
            feedback.show(els.gridWrapper, text, kind);
        }

        function showInstruction(message, n, mode) {
            var title = `看看圖片與上 ${n} 張是否相同`;
            if (mode === 'faceIdentity') {
                title = `看看是否與上 ${n} 張為同一個人`;
            } else if (mode === 'faceExpression') {
                title = `看看表情是否與上 ${n} 張相同`;
            }
            message.show({
                title: title,
                subtitle: '',
                extraLarge: true,
                pauseTimer: false
            });
        }

        function syncPlayButton(playing) {
            els.playBtn.classList.toggle('playing', playing);
        }

        function syncSessionButton(playing, isRunning) {
            els.playBtn.classList.toggle('playing', playing && isRunning);
        }

        // Binds every button/select + the keyboard screen. Handlers are mount
        // closures; listenOpts carries the AbortSignal owned by the mount.
        function bindControls(keyboard, listenOpts, handlers) {
            handlers = handlers || {};
            if (els.playBtn) {
                els.playBtn.addEventListener('click', function () {
                    if (handlers.onPlayPause) handlers.onPlayPause();
                }, listenOpts);
            }
            if (els.imageContainer) {
                els.imageContainer.addEventListener('click', function () {
                    if (handlers.onImageClick) handlers.onImageClick();
                }, listenOpts);
            }
            if (els.magnifyBtn) {
                els.magnifyBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (handlers.onMagnify) handlers.onMagnify();
                }, listenOpts);
            }
            if (els.matchBtn) {
                els.matchBtn.addEventListener('click', function () {
                    if (handlers.onMatch) handlers.onMatch();
                }, listenOpts);
            }
            if (els.notMatchBtn) {
                els.notMatchBtn.addEventListener('click', function () {
                    if (handlers.onNotMatch) handlers.onNotMatch();
                }, listenOpts);
            }
            if (els.speedDown) {
                els.speedDown.addEventListener('click', function () {
                    if (handlers.onSpeedDown) handlers.onSpeedDown();
                }, listenOpts);
            }
            if (els.speedUp) {
                els.speedUp.addEventListener('click', function () {
                    if (handlers.onSpeedUp) handlers.onSpeedUp();
                }, listenOpts);
            }
            if (els.nSelect) {
                els.nSelect.addEventListener('change', function () {
                    if (handlers.onNChange) handlers.onNChange(els.nSelect.value);
                }, listenOpts);
            }
            if (els.contentModeSelect) {
                els.contentModeSelect.addEventListener('change', function () {
                    if (handlers.onContentModeChange) handlers.onContentModeChange(els.contentModeSelect.value);
                }, listenOpts);
            }
            if (els.backBtn) {
                els.backBtn.addEventListener('click', function () {
                    if (handlers.onBack) handlers.onBack();
                }, listenOpts);
            }
            if (keyboard) {
                keyboard.registerScreen('nbackGame', handlers.keyboard || {});
            }
        }

        return {
            isTransitioning: isTransitioning,
            clearTransition: clearTransition,
            commit: commit,
            showTrial: showTrial,
            flash: flash,
            setScore: setScore,
            showFeedback: showFeedback,
            showInstruction: showInstruction,
            syncPlayButton: syncPlayButton,
            syncSessionButton: syncSessionButton,
            bindControls: bindControls
        };
    }

    var api = {
        createNbackEls: createNbackEls,
        createNbackView: createNbackView
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveNbackView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
