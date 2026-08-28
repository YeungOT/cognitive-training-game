(function (global) {
    'use strict';

    function createGameRegistry(options) {
        options = options || {};
        var router = options.router || null;
        var documentRef = options.document || null;
        var games = new Map();
        var menuOrders = new Set();
        var entryRoutes = new Set();

        function assertNonEmptyString(value, label) {
            if (typeof value !== 'string' || value.trim() === '') {
                throw new Error(label + ' must be a non-empty string');
            }
        }

        function register(definition) {
            if (!definition || typeof definition !== 'object') {
                throw new Error('Game definition must be an object');
            }

            assertNonEmptyString(definition.id, 'Game id');
            assertNonEmptyString(definition.title, 'Game title');
            assertNonEmptyString(definition.icon, 'Game icon');
            assertNonEmptyString(definition.entryRoute, 'Game entry route');
            if (!Number.isInteger(definition.menuOrder)) {
                throw new Error('Game menuOrder must be an integer');
            }
            if (games.has(definition.id)) {
                throw new Error('Game id already registered: ' + definition.id);
            }
            if (menuOrders.has(definition.menuOrder)) {
                throw new Error('Game menu order already registered: ' + definition.menuOrder);
            }
            if (entryRoutes.has(definition.entryRoute)) {
                throw new Error('Game entry route already registered: ' + definition.entryRoute);
            }

            var instance = null;
            if (definition.setup) {
                if (typeof definition.setup !== 'function') {
                    throw new Error('Game setup must be a function');
                }
                instance = definition.setup({ router: router });
                if (!instance || typeof instance !== 'object') {
                    throw new Error('Game setup must return a lifecycle object');
                }
                ['start', 'pause', 'reset', 'destroy'].forEach(function (hook) {
                    if (typeof instance[hook] !== 'function') {
                        throw new Error('Game lifecycle is missing ' + hook + '(): ' + definition.id);
                    }
                });
            }

            var game = {
                id: definition.id,
                title: definition.title,
                icon: definition.icon,
                entryRoute: definition.entryRoute,
                buttonId: definition.buttonId || 'game' + definition.id.charAt(0).toUpperCase() + definition.id.slice(1) + 'Btn',
                menuOrder: definition.menuOrder,
                instance: instance
            };

            games.set(game.id, game);
            menuOrders.add(game.menuOrder);
            entryRoutes.add(game.entryRoute);
            return game;
        }

        function list() {
            return Array.from(games.values())
                .sort(function (a, b) { return a.menuOrder - b.menuOrder; })
                .map(function (game) {
                    return {
                        id: game.id,
                        title: game.title,
                        icon: game.icon,
                        entryRoute: game.entryRoute,
                        buttonId: game.buttonId
                    };
                });
        }

        function navigate(id) {
            var game = games.get(id);
            if (!game) throw new Error('Unknown game: ' + id);
            if (!router || typeof router.navigate !== 'function') {
                throw new Error('Router is not available');
            }
            if (!router.navigate(game.entryRoute)) {
                throw new Error('Unable to navigate to game route: ' + game.entryRoute);
            }
        }

        function createButton(doc, game) {
            var button = doc.createElement('button');
            button.className = 'category-btn';
            button.id = game.buttonId;
            button.type = 'button';

            var icon = doc.createElement('span');
            icon.className = 'icon';
            icon.textContent = game.icon;
            button.appendChild(icon);

            var label = doc.createElement('span');
            label.className = 'label';
            label.textContent = game.title;
            button.appendChild(label);

            button.addEventListener('click', function () {
                navigate(game.id);
            });
            return button;
        }

        function renderMenu(container, doc) {
            if (!container) throw new Error('Menu container is required');
            var ownerDocument = doc || container.ownerDocument || documentRef;
            if (!ownerDocument || typeof ownerDocument.createElement !== 'function') {
                throw new Error('Document is not available');
            }

            container.textContent = '';
            list().forEach(function (game) {
                container.appendChild(createButton(ownerDocument, game));
            });
        }

        return {
            register: register,
            list: list,
            navigate: navigate,
            renderMenu: renderMenu
        };
    }

    var api = { createGameRegistry: createGameRegistry };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveGames = createGameRegistry({
            document: typeof document !== 'undefined' ? document : null,
            router: typeof window.CognitiveRouter !== 'undefined' ? window.CognitiveRouter : null
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
