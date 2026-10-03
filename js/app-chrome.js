        (function () {
            'use strict';

            var store = window.CognitiveSettingsStore;
            var THEME_KEY = store && store.keys ? store.keys.theme : 'cognitiveAppTheme';
            var MUSIC_KEY = store && store.keys ? store.keys.music : 'cognitiveAppMusic';
            var SFX_KEY = store && store.keys ? store.keys.sfx : 'cognitiveAppSfx';
            var audio = window.CognitiveAudio || null;

            function loadSetting(key) {
                return store && typeof store.load === 'function' ? store.load(key) : {};
            }

            function persistSetting(key, patch) {
                if (!store || typeof store.save !== 'function') return false;
                try {
                    return store.save(key, patch);
                } catch (error) {
                    if (window.console && typeof window.console.warn === 'function') {
                        window.console.warn('Could not persist setting "' + key + '":', error);
                    }
                    return false;
                }
            }

            function notifySettingsChanged() {
                var event;
                try {
                    event = new CustomEvent('cognitive-settings-changed');
                } catch (e) {
                    event = document.createEvent('Event');
                    event.initEvent('cognitive-settings-changed', false, false);
                }
                document.dispatchEvent(event);
            }

            var settings = {
                theme: loadSetting(THEME_KEY).theme === 'dark' ? 'dark' : 'light',
                music: audio ? audio.getMusicEnabled() : loadSetting(MUSIC_KEY).music !== false,
                sfx: audio ? audio.getSfxEnabled() : loadSetting(SFX_KEY).sfx !== false,
                setTheme: function (value) {
                    settings.theme = value === 'dark' ? 'dark' : 'light';
                    applyTheme();
                    updateBadges();
                    notifySettingsChanged();
                    persistSetting(THEME_KEY, { theme: settings.theme });
                },
                setMusic: function (value) {
                    settings.music = !!value;
                    updateBadges();
                    notifySettingsChanged();
                    if (audio) audio.setMusicEnabled(settings.music);
                    persistSetting(MUSIC_KEY, { music: settings.music });
                },
                setSfx: function (value) {
                    settings.sfx = !!value;
                    updateBadges();
                    notifySettingsChanged();
                    if (audio) audio.setSfxEnabled(settings.sfx);
                    persistSetting(SFX_KEY, { sfx: settings.sfx });
                }
            };
            window.CognitiveSettings = settings;
            applyTheme();

            function applyTheme() {
                var root = document.documentElement;
                root.setAttribute('data-theme', settings.theme);
                // Keep OS/browser chrome in step with the theme. Reads the existing
                // --container-bg token so the palette is not duplicated here.
                var themeColorMeta = document.querySelector('meta[name="theme-color"]');
                if (themeColorMeta) {
                    var surface = getComputedStyle(root).getPropertyValue('--container-bg').trim();
                    if (surface) themeColorMeta.content = surface;
                }
            }

            function refreshSettingsFromStorage() {
                if (audio) audio.syncFromStorage();
                settings.theme = loadSetting(THEME_KEY).theme === 'dark' ? 'dark' : 'light';
                settings.music = audio ? audio.getMusicEnabled() : loadSetting(MUSIC_KEY).music !== false;
                settings.sfx = audio ? audio.getSfxEnabled() : loadSetting(SFX_KEY).sfx !== false;
                applyTheme();
                updateBadges();
                notifySettingsChanged();
                if (audio) {
                    if (settings.music) audio.playMusic();
                    else audio.pauseMusic();
                }
            }

            function tryPlayMusic() {
                if (audio) audio.playMusic();
            }

            function badgeSpan(id, on) {
                return '<span class="state-badge' + (on ? ' on' : '') + '" id="' + id + '"></span>';
            }

            function updateBadges() {
                var themeBtn = document.getElementById('slideThemeBtn');
                if (themeBtn) {
                    var dark = settings.theme === 'dark';
                    themeBtn.innerHTML = (dark ? '☀️ 淺色模式' : '🌑 深色模式') +
                        ' ' + badgeSpan('themeBadge', dark);
                }
                var musicBtn = document.getElementById('slideBgMusicBtn');
                if (musicBtn) {
                    musicBtn.innerHTML = (settings.music ? '🔊 背景音樂' : '🔇 背景音樂') +
                        ' ' + badgeSpan('bgMusicBadge', settings.music);
                }
                var sfxBtn = document.getElementById('slideSfxBtn');
                if (sfxBtn) {
                    sfxBtn.innerHTML = (settings.sfx ? '🔊 音效' : '🔇 音效') +
                        ' ' + badgeSpan('sfxBadge', settings.sfx);
                }
            }

            var slideMenu = document.getElementById('slideMenu');
            var slideMenuBackdrop = document.getElementById('slideMenuBackdrop');
            var EDGE_PX = 48;
            // The scaled edge strip collapses to ~15px on a phone, well under the
            // 24px tap floor the layout gate enforces. Floor it so the grab area
            // stays thumb-sized; large screens keep the full scaled width.
            var EDGE_MIN_PX = 24;
            var DRAG_START_PX = 8;
            var SNAP_RATIO = 0.5;
            var VELOCITY_PX_MS = 0.45;
            var MENU_ANIMATION_MS = 330;
            var menuDrag = null;
            var menuSuppressClickUntil = 0;
            var menuAnimating = false;
            var menuAnimationTimer = null;

            function getUiScale() {
                var width = window.innerWidth || document.documentElement.clientWidth || 0;
                var height = window.innerHeight || document.documentElement.clientHeight || 0;
                if (width <= 0 || height <= 0) return 1;
                // Custom properties keep their token stream, so --ui-scale cannot be parsed directly.
                return Math.min(width / 1280, height / 800);
            }

            function getEdgeWidth() {
                return Math.max(EDGE_MIN_PX, EDGE_PX * getUiScale());
            }

            function getMenuWidth() {
                if (!slideMenu) return 300;
                var rect = slideMenu.getBoundingClientRect();
                return rect.width || 300;
            }

            function isRightEdgePointer(e) {
                var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
                return viewportWidth > 0 && e.clientX >= viewportWidth - getEdgeWidth();
            }

            function isInteractiveMenuTarget(target) {
                if (!target || typeof target.closest !== 'function') return false;
                return !!target.closest(
                    '.hamburger-btn, .slide-menu, .slide-menu-backdrop, button, select, a, input, textarea, [role="button"]'
                );
            }

            function clamp(value, min, max) {
                return Math.max(min, Math.min(max, value));
            }

            function clearMenuAnimation() {
                if (menuAnimationTimer) {
                    clearTimeout(menuAnimationTimer);
                    menuAnimationTimer = null;
                }
                menuAnimating = false;
            }

            function finishMenuAnimation() {
                menuAnimationTimer = null;
                menuAnimating = false;
                if (slideMenu) {
                    slideMenu.classList.remove('dragging');
                    slideMenu.classList.remove('closing');
                    slideMenu.style.transform = '';
                }
                if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '';
            }

            function animateMenuTo(open) {
                if (!slideMenu) return;
                clearMenuAnimation();
                menuDrag = null;
                menuAnimating = true;
                slideMenu.classList.remove('dragging');
                if (slideMenu.offsetWidth) {}
                if (open) {
                    slideMenu.classList.add('open');
                    slideMenu.classList.remove('closing');
                    slideMenu.style.transform = '';
                    if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '';
                } else {
                    slideMenu.classList.remove('open');
                    slideMenu.classList.add('closing');
                    slideMenu.style.transform = 'translateX(100%)';
                    if (slideMenuBackdrop) slideMenuBackdrop.style.opacity = '0';
                }
                menuAnimationTimer = setTimeout(finishMenuAnimation, MENU_ANIMATION_MS);
            }

            function cancelMenuDrag() {
                if (!menuDrag) return;
                var wasOpen = slideMenu && slideMenu.classList.contains('open');
                var dragging = menuDrag.dragging;
                menuDrag = null;
                if (dragging) animateMenuTo(wasOpen);
            }

            function updateMenuDrag(dx) {
                if (!slideMenu || !slideMenuBackdrop) return;
                var width = Math.max(1, getMenuWidth());
                var progress;
                if (menuDrag.mode === 'open') {
                    progress = clamp(-dx / width, 0, 1);
                    slideMenu.style.transform = 'translateX(' + ((1 - progress) * 100) + '%)';
                    slideMenuBackdrop.style.opacity = String(progress);
                } else {
                    progress = clamp(dx / width, 0, 1);
                    slideMenu.style.transform = 'translateX(' + (progress * 100) + '%)';
                    slideMenuBackdrop.style.opacity = String(1 - progress);
                }
            }

            function finishMenuDrag(clientX) {
                if (!menuDrag) return;
                var mode = menuDrag.mode;
                var wasDragging = menuDrag.dragging;
                var dx = clientX - menuDrag.startX;
                var width = Math.max(1, getMenuWidth());
                var progress;
                var shouldOpen;
                if (mode === 'open') {
                    progress = clamp(-dx / width, 0, 1);
                    shouldOpen = progress >= SNAP_RATIO || menuDrag.velocity < -VELOCITY_PX_MS;
                } else {
                    progress = clamp(dx / width, 0, 1);
                    shouldOpen = !(progress >= SNAP_RATIO || menuDrag.velocity > VELOCITY_PX_MS);
                }
                menuDrag = null;
                if (wasDragging) {
                    menuSuppressClickUntil = Date.now() + 500;
                    animateMenuTo(shouldOpen);
                }
            }

            document.addEventListener('pointerdown', function (e) {
                if (!slideMenu || !slideMenuBackdrop || menuDrag || menuAnimating) return;
                if (!e.isPrimary) return;

                if (slideMenu.classList.contains('open')) {
                    if (slideMenu.contains(e.target) || slideMenuBackdrop.contains(e.target)) {
                        menuDrag = {
                            mode: 'close',
                            pointerId: e.pointerId,
                            startX: e.clientX,
                            startY: e.clientY,
                            dragging: false,
                            velocity: 0,
                            lastX: e.clientX,
                            lastTime: Date.now()
                        };
                    }
                    return;
                }

                if (!isRightEdgePointer(e)) return;
                if (isInteractiveMenuTarget(e.target)) return;

                menuDrag = {
                    mode: 'open',
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    dragging: false,
                    velocity: 0,
                    lastX: e.clientX,
                    lastTime: Date.now()
                };
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (document.documentElement &&
                    typeof document.documentElement.setPointerCapture === 'function') {
                    try {
                        document.documentElement.setPointerCapture(e.pointerId);
                    } catch (error) {}
                }
            }, true);

            document.addEventListener('pointermove', function (e) {
                if (!menuDrag || e.pointerId !== menuDrag.pointerId) return;
                var dx = e.clientX - menuDrag.startX;
                var dy = e.clientY - menuDrag.startY;
                var now = Date.now();
                var dt = Math.max(1, now - menuDrag.lastTime);
                var instantVelocity = (e.clientX - menuDrag.lastX) / dt;
                menuDrag.velocity = menuDrag.velocity * 0.7 + instantVelocity * 0.3;
                menuDrag.lastX = e.clientX;
                menuDrag.lastTime = now;
                if (e.cancelable) e.preventDefault();

                if (!menuDrag.dragging) {
                    if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return;
                    if (Math.abs(dx) < Math.abs(dy)) {
                        cancelMenuDrag();
                        return;
                    }
                    menuDrag.dragging = true;
                    slideMenu.classList.add('dragging');
                }
                updateMenuDrag(dx);
            }, { passive: false });

            document.addEventListener('pointerup', function (e) {
                if (menuDrag && e.pointerId === menuDrag.pointerId) {
                    finishMenuDrag(e.clientX);
                }
            });

            document.addEventListener('pointercancel', function (e) {
                if (menuDrag && e.pointerId === menuDrag.pointerId) {
                    cancelMenuDrag();
                }
            });

            document.addEventListener('click', function (e) {
                if (Date.now() < menuSuppressClickUntil) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true);

            document.addEventListener('click', function (e) {
                var btn = e.target.closest('.hamburger-btn');
                if (btn) {
                    e.stopPropagation();
                    if (slideMenu) animateMenuTo(!slideMenu.classList.contains('open'));
                }
            });

            document.addEventListener('click', function (e) {
                if (slideMenu && slideMenu.classList.contains('open') &&
                    !slideMenu.contains(e.target) &&
                    !e.target.closest('.hamburger-btn')) {
                    animateMenuTo(false);
                }
            });

            window.CognitiveMenu = {
                open: function () {
                    animateMenuTo(true);
                },
                close: function () {
                    animateMenuTo(false);
                },
                isOpen: function () {
                    return !!(slideMenu && slideMenu.classList.contains('open'));
                }
            };

            var themeBtn = document.getElementById('slideThemeBtn');
            if (themeBtn) {
                themeBtn.addEventListener('click', function () {
                    settings.setTheme(settings.theme === 'dark' ? 'light' : 'dark');
                });
            }

            var musicBtn = document.getElementById('slideBgMusicBtn');
            if (musicBtn) {
                musicBtn.addEventListener('click', function () {
                    settings.setMusic(!settings.music);
                });
            }

            var sfxBtn = document.getElementById('slideSfxBtn');
            if (sfxBtn) {
                sfxBtn.addEventListener('click', function () {
                    settings.setSfx(!settings.sfx);
                });
            }

            var homeBtn = document.getElementById('slideHomeBtn');
            if (homeBtn) {
                homeBtn.addEventListener('click', function () {
                    animateMenuTo(false);
                    if (window.CognitiveRouter) {
                        window.CognitiveRouter.goHome();
                    }
                });
            }

            var helpBtn = document.getElementById('slideHelpBtn');
            if (helpBtn) {
                helpBtn.addEventListener('click', function () {
                    animateMenuTo(false);
                    if (window.CognitiveKeyboard &&
                        typeof window.CognitiveKeyboard.showHelp === 'function') {
                        window.CognitiveKeyboard.showHelp();
                    }
                });
            }

            if (window.CognitiveRouter && typeof window.CognitiveRouter.defineScreen === 'function') {
                window.CognitiveRouter.defineScreen('home', { back: 'home' });
            }

            var backButtons = document.querySelectorAll('[data-app-back]');
            for (var i = 0; i < backButtons.length; i++) {
                backButtons[i].addEventListener('click', function () {
                    if (window.CognitiveRouter) {
                        window.CognitiveRouter.goBack();
                    }
                });
            }

            document.addEventListener('pointerdown', function onFirstGesture() {
                tryPlayMusic();
                document.removeEventListener('pointerdown', onFirstGesture);
            });

            function syncMeasuredStages() {
                // Stage height is derived from shared layout variables so every game uses the same stage.
            }

            syncMeasuredStages();

            refreshSettingsFromStorage();
            setTimeout(tryPlayMusic, 400);

            function pauseAppAudio() {
                if (audio) {
                    audio.pauseMusic();
                    audio.stopFile();
                }
            }

            window.addEventListener('pageshow', refreshSettingsFromStorage);
            window.addEventListener('focus', refreshSettingsFromStorage);
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    pauseAppAudio();
                } else {
                    refreshSettingsFromStorage();
                }
            });
            window.addEventListener('pagehide', pauseAppAudio);
            window.addEventListener('storage', function (e) {
                if (e.key === null ||
                    e.key === THEME_KEY ||
                    e.key === MUSIC_KEY ||
                    e.key === SFX_KEY) {
                    refreshSettingsFromStorage();
                }
            });

            function isPortraitViewport() {
                if (window.matchMedia && window.matchMedia('(orientation: portrait)').matches) {
                    return true;
                }
                return window.innerHeight > window.innerWidth;
            }

            function updatePortraitLock() {
                var overlay = document.getElementById('portraitLock');
                if (!overlay) return;
                var portrait = isPortraitViewport();
                overlay.classList.toggle('active', portrait);
                overlay.setAttribute('aria-hidden', portrait ? 'false' : 'true');
                if (portrait && window.screen && window.screen.orientation &&
                    typeof window.screen.orientation.lock === 'function') {
                    window.screen.orientation.lock('landscape').catch(function () {});
                }
            }

            updatePortraitLock();
            if (window.matchMedia) {
                var portraitQuery = window.matchMedia('(orientation: portrait)');
                if (portraitQuery.addEventListener) {
                    portraitQuery.addEventListener('change', updatePortraitLock);
                } else if (portraitQuery.addListener) {
                    portraitQuery.addListener(updatePortraitLock);
                }
            }
            window.addEventListener('resize', updatePortraitLock);
        })();
