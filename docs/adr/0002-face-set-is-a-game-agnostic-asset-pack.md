# Face Set is a game-agnostic asset pack

The emotional face–word Stroop needs celebrity expression images, and more face-based games are expected to share them. We decided the images are exposed through one game-agnostic Face Set module that owns people, expressions, display labels, file paths, availability, and validation. Games query faces by person and expression and never construct filenames. The module is an in-process data module, not a port with providers: there is one repaired pack and the likeness rights are clear, so a provider seam would be a hypothetical seam with one adapter.

## Status

Accepted

## Considered Options

- **Flat exported array** — rejected. Callers would duplicate filtering, path construction, availability checks, and key-to-label mapping, so deleting the module would not remove complexity; it would spread it.
- **Provider/port plus adapters** — rejected. One adapter means a hypothetical seam. Revisit only if a second face pack, such as a licensed or generic set, actually exists.
- **Keyed manifest plus query functions** — accepted. Small interface, hidden path and validation logic, one place for every future face game to share.

## Consequences

- `js/celebrity-faces.js` exposes `people`, `expressions`, `getFace(personId, expressionKey)` and `listFaces(filter)`.
- The manifest defines all six expression keys. v1 ships thirty images: `開心`, `傷心`, and `無表情`; the neutral images are the baseline distractor for word-target trials. Adding the remaining expressions later is a data change behind the same interface.
- File layout can change without touching game modules.
- The module is in-process and tested through its interface; no adapter or mock is needed.
