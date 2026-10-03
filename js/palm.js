(function (global) {
    'use strict';

    var LEFT_ALL_GESTURES = [
        'assets/gestures/left/rock.webp',
        'assets/gestures/left/paper.webp',
        'assets/gestures/left/scissors.webp',
        'assets/gestures/left/thumbsup.webp',
        'assets/gestures/left/thumbsdown.webp',
        'assets/gestures/left/four.webp',
        'assets/gestures/left/ok.webp',
        'assets/gestures/left/gun.webp'
    ];
    var RIGHT_ALL_GESTURES = [
        'assets/gestures/right/rock.webp',
        'assets/gestures/right/paper.webp',
        'assets/gestures/right/scissors.webp',
        'assets/gestures/right/thumbsup.webp',
        'assets/gestures/right/thumbsdown.webp',
        'assets/gestures/right/four.webp',
        'assets/gestures/right/ok.webp',
        'assets/gestures/right/gun.webp'
    ];
    var LEFT_EASY_GESTURES = [
        'assets/gestures/left/rock.webp',
        'assets/gestures/left/paper.webp',
        'assets/gestures/left/scissors.webp'
    ];
    var RIGHT_EASY_GESTURES = [
        'assets/gestures/right/rock.webp',
        'assets/gestures/right/paper.webp',
        'assets/gestures/right/scissors.webp'
    ];
    var LEFT_PALMAR_ALL_GESTURES = [
        'assets/gestures/left/palmar_rock.webp',
        'assets/gestures/left/palmar_paper.webp',
        'assets/gestures/left/palmar_scissors.webp',
        'assets/gestures/left/palmar_four.webp',
        'assets/gestures/left/palmar_ok.webp',
        'assets/gestures/left/palmar_gun.webp'
    ];
    var RIGHT_PALMAR_ALL_GESTURES = [
        'assets/gestures/right/palmar_rock.webp',
        'assets/gestures/right/palmar_paper.webp',
        'assets/gestures/right/palmar_scissors.webp',
        'assets/gestures/right/palmar_four.webp',
        'assets/gestures/right/palmar_ok.webp',
        'assets/gestures/right/palmar_gun.webp'
    ];
    var LEFT_PALMAR_EASY_GESTURES = [
        'assets/gestures/left/palmar_rock.webp',
        'assets/gestures/left/palmar_paper.webp',
        'assets/gestures/left/palmar_scissors.webp'
    ];
    var RIGHT_PALMAR_EASY_GESTURES = [
        'assets/gestures/right/palmar_rock.webp',
        'assets/gestures/right/palmar_paper.webp',
        'assets/gestures/right/palmar_scissors.webp'
    ];

    function createPalm(deps) {
        deps = deps || {};

        function mount(root, mountDeps) {
            mountDeps = mountDeps || {};
            var doc = (root && root.ownerDocument) || root ||
                (typeof document !== 'undefined' ? document : null);
            if (!doc) return null;

            var palmScreen = mountDeps.palmScreen || deps.palmScreen ||
                (typeof global.CognitivePalmScreen !== 'undefined' ? global.CognitivePalmScreen : null);
            var gameScreen = mountDeps.gameScreen || deps.gameScreen ||
                (typeof global.CognitiveGameScreen !== 'undefined' ? global.CognitiveGameScreen : null);
            var activityFactory = mountDeps.activity || deps.activity ||
                (typeof global.CognitiveActivity !== 'undefined' ? global.CognitiveActivity : null);
            var router = mountDeps.router || deps.router ||
                (typeof global.CognitiveRouter !== 'undefined' ? global.CognitiveRouter : null);
            var keyboard = mountDeps.keyboard || deps.keyboard ||
                (typeof global.CognitiveKeyboard !== 'undefined' ? global.CognitiveKeyboard : null);
            var message = mountDeps.message || deps.message ||
                (typeof global.CognitiveMessage !== 'undefined' ? global.CognitiveMessage : null);
            var settingsStore = mountDeps.settingsStore || deps.settingsStore ||
                (typeof global.CognitiveSettingsStore !== 'undefined' ? global.CognitiveSettingsStore : null);
            if (!palmScreen || !gameScreen || !activityFactory) return null;

            var gameRoot = doc.getElementById('palm');
            if (!gameRoot) return null;

            var screen = gameScreen.createGameScreen(doc, {
                gameRoot: gameRoot,
                ...palmScreen.createPalmScreenDefinition()
            });
            var els = screen.els;

            var leftEl = els.leftGesture;
            var rightEl = els.rightGesture;
            var swapBtn = els.swapBtn;
            var difficultySelect = els.difficultySelect;
            var handSelect = els.handSelect;
            var playBtn = els.playBtn;
            var speedDisplay = els.speedDisplay;
            var speedUp = els.speedUp;
            var speedDown = els.speedDown;
            var leftSide = els.leftSide;
            var rightSide = els.rightSide;
            var backBtn = els.palmBackBtn;
            if (!leftEl || !rightEl || !swapBtn || !difficultySelect || !handSelect ||
                !playBtn || !speedDisplay || !speedUp || !speedDown || !leftSide || !rightSide ||
                !backBtn) {
                return null;
            }

            var palmGrid = els.palmGrid || gameRoot.querySelector('.grid-wrapper');
            var palmBoard = gameRoot.querySelector('.game-board');

            var currentDifficulty = 'hard';
            var currentHand = 'both';
            var leftGestures = LEFT_ALL_GESTURES;
            var rightGestures = RIGHT_ALL_GESTURES;
            var lastLeft = null;
            var lastRight = null;
            var currentLeft = null;
            var currentRight = null;
            var isPlaying = false;
            var speedLevel = 5;
            var initialized = false;

            var palmActivity = activityFactory.create({
                speedToInterval: function (level) {
                    var mapping = { 1: 7000, 2: 6000, 3: 5000, 4: 4000, 5: 3500, 6: 3000, 7: 2500, 8: 2000, 9: 1500, 10: 1000 };
                    return mapping[level] || 3500;
                },
                defaultSpeed: 5,
                tick: function () { if (isPlaying) updateGame(); }
            });

            var controller = new AbortController();
            var listenOpts = { signal: controller.signal };
            var palmResizeObserver = null;

            function randomGesture(arr) {
                return arr[Math.floor(Math.random() * arr.length)];
            }

            function setGesture(element, path, side) {
                element.innerHTML = '';
                var img = doc.createElement('img');
                img.src = path;
                img.alt = '手勢';
                img.onerror = function () {
                    element.innerHTML =
                        '<div class="error-text">❌ 載入失敗<br><span style="font-size:1rem;">' + path + '</span></div>';
                    if (side === 'left') {
                        currentLeft = null;
                    } else {
                        currentRight = null;
                    }
                };
                element.appendChild(img);
                if (side === 'left') {
                    currentLeft = path;
                } else {
                    currentRight = path;
                }
            }

            function updateGame() {
                var newLeft;
                var newRight;
                var attempts = 0;
                var maxAttempts = 50;
                do {
                    newLeft = randomGesture(leftGestures);
                    attempts++;
                } while (newLeft === lastLeft && attempts < maxAttempts);
                attempts = 0;
                do {
                    newRight = randomGesture(rightGestures);
                    attempts++;
                } while (newRight === lastRight && attempts < maxAttempts);
                lastLeft = newLeft;
                lastRight = newRight;
                setGesture(leftEl, newLeft, 'left');
                setGesture(rightEl, newRight, 'right');
            }

            function mirrorGesturePath(filePath, side) {
                var parts = filePath.split('/');
                parts[parts.length - 2] = side;
                return parts.join('/');
            }

            function swapGestures() {
                if (currentLeft === null || currentRight === null) return;
                // Move the exact gesture variant, including palmar/backhand, to the other side.
                var newLeftPath = mirrorGesturePath(currentRight, 'left');
                var newRightPath = mirrorGesturePath(currentLeft, 'right');
                setGesture(leftEl, newLeftPath, 'left');
                setGesture(rightEl, newRightPath, 'right');
                lastLeft = newLeftPath;
                lastRight = newRightPath;
                restartTimerIfPlaying();
            }

            function updateGestureLists() {
                var isEasy = currentDifficulty === 'easy';
                var isPalmar = currentHand === 'palmar';
                var leftBase;
                var rightBase;
                if (isPalmar) {
                    if (isEasy) {
                        leftBase = LEFT_PALMAR_EASY_GESTURES;
                        rightBase = RIGHT_PALMAR_EASY_GESTURES;
                    } else {
                        leftBase = LEFT_PALMAR_ALL_GESTURES.concat([
                            'assets/gestures/left/thumbsup.webp',
                            'assets/gestures/left/thumbsdown.webp'
                        ]);
                        rightBase = RIGHT_PALMAR_ALL_GESTURES.concat([
                            'assets/gestures/right/thumbsup.webp',
                            'assets/gestures/right/thumbsdown.webp'
                        ]);
                    }
                } else {
                    var leftNonPalmar = isEasy ? LEFT_EASY_GESTURES : LEFT_ALL_GESTURES;
                    var rightNonPalmar = isEasy ? RIGHT_EASY_GESTURES : RIGHT_ALL_GESTURES;
                    var leftPalmar = isEasy ? LEFT_PALMAR_EASY_GESTURES : LEFT_PALMAR_ALL_GESTURES;
                    var rightPalmar = isEasy ? RIGHT_PALMAR_EASY_GESTURES : RIGHT_PALMAR_ALL_GESTURES;
                    leftBase = leftNonPalmar.concat(leftPalmar);
                    rightBase = rightNonPalmar.concat(rightPalmar);
                }
                leftGestures = leftBase;
                rightGestures = rightBase;
            }

            function startAutoPlay() {
                if (isPlaying) return;
                isPlaying = true;
                playBtn.classList.add('playing');
                updateGame();
                palmActivity.start(speedLevel);
            }

            function stopAutoPlay() {
                if (!isPlaying) return;
                isPlaying = false;
                playBtn.classList.remove('playing');
                palmActivity.stop();
            }

            function togglePlay() {
                if (isPlaying) {
                    stopAutoPlay();
                } else {
                    startAutoPlay();
                }
            }

            function restartTimerIfPlaying() {
                if (!isPlaying) return;
                palmActivity.reset();
            }

            function changeSpeed(delta) {
                var newLevel = speedLevel + delta;
                if (newLevel >= 1 && newLevel <= 10) {
                    speedLevel = newLevel;
                    speedDisplay.textContent = speedLevel;
                    palmActivity.setSpeed(speedLevel);
                    restartTimerIfPlaying();
                }
            }

            function switchImageManually() {
                updateGame();
                restartTimerIfPlaying();
            }

            function syncPalmLayout() {
                if (!palmGrid || !palmBoard) return;
                var rect = palmGrid.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                var gap = 14;
                var useRow = rect.width >= rect.height;
                var side = useRow
                    ? Math.min((rect.width - gap) / 2, rect.height)
                    : Math.min(rect.width, (rect.height - gap) / 2);
                side = Math.max(0, Math.floor(side));
                palmBoard.style.setProperty('--palm-dir', useRow ? 'row' : 'column');
                palmBoard.style.setProperty('--palm-side', side + 'px');
            }

            function savePalmPrefs() {
                if (!settingsStore) return;
                settingsStore.save(settingsStore.keys.palm, {
                    difficulty: currentDifficulty,
                    hand: currentHand
                });
            }

            difficultySelect.addEventListener('change', function () {
                currentDifficulty = difficultySelect.value;
                savePalmPrefs();
                updateGestureLists();
                lastLeft = null;
                lastRight = null;
                updateGame();
                restartTimerIfPlaying();
            }, listenOpts);

            handSelect.addEventListener('change', function () {
                currentHand = handSelect.value;
                savePalmPrefs();
                updateGestureLists();
                lastLeft = null;
                lastRight = null;
                updateGame();
                restartTimerIfPlaying();
            }, listenOpts);

            swapBtn.addEventListener('click', swapGestures, listenOpts);
            playBtn.addEventListener('click', togglePlay, listenOpts);
            leftSide.addEventListener('click', switchImageManually, listenOpts);
            rightSide.addEventListener('click', switchImageManually, listenOpts);
            speedUp.addEventListener('click', function () {
                changeSpeed(1);
            }, listenOpts);
            speedDown.addEventListener('click', function () {
                changeSpeed(-1);
            }, listenOpts);
            // Palm has no settings screen, so back means "return to the previous
            // screen". goBack() pops the router stack and falls back to the
            // 'back' target declared in defineScreen ('home'), which is the same
            // path the generic [data-app-back] buttons take.
            backBtn.addEventListener('click', function () {
                if (router && typeof router.goBack === 'function') {
                    router.goBack();
                }
            }, listenOpts);

            if (keyboard) {
                keyboard.registerScreen('palm', {
                    '-': function () { changeSpeed(-1); },
                    '=': function () { changeSpeed(1); },
                    p: togglePlay
                });
            }

            if (typeof ResizeObserver !== 'undefined') {
                palmResizeObserver = new ResizeObserver(syncPalmLayout);
                if (palmGrid) palmResizeObserver.observe(palmGrid);
            } else {
                global.addEventListener('resize', syncPalmLayout);
            }

            speedDisplay.textContent = speedLevel;

            if (settingsStore) {
                var palmPrefs = settingsStore.load(settingsStore.keys.palm);
                if (palmPrefs && palmPrefs.difficulty) {
                    currentDifficulty = palmPrefs.difficulty;
                }
                if (palmPrefs && palmPrefs.hand) {
                    currentHand = palmPrefs.hand;
                }
                difficultySelect.value = currentDifficulty;
                handSelect.value = currentHand;
            }

            updateGestureLists();
            syncPalmLayout();

            if (router) {
                router.defineScreen('palm', {
                    enter: function () {
                        if (!initialized) {
                            initialized = true;
                            updateGame();
                        }
                        syncPalmLayout();
                        if (message) {
                            message.show({
                                icon: '',
                                title: '跟住左右手做手勢',
                                subtitle: '',
                                extraLarge: true,
                                pauseTimer: false
                            });
                        }
                    },
                    exit: stopAutoPlay,
                    back: 'home'
                });
            }

            function destroy() {
                stopAutoPlay();
                if (palmResizeObserver) {
                    palmResizeObserver.disconnect();
                    palmResizeObserver = null;
                }
                controller.abort();
            }

            return {
                start: startAutoPlay,
                pause: stopAutoPlay,
                reset: function () {
                    speedLevel = 5;
                    speedDisplay.textContent = speedLevel;
                    palmActivity.setSpeed(speedLevel);
                },
                destroy: destroy
            };
        }

        var api = { mount: mount };

        if (typeof document !== 'undefined' && global.CognitivePalmScreen && global.CognitiveGameScreen) {
            api.mount(document, {
                palmScreen: global.CognitivePalmScreen,
                gameScreen: global.CognitiveGameScreen,
                router: global.CognitiveRouter,
                keyboard: global.CognitiveKeyboard,
                message: global.CognitiveMessage,
                settingsStore: global.CognitiveSettingsStore,
                activity: global.CognitiveActivity
            });
        }

        return api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createPalm: createPalm };
    }
    if (typeof window !== 'undefined') {
        window.CognitivePalm = createPalm;
        // Palm is reached through data-router-target rather than the game
        // registry, so nothing else would ever call the factory and the
        // self-mount branch above would never run.
        createPalm();
    }
})(typeof window !== 'undefined' ? window : globalThis);
