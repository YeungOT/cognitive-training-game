# Emotional Stroop research notes

Purpose: ground the emotional face–word Stroop game in the primary literature and record the design constraints that follow from it. Sources were read on 2026-10-06 from PubMed and PubMed Central. The Bio-protocol page cited by the user was behind a SafeLine human-verification wall and was skipped by user decision; this note covers the canonical literature instead.

## Three task families

1. **Classic colour-word Stroop.** A colour word is printed in a conflicting ink colour; the player names the ink colour. The task-relevant dimension is colour; the prepotent distractor is reading.
2. **Colour-emotional Stroop.** Emotional words are printed in coloured ink; the player names the ink colour. This is the classic emotional Stroop described by Williams, Mathews and MacLeod (1996). It is the most widely used variant, but the emotional word is not part of the response set, so it is not a true response-conflict Stroop.
3. **Emotional face–word Stroop.** An emotional word is overlaid on an emotional face. Both dimensions map to the same response set, so the distractor can produce a genuine response conflict. This is the family used by this game.

## The two face–word directions

- **Face-target**: the player classifies the face and ignores the word. Reading is the prepotent distractor. Used by Agustí et al. (2017), Kar et al. (2018), Berger et al. (2019), Nigam and Kar (2021) and Meléndez et al. (2020).
- **Word-target**: the player classifies the word and ignores the face. Face processing is the prepotent distractor, which the ABCD study argues makes the response conflict stronger. Used by the Emotional Word–Emotional Face Stroop (Smolker et al., 2022).

The choice is a real trade-off. Face-target remains playable without literacy, but a non-reader does not process the word and therefore does not experience Stroop interference. Word-target requires reading, so it cannot be used by a non-reader, and the therapist cannot read the word aloud without giving away the answer.

## What the key studies do

| Study | Stimuli | Target | Conditions | Timing and response |
|---|---|---|---|---|
| Williams, Mathews and MacLeod (1996) | Emotional and neutral words in coloured ink | Ink colour | Emotional vs neutral, often blocked | Vocal colour naming; the canonical review |
| Algom, Chajut and Lev (2004) | Emotional and neutral words | Ink colour, reading, lexical decision | Blocked and mixed | The slowdown disappeared when emotional and neutral words were mixed in one block |
| McKenna and Sharma (2004) | Threat and neutral words | Ink colour | Contingency manipulated | Fast vs slow components, including a reversed effect |
| Phaf and Kan (2007) | Meta-analysis of 70 studies | Ink colour | Mostly blocked | Largest effects with blocked threat words; no evidence for suboptimal presentation; slow disengagement |
| Agustí et al. (2017) | Happy/sad words over happy/sad faces | Face and word separately | Congruent vs incongruent | 85 young and 66 older adults; more interference on positive stimuli; older adults had more difficulty with positive incongruent trials |
| Meléndez et al. (2020) | Happy/sad words over happy/sad faces | Face and word | Congruent vs incongruent | 25 healthy older, 25 mild AD, 25 moderate AD; in AD, less interference on words than on faces |
| Kar et al. (2018) | Happy/sad/angry words over matching faces | Face emotion | Congruent vs incongruent | Three-choice emotion identification; proactive and reactive control effects |
| Berger et al. (2019) | Faces with word labels; words with face backgrounds | Face (Exp. 1) and word (Exp. 2) | Congruent, incongruent, non-word or obscured | Older adults (mean age 72.9, MMSE >= 27) deployed proactive control; incongruent around 802 ms vs 762 ms for congruent and non-face |
| Nigam and Kar (2021) | Happy/fear words over happy/fear faces | Face emotion | Congruent vs incongruent | Young, middle-aged and older adults; older adults showed stronger adaptation for positive affect |
| Smolker et al. (2022) | Emotional word over an emotional face | Word valence | 75/25 and 50/50 blocks | 96 trials in two 48-trial blocks; 2000 ms window; two-choice positive/negative response; non-response counted as error; happy and angry faces balanced per block; response mapping counterbalanced |
| Whalen et al. (2006) | Emotional and neutral words repeated 1-4 times | Number of words | Emotional vs neutral | Manual button press instead of speech; about 20 minutes; designed for fMRI |

## Methodological cautions

- **The effect is not automatically a selective-attention effect.** Algom et al. (2004) found that reading, lexical decision and colour naming were all slower for emotional words, and the delay was absent when emotional and neutral words were mixed in one block. This is the strongest argument for including a neutral-word baseline rather than only congruent and incongruent trials.
- **The effect is mostly slow.** McKenna and Sharma (2004) and Phaf and Kan (2007) found the emotional Stroop effect depends on a slow disengagement process rather than a fast, automatic bias. Blocked designs inflate it: in the Phaf and Kan meta-analysis the largest effects came from blocked threat-word presentation.
- **Word control matters.** Larsen, Mercer and Balota (2006) evaluated 1,033 words from 32 studies and found emotional words were lower in frequency, longer, and had smaller orthographic neighbourhoods than control words. A neutral-word baseline must be matched on those features or the comparison is confounded.
- **Difference scores are noisy.** Strauss et al. (2005) found test-retest reliability was high for response latencies alone but unacceptably low for difference scores. Eide et al. (2002) reported a similar measurement-change paradox. A single-session interference score must not be presented as a stable clinical measure.
- **Anxiety effects are real but small.** Bar-Haim et al. (2007) meta-analysed 172 studies and found a threat-related attentional bias of about d = 0.45, present in anxious groups and absent in non-anxious individuals. This is not a large effect.

## Older adults, depression and dementia

