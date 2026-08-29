import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMessageController } = require('../js/food/message.js');

function createFakeElement(tag) {
    return {
        tag,
        className: '',
        textContent: '',
        innerHTML: '',
        children: [],
        listeners: {},
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener(name, handler) {
            if (!this.listeners[name]) this.listeners[name] = [];
            this.listeners[name].push(handler);
        }
    };
}

function createFixture() {
    const overlay = createFakeElement('overlay');
    const msgIcon = createFakeElement('span');
    const documentFragments = [];
    const msgText = createFakeElement('div');
    const msgSub = createFakeElement('div');
    const msgButtons = createFakeElement('div');
    let pauses = 0;
    let resumes = 0;
    const pauseCoordinator = {
        pause: () => {
            pauses++;
        },
        resume: () => {
            resumes++;
        }
    };

    const controller = createMessageController({
        overlay,
        getMsgIcon: () => msgIcon,
        getMsgText: () => msgText,
        getMsgSub: () => msgSub,
        getMsgButtons: () => msgButtons,
        createElement: (tag) => {
            const node = createFakeElement(tag);
            documentFragments.push(node);
            return node;
        },
        createTextNode: (value) => {
            const node = createFakeElement('textnode');
            node.textContent = value;
            documentFragments.push(node);
            return node;
        },
        pauseCoordinator,
        attachBackdrop: false
    });

    return {
        controller,
        overlay,
        msgText,
        msgSub,
        msgButtons,
        getPauses: () => pauses,
        getResumes: () => resumes,
        getDocumentFragments: () => documentFragments,
        clickButton(index) {
            const group = msgButtons.children[0];
            const button = group.children[index];
            button.listeners.click[0]();
        }
    };
}

test('dismiss closes the flow and calls onDismiss once', function () {
    const fixture = createFixture();
    let dismisses = 0;

    fixture.controller.show({
        title: '看看圖片',
        onDismiss: () => {
            dismisses++;
        },
        pauseTimer: true
    });

    assert.equal(fixture.controller.isActive(), true);
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.msgText.textContent, '看看圖片');

    fixture.controller.dismiss();
    assert.equal(dismisses, 1);
    assert.equal(fixture.getResumes(), 1);
    assert.equal(fixture.controller.isActive(), false);

    fixture.controller.dismiss();
    assert.equal(dismisses, 1);
});

test('button action runs and suppresses onDismiss', function () {
    const fixture = createFixture();
    let actions = 0;
    let dismisses = 0;

    fixture.controller.show({
        title: '下一題',
        buttons: [{
            text: '下一題 ➜',
            className: 'btn-next',
            action: () => {
                actions++;
            }
        }],
        onDismiss: () => {
            dismisses++;
        }
    });

    fixture.clickButton(0);

    assert.equal(actions, 1);
    assert.equal(dismisses, 0);
    assert.equal(fixture.controller.isActive(), false);
});

test('replacing a message discards the old continuation', function () {
    const fixture = createFixture();
    let firstDismisses = 0;
    let secondDismisses = 0;

    fixture.controller.show({
        title: '第一次提示',
        onDismiss: () => {
            firstDismisses++;
        }
    });
    fixture.controller.show({
        title: '第二次提示',
        onDismiss: () => {
            secondDismisses++;
        }
    });

    fixture.controller.dismiss();

    assert.equal(firstDismisses, 0);
    assert.equal(secondDismisses, 1);
    assert.equal(fixture.msgText.textContent, '第二次提示');
});

test('pause and resume adapters follow the message lifecycle', function () {
    const fixture = createFixture();

    fixture.controller.show({
        title: '暫停計時',
        pauseTimer: true
    });
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 0);

    fixture.controller.close();
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 1);

    fixture.controller.show({
        title: '不暫停計時',
        pauseTimer: false
    });
    fixture.controller.dismiss();
    assert.equal(fixture.getPauses(), 1);
    assert.equal(fixture.getResumes(), 1);
});

test('creation requires a pause coordinator', function () {
    assert.throws(
        () => createMessageController({
            overlay: createFakeElement('overlay'),
            attachBackdrop: false
        }),
        /pauseCoordinator/
    );
});

function createTransitionElement(id) {
    const values = new Set();
    return {
        id,
        textContent: '',
        innerHTML: '',
        className: '',
        classList: {
            add(...names) {
                names.forEach(name => values.add(name));
            },
            remove(...names) {
                names.forEach(name => values.delete(name));
            },
            toggle(name, force) {
                const on = force === undefined ? !values.has(name) : !!force;
                if (on) values.add(name);
                else values.delete(name);
            },
            contains(name) {
                return values.has(name);
            }
        },
        appendChild() {}
    };
}

function createTransitionAdapter() {
    const callbacks = [];
    return {
        callbacks,
        isTransitioning: () => true,
        afterTransition(callback) {
            callbacks.push(callback);
            return true;
        },
        drain() {
            callbacks.splice(0).forEach(callback => callback());
        }
    };
}

