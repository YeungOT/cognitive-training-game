(function (global) {
    'use strict';

    // Set just before an update reload so the boot that follows knows it is a
    // refresh rather than a cold start. Without it the progress bar appears
    // twice: it fills on the first document, the page reloads to hand control to
    // the new worker, and the bar restarts from 0% on the second.
    var POST_UPDATE_RELOAD_KEY = 'cognitive:post-update-reload';

    function createUpdateFlow(adapters) {
        adapters = adapters || {};

        var navigatorRef = adapters.navigator || {};
        var locationRef = adapters.location || {};
        var routerRef = adapters.router || null;
        var loader = adapters.loader || {};
        var consoleRef = adapters.console || (typeof console !== 'undefined' ? console : null);
        var setTimeoutRef = adapters.setTimeout ||
            (typeof setTimeout !== 'undefined' ? setTimeout : function () {
                return 0;
            });
        var clearTimeoutRef = adapters.clearTimeout ||
            (typeof clearTimeout !== 'undefined' ? clearTimeout : function () {});
        var registerUrl = adapters.registerUrl || 'sw.js';
        var startupUpdateTimeoutMs = adapters.startupUpdateTimeoutMs || 8000;
        var installTimeoutMs = adapters.installTimeoutMs || 90000;
        // 進度條封頂：precache 完成後還有 activation，先停在 95%，真正完成才顯示 100%
        var progressCapPercent = adapters.progressCapPercent != null ? adapters.progressCapPercent : 95;
        var firstInstallWaitMs = adapters.firstInstallWaitMs || 3000;
        // The progress bar animates its width over 0.16s. Hiding the loader in
        // the same tick as the final 100% write means that last step is never
        // painted - the bar jumps from 95% straight to gone. Hold the completed
        // bar briefly so the finish is actually visible. Set to 0 to hide
        // synchronously (used by tests).
        var completionHoldMs = adapters.completionHoldMs != null ? adapters.completionHoldMs : 220;
        var postUpdateReloadKey = adapters.postUpdateReloadKey || POST_UPDATE_RELOAD_KEY;
        var sessionRef = adapters.session || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);

        var started = false;
        var ready = false;
        var pendingCallbacks = [];
        var readyResolvers = [];
        var installWaiter = null;
        var registrationRef = null;
        var bootTimer = null;
        var pendingUpdate = false;
        var pendingUpdateReload = false;
        var reloading = false;
        var disposed = false;

        function setProgress(loaded, total) {
            if (typeof loader.setProgress !== 'function') return;
            loader.setProgress(loaded, total);
        }

        function showLoader() {
            if (typeof loader.show === 'function') loader.show();
        }

        function hideLoader() {
            if (typeof loader.hide === 'function') loader.hide();
        }

        function reloadForUpdate() {
            if (reloading) return;
            reloading = true;
            // complete() never runs on this path, so clear the boot fallback
            // timer here instead of leaving it pending.
            if (bootTimer && typeof clearTimeoutRef === 'function') {
                clearTimeoutRef(bootTimer);
                bootTimer = null;
            }
            markPostUpdateReload();
            if (typeof locationRef.reload === 'function') locationRef.reload();
        }

        function markPostUpdateReload() {
            if (!sessionRef) return;
            try {
                sessionRef.setItem(postUpdateReloadKey, '1');
            } catch (error) {
                // Private mode / disabled storage: the next boot simply shows its
                // progress bar again, which is the old behaviour.
            }
        }

        function complete() {
            if (bootTimer && typeof clearTimeoutRef === 'function') {
                clearTimeoutRef(bootTimer);
                bootTimer = null;
            }
            if (ready) {
                // A late duplicate completion still owns a loader it may have
                // just shown (e.g. a mid-session update install that finishes
                // after boot already completed). Never leave it on screen.
                hideLoader();
                return;
            }
            ready = true;

            // Always finish the bar. This used to be gated on `success`, but that
            // flag had no other reader, so every path which was not a worker
            // install left the bar at its 0% stylesheet default and the user
            // watched an empty loader until home appeared - which is every
            // ordinary repeat visit, and the second boot after an update.
            setProgress(1, 1);

            function finish() {
                hideLoader();
                var callbacks = pendingCallbacks;
                pendingCallbacks = [];
                callbacks.forEach(function (callback) {
                    try {
                        callback();
                    } catch (error) {
                        if (consoleRef && typeof consoleRef.error === 'function') {
                            consoleRef.error('App boot callback failed:', error);
                        }
                    }
                });
                var resolvers = readyResolvers;
                readyResolvers = [];
                resolvers.forEach(function (resolve) {
                    resolve();
                });
            }

            if (completionHoldMs > 0) {
                setTimeoutRef(finish, completionHoldMs);
            } else {
                finish();
            }
        }

        function onProgressMessage(event) {
            var data = event && event.data;
            if (!data || data.type !== 'cognitive-precache-progress') return;
            var total = data.total;
            var cap = Math.max(0, Math.min(100, progressCapPercent));
            var cappedLoaded = data.loaded;
            if (total > 0 && cap < 100) {
                cappedLoaded = Math.min(data.loaded, Math.max(0, Math.round(total * cap / 100)));
            }
            setProgress(cappedLoaded, total);
            if (data.done && installWaiter) {
                var finish = installWaiter;
                installWaiter = null;
                finish();
            }
        }

        function waitForInstall(registration) {
            return new Promise(function (resolve) {
                var worker = registration.installing || registration.waiting;
                var settled = false;
                var timeout = setTimeoutRef(finish, installTimeoutMs);

                function finish() {
                    if (settled) return;
                    settled = true;
                    if (typeof clearTimeoutRef === 'function') clearTimeoutRef(timeout);
                    if (worker && typeof worker.removeEventListener === 'function') {
                        worker.removeEventListener('statechange', onState);
                    }
                    if (installWaiter === finish) installWaiter = null;
                    resolve();
                }

                function onState() {
                    if (worker && (worker.state === 'activated' || worker.state === 'redundant')) {
                        finish();
                    }
                }

                if (installWaiter) {
                    var previous = installWaiter;
                    installWaiter = null;
                    previous();
                }
                installWaiter = finish;
                if (worker && typeof worker.addEventListener === 'function') {
                    worker.addEventListener('statechange', onState);
                }
                if (!worker || worker.state === 'activated' || worker.state === 'redundant') {
                    finish();
                }
            });
        }

        function waitForActive(registration) {
            return new Promise(function (resolve) {
                var worker = registration.installing || registration.waiting || registration.active;
                if (!worker || worker.state === 'activated' || worker.state === 'redundant') {
                    resolve();
                    return;
                }
                worker.addEventListener('statechange', function onState() {
                    if (worker.state === 'activated' || worker.state === 'redundant') {
                        worker.removeEventListener('statechange', onState);
                        resolve();
                    }
                });
            });
        }

        function getCurrentScreen() {
            if (routerRef && typeof routerRef.getCurrent === 'function') {
                return routerRef.getCurrent();
            }
            return null;
        }

        function installPendingUpdate(registration, shouldReload) {
            pendingUpdate = false;
            pendingUpdateReload = false;
            // When this install ends in a reload, anything we draw here is thrown
            // away: the page is replaced and the boot that follows skips the
            // loader entirely. Showing it anyway is the second bar users see -
            // it fills to 100% over a home screen that is already working, then
            // the page reloads. Only show progress for installs that stay put.
            if (!shouldReload) showLoader();
            return finishWorkerUpdate(registration, shouldReload)
                .catch(function () {
                    complete();
                });
        }

        function finishWorkerUpdate(registration, shouldReload) {
            return waitForInstall(registration)
                .then(function () {
                    return waitForActive(registration);
                })
                .then(function () {
                    if (shouldReload && registration.active && registration.active.state === 'activated') {
                        setProgress(1, 1);
                        reloadForUpdate();
                        return;
                    }
                    complete();
                });
        }

        function startUpdateCheck(registration) {
            if (!registration || typeof registration.addEventListener !== 'function') return;
            registration.addEventListener('updatefound', function () {
                if (!(registration.installing || registration.waiting)) return;
                var current = getCurrentScreen();
                var hasController = !!(navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller);
                if (current && current !== 'home') {
                    pendingUpdate = true;
                    pendingUpdateReload = hasController;
                    return;
                }
                installPendingUpdate(registration, hasController);
            });
            if (registration.active && navigatorRef.onLine !== false &&
                typeof registration.update === 'function') {
                registration.update().catch(function () {});
            }
        }

        function waitForStartupUpdateCheck(registration) {
            return new Promise(function (resolve) {
                if (navigatorRef.onLine === false) {
                    resolve(false);
                    return;
                }
                var activeWorker = registration.active;
                var settled = false;
                var timer = setTimeoutRef(finish, startupUpdateTimeoutMs);

                function finish(found) {
                    if (settled) return;
                    settled = true;
                    if (typeof clearTimeoutRef === 'function') clearTimeoutRef(timer);
                    if (typeof registration.removeEventListener === 'function') {
                        registration.removeEventListener('updatefound', onFound);
                    }
                    resolve(!!found);
                }

                function onFound() {
                    if (registration.installing || registration.waiting) {
                        finish(true);
                    }
                }

                if (typeof registration.addEventListener === 'function') {
                    registration.addEventListener('updatefound', onFound);
                }
                try {
                    registration.update().then(function () {
                        if (registration.installing || registration.waiting || registration.active !== activeWorker) {
                            finish(true);
                            return;
                        }
                        finish(false);
                    }).catch(function () {
                        finish(false);
                    });
                } catch (error) {
                    finish(false);
                }
            });
        }

        function start(callback) {
            if (ready) {
                if (typeof callback === 'function') callback();
                return Promise.resolve();
            }
            if (typeof callback === 'function') pendingCallbacks.push(callback);
            if (started) {
                return new Promise(function (resolve) {
                    readyResolvers.push(resolve);
                });
            }
            started = true;

            var bootPromise = new Promise(function (resolve) {
                readyResolvers.push(resolve);
            });

            showLoader();
            var hadController = !!(navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller);

            if (!navigatorRef.serviceWorker) {
                complete();
                return bootPromise;
            }

            if (typeof navigatorRef.serviceWorker.addEventListener === 'function') {
                navigatorRef.serviceWorker.addEventListener('message', onProgressMessage);
            }

            if (navigatorRef.onLine === false && navigatorRef.serviceWorker.controller) {
                complete();
                return bootPromise;
            }

            navigatorRef.serviceWorker.register(registerUrl, { updateViaCache: "none" }).then(function (registration) {
                if (disposed) return null;
                registrationRef = registration;

                if (routerRef && typeof routerRef.registerEnter === 'function') {
                    routerRef.registerEnter('home', function () {
                        if (pendingUpdate && registrationRef) {
                            installPendingUpdate(registrationRef, pendingUpdateReload);
                        }
                    });
                }

                if (registration.installing || registration.waiting) {
                    return finishWorkerUpdate(registration, hadController);
                }

                if (registration.active) {
                    return waitForStartupUpdateCheck(registration).then(function (found) {
                        if (found) {
                            return finishWorkerUpdate(registration, hadController);
                        }
                        complete();
                        startUpdateCheck(registration);
                        return null;
                    });
                }

                return new Promise(function (resolve) {
                    var timer = setTimeoutRef(function () {
                        if (typeof registration.removeEventListener === 'function') {
                            registration.removeEventListener('updatefound', onFound);
                        }
                        resolve();
                    }, firstInstallWaitMs);

                    function onFound() {
                        if (typeof clearTimeoutRef === 'function') clearTimeoutRef(timer);
                        if (typeof registration.removeEventListener === 'function') {
                            registration.removeEventListener('updatefound', onFound);
                        }
                        resolve();
                    }

                    if (typeof registration.addEventListener === 'function') {
                        registration.addEventListener('updatefound', onFound);
                    }
                }).then(function () {
                    if (registration.installing || registration.waiting) {
                        return finishWorkerUpdate(registration, hadController);
                    }
                    complete();
                    return null;
                });
            }).catch(function () {
                if (!disposed) complete();
            });

            bootTimer = setTimeoutRef(function () {
                complete();
            }, 90000);

            return bootPromise;
        }

        function enterHome() {
            if (pendingUpdate && registrationRef) {
                installPendingUpdate(registrationRef, pendingUpdateReload);
            }
        }

        function close() {
            disposed = true;
            if (navigatorRef.serviceWorker &&
                typeof navigatorRef.serviceWorker.removeEventListener === 'function') {
                navigatorRef.serviceWorker.removeEventListener('message', onProgressMessage);
            }
        }

        return {
            start: start,
            enterHome: enterHome,
            close: close,
            POST_UPDATE_RELOAD_KEY: postUpdateReloadKey
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            createUpdateFlow: createUpdateFlow
        };
    }

    if (typeof global !== 'undefined') {
        global.CognitiveUpdateFlow = {
            createUpdateFlow: createUpdateFlow,
            POST_UPDATE_RELOAD_KEY: POST_UPDATE_RELOAD_KEY
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
