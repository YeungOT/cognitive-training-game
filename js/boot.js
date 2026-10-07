(function () {
    'use strict';

    var bootLoader = document.getElementById('bootLoader');
    var bootProgress = document.getElementById('bootLoaderProgress');

    // An update reload hands the page to the new service worker and re-runs boot.
    // Everything is already cached at that point, so the progress bar has nothing
    // real to report - showing it again just makes the user watch the bar they
    // already saw fill up restart from 0%. Skip it for that single boot and let
    // the home screen (static markup) paint straight away.
    var POST_UPDATE_RELOAD_KEY = (window.CognitiveUpdateFlow && window.CognitiveUpdateFlow.POST_UPDATE_RELOAD_KEY) ||
        'cognitive:post-update-reload';

    function consumePostUpdateFlag() {
        try {
            if (!window.sessionStorage) return false;
            if (!window.sessionStorage.getItem(POST_UPDATE_RELOAD_KEY)) return false;
            window.sessionStorage.removeItem(POST_UPDATE_RELOAD_KEY);
            return true;
        } catch (error) {
            return false;
        }
    }

    var earlySkipBootLoader = document.documentElement.classList.contains('skip-boot-loader');
    var consumedPostUpdateFlag = consumePostUpdateFlag();
    var skipBootLoader = earlySkipBootLoader || consumedPostUpdateFlag;
    if (skipBootLoader && bootLoader) bootLoader.classList.add('hidden');

    var flow = window.CognitiveUpdateFlow.createUpdateFlow({
        navigator: navigator,
        location: window.location,
        router: window.CognitiveRouter || null,
        loader: {
            show: function () {
                if (skipBootLoader) return;
                if (bootLoader) bootLoader.classList.remove('hidden');
                // The loader can be shown again mid-session when a worker update
                // lands. Reset the bar so a second cycle never displays the
                // previous cycle's width.
                if (bootProgress) bootProgress.style.width = '0%';
            },
            hide: function () {
                if (bootLoader) bootLoader.classList.add('hidden');
            },
            setProgress: function (loaded, total) {
                if (!bootProgress || !total) return;
                var percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
                bootProgress.style.width = percent + '%';
            }
        },
        console: window.console,
        setTimeout: function (fn, ms) {
            return window.setTimeout(fn, ms);
        },
        clearTimeout: function (id) {
            window.clearTimeout(id);
        }
    });

    window.CognitiveBoot = {
        start: function (callback) {
            return flow.start(callback);
        }
    };
})();
