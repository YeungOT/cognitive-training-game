(function (global) {
    'use strict';

    function assertNonEmptyString(value, label) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error(label + ' must be a non-empty string');
        }
    }

    function element(doc, tagName, className, id) {
        const node = doc.createElement(tagName);
        if (className) node.className = className;
        if (id) node.id = id;
        return node;
    }

    function icon(doc) {
        const image = doc.createElement('img');
        image.className = 'back-icon';
        image.src = 'assets/icons/back.png';
        image.alt = 'back';
        return image;
    }

    function menuIcon(doc) {
        const image = doc.createElement('img');
        image.className = 'menu-icon';
        image.src = 'assets/icons/menu.png';
        image.alt = 'menu';
        return image;
    }

    function createTopBar(doc, config) {
        assertNonEmptyString(config.backId, 'Top bar backId');
        assertNonEmptyString(config.scoreId, 'Top bar scoreId');
        assertNonEmptyString(config.hamburgerId, 'Top bar hamburgerId');

        const topBar = element(doc, 'div', 'top-bar');
        const left = element(doc, 'div', 'left-group');
        const back = element(doc, 'button', 'back-btn', config.backId);
        back.title = '返回上一頁';
        back.appendChild(icon(doc));
        left.appendChild(back);

        const questionArea = element(doc, 'div', 'question-area');
        const title = element(doc, 'span', 'question-text', config.titleId);
        if (config.titleChildren) {
            config.titleChildren.forEach(child => title.appendChild(createConfiguredElement(doc, child, 'span')));
        }
        questionArea.appendChild(title);

        const right = element(doc, 'div', 'right-group');
        if (config.scoreId) {
            const score = element(doc, 'div', 'score-display', config.scoreId + 'Display');
            score.textContent = '得分\u00a0';
            const scoreNum = element(doc, 'span', '', config.scoreId);
            scoreNum.textContent = '0';
            score.appendChild(scoreNum);
            right.appendChild(score);
        }
        if (config.dropdown) right.appendChild(createTopBarDropdown(doc, config.dropdown));
        (config.actions || []).forEach(action => right.appendChild(createTopBarAction(doc, action)));
        const separator = element(doc, 'span', 'separator');
        separator.textContent = '|';
        right.appendChild(separator);
        const hamburger = element(doc, 'button', 'hamburger-btn', config.hamburgerId);
        hamburger.title = '開啟選單';
        hamburger.appendChild(menuIcon(doc));
        right.appendChild(hamburger);

        topBar.appendChild(left);
        topBar.appendChild(questionArea);
        topBar.appendChild(right);
        return topBar;
    }

    function createConfiguredElement(doc, config, tagName) {
        const node = element(doc, config.tagName || tagName || 'div', config.className || '', config.id || '');
        if (config.text) node.textContent = config.text;
        if (config.title) node.title = config.title;
        (config.children || []).forEach(child => node.appendChild(createConfiguredElement(doc, child)));
        return node;
    }

    function createSaveButton(doc, config) {
        const button = element(doc, 'button', 'save-btn', config.id);
        button.title = config.title || '儲存設定';
        button.textContent = config.label || '💾儲存';
        return button;
    }

    function createTopBarDropdown(doc, dropdown) {
        assertNonEmptyString(dropdown.selectId, 'Top bar dropdown selectId');
        if (!Array.isArray(dropdown.options) || dropdown.options.length === 0) {
            throw new Error('Top bar dropdown options must not be empty');
        }
        const wrapper = element(doc, 'div', 'dropdown-wrapper');
        const select = element(doc, 'select', dropdown.selectClassName || '', dropdown.selectId);
        if (dropdown.label) {
            const label = element(doc, 'label');
            label.setAttribute('for', dropdown.selectId);
            label.textContent = dropdown.label;
            wrapper.appendChild(label);
        } else if (dropdown.ariaLabel) {
            select.setAttribute('aria-label', dropdown.ariaLabel);
        }
        dropdown.options.forEach(option => {
            const optionNode = element(doc, 'option', '', option.value || '');
            optionNode.value = option.value || '';
            optionNode.textContent = option.label;
            if (option.selected) optionNode.selected = true;
            select.appendChild(optionNode);
        });
        wrapper.appendChild(select);
        return wrapper;
    }

    function createTopBarAction(doc, action) {
        if (!action || !action.id) throw new Error('Top bar action id is required');
        const button = element(doc, 'button', action.className || 'action-btn', action.id);
        button.title = action.title || '';
        button.textContent = action.text || '';
        if (action.badgeId) {
            const badge = element(doc, 'span', action.badgeClassName || 'state-badge', action.badgeId);
            button.appendChild(badge);
        }
        return button;
    }

    function createStage(doc, config) {
        assertNonEmptyString(config.id, 'Stage id');
        assertNonEmptyString(config.className, 'Stage className');
        const stage = element(doc, 'div', config.className, config.id);
        if (config.child) stage.appendChild(createConfiguredElement(doc, config.child, 'div'));
        (config.children || []).forEach(child => stage.appendChild(createConfiguredElement(doc, child, 'div')));
        return stage;
    }

    function createFooter(doc, config) {
        const footer = element(doc, 'div', config.className || 'footer');
        if (config.controls) {
            const leftCfg = config.controls.left || {};
            const left = element(doc, 'div', leftCfg.className || 'left-group');
            (leftCfg.children || []).forEach(child => left.appendChild(createConfiguredElement(doc, child)));
            const center = element(doc, 'div', config.controls.className || 'center-group', config.controls.id || '');
            (config.controls.children || []).forEach(child => center.appendChild(createConfiguredElement(doc, child)));
            const rightCfg = config.controls.right || {};
            const right = element(doc, 'div', rightCfg.className || 'right-group');
            (rightCfg.children || []).forEach(child => right.appendChild(createConfiguredElement(doc, child)));
            footer.appendChild(left);
            footer.appendChild(center);
            footer.appendChild(right);
            return footer;
        }

        assertNonEmptyString(config.roundId, 'Footer roundId');
        if (config.hint) {
            const hint = element(doc, 'span', 'hint', config.hintId || '');
            hint.textContent = config.hint;
            footer.appendChild(hint);
        }
        const round = element(doc, 'span', 'round-info', config.roundId);
        round.textContent = config.roundText || '';
        footer.appendChild(round);
        return footer;
    }

    function createSelectField(doc, field) {
        if (field.separator) return element(doc, 'div', 'separator game-screen-separator');
        if (field.button) {
            assertNonEmptyString(field.label, 'Settings field label');
            assertNonEmptyString(field.button.id, 'Settings field button id');
            const row = element(doc, 'div', 'game-screen-field');
            const label = element(doc, 'span', 'game-screen-label');
            label.textContent = field.label;
            const button = element(doc, 'button', field.button.className || 'game-screen-toggle', field.button.id);
            if (field.button.title) button.title = field.button.title;
            button.textContent = field.button.text || '關閉';
            row.appendChild(label);
            row.appendChild(button);
            return row;
        }
        assertNonEmptyString(field.id, 'Settings field id');
        if (!field.labelNode) {
            assertNonEmptyString(field.label, 'Settings field label');
        }
        if (!Array.isArray(field.options) || field.options.length === 0) {
            throw new Error('Settings field options must not be empty: ' + field.id);
        }
        const row = element(doc, 'div', 'game-screen-field', field.rowId || '');
        const label = field.labelNode
            ? createConfiguredElement(doc, field.labelNode, 'span')
            : element(doc, 'span', 'game-screen-label');
        if (!field.labelNode) label.textContent = field.label;
        const select = element(doc, 'select', 'game-screen-select', field.id);
        field.options.forEach(option => {
            const optionElement = element(doc, 'option', '', option.value || '');
            optionElement.value = option.value || '';
            optionElement.textContent = option.label;
            if (option.selected) optionElement.selected = true;
            select.appendChild(optionElement);
        });
        row.appendChild(label);
        row.appendChild(select);
        return row;
    }

    function fillSettingsScreen(doc, root, config) {
        assertNonEmptyString(config.id, 'Settings id');
        assertNonEmptyString(config.backId, 'Settings backId');
        assertNonEmptyString(config.title, 'Settings title');
        assertNonEmptyString(config.hamburgerId, 'Settings hamburgerId');
        if (!Array.isArray(config.fields)) throw new Error('Settings fields must be an array');

        root.className = 'menu-overlay app-screen settings-screen game-screen hidden';
        root.id = config.id;
        root.textContent = '';
        const left = element(doc, 'div', 'chrome-btn-left');
        const back = element(doc, 'button', 'back-btn', config.backId);
        back.title = '返回上一頁';
        back.appendChild(icon(doc));
        left.appendChild(back);
        const right = element(doc, 'div', config.chromeRightCluster ? 'chrome-btn-right chrome-btn-cluster' : 'chrome-btn-right');
        if (config.saveButton) right.appendChild(createSaveButton(doc, config.saveButton));
        const hamburger = element(doc, 'button', 'hamburger-btn', config.hamburgerId);
        hamburger.title = '開啟選單';
        hamburger.appendChild(menuIcon(doc));
        right.appendChild(hamburger);
        const header = element(doc, 'div', 'menu-header');
        const title = element(doc, 'div', 'menu-title');
        title.textContent = config.title;
        header.appendChild(title);
        root.appendChild(left);
        root.appendChild(right);
        root.appendChild(header);

        if (config.subtitle) {
            const subtitle = element(doc, 'div', 'menu-subtitle');
            subtitle.textContent = config.subtitle;
            root.appendChild(subtitle);
        }

        const options = element(doc, 'div', 'settings-options');
        config.fields.forEach(field => options.appendChild(createSelectField(doc, field)));
        root.appendChild(options);

        if (config.action) {
            assertNonEmptyString(config.action.id, 'Settings action id');
            assertNonEmptyString(config.action.label, 'Settings action label');
            const actions = element(doc, 'div', 'settings-actions');
            const action = element(doc, 'button', 'game-screen-action', config.action.id);
            action.textContent = config.action.label;
            actions.appendChild(action);
            root.appendChild(actions);
        }
    }

    function collectElements(roots) {
        const els = {};
        roots.forEach(root => {
            if (!root) return;
            if (root.id) els[root.id] = root;
            Array.from(root.querySelectorAll('[id]')).forEach(node => {
                els[node.id] = node;
            });
        });
        return els;
    }

    function createGameScreen(doc, definition) {
        if (!definition || typeof definition !== 'object') throw new Error('Game Screen definition must be an object');
        if (!definition.gameRoot) throw new Error('Game Screen gameRoot is required');
        if (!definition.game) throw new Error('Game Screen game config is required');

        const gameRoot = definition.gameRoot;
        gameRoot.className = 'game-container app-screen game-screen hidden';
        gameRoot.textContent = '';
        gameRoot.appendChild(createTopBar(doc, definition.game.topBar));
        gameRoot.appendChild(createStage(doc, definition.game.stage));
        gameRoot.appendChild(createFooter(doc, definition.game.footer));

        let settingsRoot = null;
        if (definition.settingsRoot && definition.settings) {
            settingsRoot = definition.settingsRoot;
            settingsRoot.className = 'menu-overlay app-screen settings-screen game-screen hidden';
            settingsRoot.textContent = '';
            fillSettingsScreen(doc, settingsRoot, definition.settings);
        }

        return {
            game: gameRoot,
            settings: settingsRoot,
            els: collectElements([gameRoot, settingsRoot].filter(Boolean))
        };
    }

    var api = { createGameScreen: createGameScreen };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.CognitiveGameScreen = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
