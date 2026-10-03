(function () {
    'use strict';

    var bootLoader = document.getElementById('bootLoader');
    var bootProgress = document.getElementById('bootLoaderProgress');

    var flow = window.CognitiveUpdateFlow.createUpdateFlow({
        navigator: navigator,
        location: window.location,
        router: window.CognitiveRouter || null,
        loader: {
            show: function () {
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