- Healthy older adults can perform the face–word task and deploy proactive control (Berger et al., 2019).
- Older adults show a positive-affect shift in conflict adaptation (Nigam and Kar, 2021), and Agustí et al. (2017) found older adults had particular difficulty with positive incongruent trials.
- In probable Alzheimer's disease, conflict adaptation is reduced or absent (Satorres et al., 2020), and face-based interference changes relative to word-based interference (Meléndez et al., 2020). Meléndez et al. concluded that in AD, words may be a better route to emotion recognition than faces.
- Older adults with major depressive disorder show larger Stroop effects and less conflict adaptation than healthy older adults; word processing is more automatic than face processing for them (Ros et al., 2023).
- In early dementia, the emotional Stroop effect is present but declines over about 20 months, independently of MMSE change (Martyr et al., 2024).

## Design implications

- Use both task directions, but make face-target the default because it remains playable without literacy. Treat word-target as the stronger response-conflict mode and do not offer read-aloud as a fallback inside it.
- Use happy and sad for v1. They are the balanced pair with older-adult evidence; collapsing all six expressions into positive/negative confounds valence with specific emotion.
- Include a matched neutral-word condition. It is the only way to separate a generic emotional slowdown from response conflict.
- Mix conditions inside the block rather than blocking them. Blocked designs inflate the slow component, and Algom et al. showed the effect can vanish in mixed blocks.
- Treat 2000 ms as the research reference window, not the care-home default. Use 3000 ms by default and keep the 96-trial 75/25 and 50/50 profile as a deferred assessment mode.
- Log accuracy and reaction time per condition, but present the interference effect only as an exploratory within-session number, never as a diagnosis.
- Expect engagement from celebrity faces, but not a large interference effect from fame alone. The active ingredient is the emotional expression and its relevance to the player.

## References

- Williams, J. M., Mathews, A., & MacLeod, C. (1996). The emotional Stroop task and psychopathology. *Psychological Bulletin, 120*(1), 3-24. PMID 8711015.
- Algom, D., Chajut, E., & Lev, S. (2004). A rational look at the emotional Stroop phenomenon: A generic slowdown, not a Stroop effect. *Journal of Experimental Psychology: General, 133*(3), 323-338. PMID 15355142.
- McKenna, F. P., & Sharma, D. (2004). Reversing the emotional Stroop effect reveals that it is not what it seems. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 30*(2), 382-392. PMID 14979812.
- Phaf, R. H., & Kan, K. J. (2007). The automaticity of emotional Stroop: A meta-analysis. *Journal of Behavior Therapy and Experimental Psychiatry, 38*(2), 184-199. PMID 17112461.
- Larsen, R. J., Mercer, K. A., & Balota, D. A. (2006). Lexical characteristics of words used in emotional Stroop experiments. *Emotion, 6*(1), 62-72. PMID 16637750.
- Strauss, G. P., Allen, D. N., Jorgensen, M. L., & Cramer, S. L. (2005). Test-retest reliability of standard and emotional Stroop tasks. *Assessment, 12*(3), 330-337. PMID 16123253.
- Eide, P., Kemp, A., Silberstein, R. B., Nathan, P. J., & Stough, C. (2002). Test-retest reliability of the emotional Stroop task. *The Journal of Psychology, 136*(5), 514-520. PMID 12431035.
- Bar-Haim, Y., Lamy, D., Pergamin, L., Bakermans-Kranenburg, M. J., & van IJzendoorn, M. H. (2007). Threat-related attentional bias in anxious and nonanxious individuals. *Psychological Bulletin, 133*(1), 1-24. PMID 17201568.
- Agustí, A. I., Satorres, E., Pitarque, A., & Meléndez, J. C. (2017). An emotional Stroop task with faces and words: A comparison of young and older adults. *Consciousness and Cognition, 53*, 99-104. PMID 28654840.
- Kar, B. R., Srinivasan, N., Nehabala, Y., & Nigam, R. (2018). Proactive and reactive control depends on emotional valence: A Stroop study with emotional expressions and words. *Cognition and Emotion, 32*(2), 325-340. PMID 28393610.
- Berger, N., Richards, A., & Davelaar, E. J. (2019). Preserved proactive control in ageing: A Stroop study with emotional faces vs. words. *Frontiers in Psychology, 10*, 1906. PMID 31551848.
- Nigam, R., & Kar, B. R. (2021). Conflict monitoring and adaptation to affective stimuli as a function of ageing. *Cognitive Processing, 22*(4), 675-690. PMID 34212253.
- Smolker, H. R., et al. (2022). The Emotional Word-Emotional Face Stroop task in the ABCD study. *Developmental Cognitive Neuroscience, 53*, 101054. PMID 34954668.
- Satorres, E., Oliva, I., Escudero, J., & Meléndez, J. C. (2020). Conflict monitoring on an emotional Stroop task in healthy older adults and probable AD. *Journal of Clinical and Experimental Neuropsychology, 42*(5), 485-494. PMID 32354296.
- Meléndez, J. C., Satorres, E., & Oliva, I. (2020). Comparing the effect of interference on an emotional Stroop task in older adults with and without Alzheimer's disease. *Journal of Alzheimer's Disease, 73*(4), 1445-1453. PMID 31929162.
- Ros, L., et al. (2023). Differential effects of faces and words in cognitive control in older adults with and without major depressive disorder. *Applied Neuropsychology: Adult, 30*(2), 239-248. PMID 34137651.
- Martyr, A., et al. (2024). Exploring longitudinal changes in implicit awareness of dementia: An investigation of the emotional Stroop effect in healthy ageing and mild dementia. *Journal of Neuropsychology, 18*(2), 226-238. PMID 37658549.
- Whalen, P. J., Bush, G., Shin, L. M., & Rauch, S. L. (2006). The emotional counting Stroop: A task for assessing emotional interference during brain imaging. *Nature Protocols, 1*(1), 293-296. PMID 17406247.
