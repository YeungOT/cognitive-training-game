# Emotional face–word Stroop v1 is a care-home game, not a research measurement

The care-home setting and the emotional Stroop literature both constrain the first version. We decided v1 is a face–word emotional Stroop with both task directions: face-target (`睇表情`) is the default and word-target (`睇文字`) is switchable through the existing rule-text popup. It uses happy and sad faces for the emotional trials, plus the neutral face as the word-target baseline distractor. Three trial conditions (congruent, incongruent, neutral) are mixed 1:1:1, with six practice trials then 48 measured trials, and a 3000 ms default response window adjustable from 5000 ms to 1500 ms through the existing speed control. The round runs on the existing Go/No-Go auto-advance mechanism, so no timer or session module changes are needed. The 96-trial ABCD-style 75/25 and 50/50 assessment profile is deferred to a later mode; difference scores are known to be noisy, so v1 logs accuracy and reaction time but does not present a diagnostic interference score.

## Status

Accepted

## Considered Options

- **Colour-emotional Stroop** — rejected. The emotional word is not response-relevant, Algom et al. showed the colour-naming delay is often a generic slowdown rather than a Stroop effect, and the separate colour game already owns colour-word interference.
- **Face-target only** — rejected. The user wants both directions; word-target gives the stronger response conflict because face processing is prepotent.
- **All six expressions collapsed into positive/negative** — rejected for v1. The positive pole would always be happy while the negative pole has four expressions, confounding valence with specific emotion. Happy/sad is the balanced pair with older-adult evidence.
- **Congruent/incongruent only** — rejected. A matched neutral-word baseline is needed to separate emotional slowdown from response conflict.
- **Blocked 75/25 and 50/50 from the start** — rejected for v1. Blocked emotional designs inflate the slow component; mixed is the more conservative game mode. The ABCD profile becomes the deferred assessment mode.
- **Response-driven one-shot trial timer** — rejected for v1. The existing auto-advance `CognitiveActivity` already provides pace control, misses, and pause/resume behaviour used by Go/No-Go. Reusing it keeps the game consistent and avoids a new timing seam.

## Consequences

- The v1 round is a game, not a research-grade measurement. It can show within-session patterns but must not be presented as a diagnostic attention-bias score.
- The assessment profile is a settings variation over the same trial generator, not a second game.
- The game consumes `CognitiveGameScreen`, `CognitiveRouter`, `CognitiveKeyboard`, `CognitiveActivity`, `CognitiveActivityTimer`, `CognitiveMessage`, `CognitiveFeedback`, `CognitivePrefs`, `CognitiveSettingsStore`, `js/layout.js`, the shared CSS, and `tools/generate-service-worker.js` unchanged.
- New modules are limited to the Face Set manifest, the pure trial generator, the session state machine, and the game-specific screen, view, and mount. Navigation follows the palm and N-back direct home-tile pattern rather than the food registry.