function createTransitionFixture(adapter) {
    const overlay = createTransitionElement('overlay');
    const text = createTransitionElement('msgText');
    const sub = createTransitionElement('msgSub');
    const icon = createTransitionElement('msgIcon');
    const buttons = createTransitionElement('msgButtons');
    let pauses = 0;
    let resumes = 0;
    const controller = createMessageController({
        pauseCoordinator: {
            pause() {
                pauses += 1;
            },
            resume() {
                resumes += 1;
            }
        },
        overlay,
        getMsgIcon: () => icon,
        getMsgText: () => text,
        getMsgSub: () => sub,
        getMsgButtons: () => buttons,
        createElement: createTransitionElement,
        attachBackdrop: false,
        transitionAdapter: adapter || null
    });

    return {
        controller,
        overlay,
        text,
        getPauses: () => pauses,
        getResumes: () => resumes
    };
}

test('message show is deferred during a transition and drains the latest pending message', function () {
    const adapter = createTransitionAdapter();
    const fixture = createTransitionFixture(adapter);

    fixture.controller.show({
        title: 'first',
        pauseTimer: true
    });

    assert.equal(fixture.controller.isActive(), false);
    assert.equal(fixture.overlay.classList.contains('active'), false);
    assert.equal(fixture.text.textContent, '');
    assert.equal(fixture.getPauses(), 0);
    assert.equal(adapter.callbacks.length, 1);

    fixture.controller.show({
        title: 'second',
        pauseTimer: true
    });

    assert.equal(adapter.callbacks.length, 1);
    assert.equal(fixture.controller.isActive(), false);

    adapter.drain();

    assert.equal(fixture.controller.isActive(), true);
    assert.equal(fixture.overlay.classList.contains('active'), true);
    assert.equal(fixture.text.textContent, 'second');
    assert.equal(fixture.getPauses(), 1);
});

test('message show stays synchronous when the transition adapter is idle', function () {
    const fixture = createTransitionFixture({
        isTransitioning: () => false,
        afterTransition() {
            return false;
        }
    });

    fixture.controller.show({
        title: 'ready',
        pauseTimer: true
    });

    assert.equal(fixture.controller.isActive(), true);
    assert.equal(fixture.text.textContent, 'ready');
    assert.equal(fixture.getPauses(), 1);
});

test('close clears a pending message before the transition callback runs', function () {
    const adapter = createTransitionAdapter();
    const fixture = createTransitionFixture(adapter);

    fixture.controller.show({
        title: 'stale',
        pauseTimer: true
    });
    fixture.controller.close();

    adapter.drain();

    assert.equal(fixture.controller.isActive(), false);
    assert.equal(fixture.overlay.classList.contains('active'), false);
    assert.equal(fixture.getPauses(), 0);
    assert.equal(fixture.getResumes(), 0);
});

test('comma-containing text keeps segments unbreakable with wbr after commas', function () {
    const fixture = createFixture();

    fixture.controller.show({
        title: 'first segment，second segment，third',
        pauseTimer: true
    });

    const textNodes = fixture.msgText.children.filter(node => node.tag === 'textnode');
    const breaks = fixture.msgText.children.filter(node => node.tag === 'wbr');
    assert.equal(textNodes.length, 5);
    assert.equal(textNodes[0].textContent, 'first segment');
    assert.equal(textNodes[1].textContent, '，');
    assert.equal(textNodes[2].textContent, 'second segment');
    assert.equal(textNodes[3].textContent, '，');
    assert.equal(textNodes[4].textContent, 'third');
    assert.equal(breaks.length, 2);
    // each break sits immediately after its comma
    // structure: [text, comma, wbr, text, comma, wbr, text]
    const seq = fixture.msgText.children;
    assert.equal(seq.length, 7);
    assert.equal(seq[1], textNodes[1]);
    assert.equal(seq[2], breaks[0]);
    assert.equal(seq[5], breaks[1]);
});

test('text without commas stays as plain textContent', function () {
    const fixture = createFixture();

    fixture.controller.show({
        title: 'no commas here',
        pauseTimer: true
    });

    assert.equal(fixture.msgText.textContent, 'no commas here');
    assert.equal(fixture.msgText.children.length, 0);
});

test('dismiss runs the current message callback and resumes paused activity', function () {
    const fixture = createTransitionFixture(null);
    let dismissed = 0;

    fixture.controller.show({
        title: 'choose',
        pauseTimer: true,
        onDismiss() {
            dismissed += 1;
        }
    });
    fixture.controller.dismiss();

    assert.equal(fixture.controller.isActive(), false);
    assert.equal(fixture.overlay.classList.contains('active'), false);
    assert.equal(dismissed, 1);
    assert.equal(fixture.getResumes(), 1);
});
