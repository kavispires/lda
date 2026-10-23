# The Search - Show and Simulator Plan

## Status and scope

This is a living design document, not a description of completed functionality.
It covers setup (episode 0) and all 11 competition episodes, with particular focus
on player interaction and how the simulation systems connect.
- **Established:** Requirements from the season outline and subsequent design decisions.
- **Proposed:** Design suggestions to connect those requirements; not yet approved.
- **Open:** Decisions that must be settled before implementing the affected system.

Contestant management, card libraries, and cast initialization currently exist.
The previous Episode 1 implementation and its episode engine have been removed.
The episode mechanics described here must be designed and implemented anew.
Genre Affinity and the temporary Practice aggregation are now present in the
contestant model and interfaces; practice-session and performance engines remain
unimplemented.

### First playable milestone and blockers

**Established milestone 1:** Setup → 50 Auditions → results → 30 surviving
contestants, not all 11 episodes. Include the established broadcast-package player
interaction and meaningful audience/popularity consequences, not merely a scoring
and elimination screen. Later episodes require separate design; the full-season
rules below are not implementation-complete.

Settle the remaining contracts in this approved order:
1. [ ] **Songs/selection:** Actual fixed-arrangement song/part catalog and ordered
   per-skill requirements; pool size, insufficient-library behavior, selection
   weights, and off-track probabilities.
2. [ ] **Live reactions:** Triggers, magnitudes, temporary performance influence,
   and directional relationship consequences.
3. [ ] **Broadcast/audience:** Audience-only raw/adjusted doubles and twist effects,
   appeal/fan acquisition, satisfaction/viewer deltas; package composition/count,
   alternatives and number of choices, exposure/runtime allocation. Preserve the
   exposure floor, no editing influence on survival, and six mood picks at +3%
   each (maximum +18%).
4. [ ] **Episode closure:** Exact reveal/results timing, cumulative score
   contributions under the existing ranking rules, MVP procedure/ties, and
   secret-check resolution/order. Keep established shortlist and no-op rules.

Build the complete slice after these contracts are settled. Isolated scoring
implementation requires a separate request. Runtime foundations must support
seeded reproducibility, frozen source snapshots, persisted outcomes, choices, and
phase resumption throughout. Practice is not a launch blocker: milestone 1 has no
simulated practice sessions.

## Interview checkpoint

Auditions scoring is confirmed; the next interview follows the blocker order above.
The skill-and-requirement minimum-face mechanic replaces the earlier stat-based
baseline and direct consistency variance formula for milestone 1. Utility-driven
Practice remains specified for later episodes; its engine is not implemented.

Latest confirmed performance decisions:
- Share one ordinary raw 2d6 pair per contestant performance across technical,
  stage-presence, and all four bonus-quality checks. For each check use
  `floor = clamp(2 * skill - required level, 1, 5)` and `adjusted face = max(raw, floor)`.
- Technical parts retain ordered skill weights `[2, 1, ...]` and difficulty
  ceilings 60/70/80/90/100 for requirements 1–5.
- Stage presence uses the integer `stagePresence` skill, requirement 3, and
  `100 * (adjustedSum - 2) / 10`, without a technical ceiling. Visual, uniqueness,
  potential, and charisma each use the corresponding skill and that same
  requirement/conversion. Calculate all four impressions even when only two score.
- Batches remain 13/13/13/11. First-batch preferences are independent seeded equal
  choices within each pair. Later batches use only the immediately previous
  batch: quality satisfaction is `max(mean impression, 0.8 * highest impression)`;
  selection weight is `101 - satisfaction`. Make independent weighted choices
  per pair and lock preferences before the whole batch.
- `final = min(100, .55 * technical + .35 * stagePresence
  - .10 * selectedBonusA + .10 * selectedBonusB)`. Do not renormalize the possible
    110%. Rank and grade using unrounded values; round only for display (precision open).
- Equal capped final scores break ties by higher technical, then higher stage
  presence, then a persisted seeded draw, never hidden uncapped surplus.
- Absolute grades: A ≥85, B ≥70, C ≥55, D ≥40, F <40. These are agreed starting
  balance thresholds, calibratable against simulated distributions, not quotas.
  Bottom 20 by audition evaluation leave regardless of grade; no audience or
  production save.
- Auditions establishes the baseline: no growth bonus, simulated practice, or
  additional direct live consistency adjustment. Practice stays 0 and is omitted;
  the old variance formula is not stacked. Potential means demonstrated promise,
  not permanent growth.
- Live reactions remain required and immediate for later contestants, through
  temporary condition/readiness state and relationships, never instant permanent
  core/utility skill changes. Triggers, state, and formulas remain open; reactions
  are not Practice >0 and imply no approved dice modifier.
- Persist the season seed, frozen starting data, phase, choices, and resolved
  outcomes. The same frozen start/seed/choices reproduces results; reload never
  rerolls or reapplies effects. Deep-copy contestants and freeze simulation-relevant
  library/song definitions; source edits affect new runs only, never an active run.

Song choices still weigh ability and genre affinity with personality-driven risk;
investment, maturity, or discipline at +7 or above individually vetoes off-track
auditions. Actual song contracts, live reactions, broadcast/audience formulas, and
episode closure remain the next design work, not assumed implementation details.

## 1. Premise and player objective

The Search is a fictional music-survival-show simulator in the Squirrel Zone.
The season starts with 50 contestants and ends with a final group of five.

The player has small, occasional interactions with an autonomous show simulation.
They are not its master editor or the driver of every outcome. Their goal is to
keep the show popular. Two separate show-wide meters track audience size and viewer
satisfaction.

**Established through design interview:**
- Attention and enjoyment are separate: controversy can increase audience size
  while reducing satisfaction.
- Low satisfaction causes viewers to leave over subsequent episodes.
- After the finale, show a post-season outcome in which satisfaction determines
  how many viewers remain fans of the final group. Finale controversy therefore
  still has a long-term consequence.
- Player authority is episode-specific. Each mission explicitly defines which
  choices belong to contestants and which belong to production.
- There is no recurring player-controlled editing loop. Auditions has its own
  package-selection interaction; other episodes need their own small interactions.
- Except for Auditions, episodes show practice, training, exhaustion, conflicts,
  and friendships unfolding before the later performance and elimination/results.
- After each episode, contestants choose an MVP or MVPs recognizing the preceding
  episode. One overall MVP is chosen by survivors under the shared MVP rules;
  exact phase, voting procedure, and ties remain to be defined.

Every episode must include player interaction. Every offered choice must affect
at least one contestant or the show itself, immediately or through a recorded
future consequence, with one explicit exception: selecting someone without a
secret in the end-of-episode check intentionally has no effect.

**Proposed:** Make the challenge balancing entertainment, performance quality,
audience attachment, and confidence in the show's fairness. Favoring a contestant
may create a star, but obvious favoritism may hurt the show.

**Established:** Seasons always complete all 11 episodes. Poor audience results do
not cancel the show; consequences appear in the season's audience history and the
post-season fan-retention outcome.

**Open:** How final outcomes are evaluated and how much of the underlying
calculation is visible to the player.

## 2. Season structure

Counts refer to active contestants. Eliminated contestants remain in the season
archive and history.

**Established withdrawal exception:** Withdrawals are rare (usually none; one or
two may occur in a season) and can trigger only in episodes with enough scheduled
elimination slots to absorb them. A departure consumes one of that episode's
elimination slots rather than adding another exit.

Announce that the contestant chose to leave, then reveal during the elimination
ceremony that there will be fewer competitive eliminations because of the departure.
The reduced cut is a surprise for the audience and other contestants. Preserve the
table's total departures and remaining cast counts.

**Open:** Withdrawal triggers/probabilities, a hard season cap, timing within an
eligible episode, player foreknowledge, and adjustments to team-specific cuts/saves.
Record withdrawal separately from competitive elimination in season history.

| Episode | Title                   | Starting cast |            Departures | Remaining |
| ------- | ----------------------- | ------------: | --------------------: | --------: |
| 0       | Setup and Opening Title |   50 selected |                     0 |        50 |
| 1       | Auditions               |            50 |                    20 |        30 |
| 2       | Group Battles           |            30 | 12, after three saves |        18 |
| 3       | Boot Camp               |            18 |                     0 |        18 |
| 4       | Mega Groups             |            18 |                     2 |        16 |
| 5       | Photoshoot              |            16 |                     0 |        16 |
| 6       | Track Specials          |            16 |                     1 |        15 |
| 7       | Versatility             |            15 |                     3 |        12 |
| 8       | Variety Show            |            12 |                     2 |        10 |
| 9       | Music Videos            |            10 |                     1 |         9 |
| 10      | Specialties             |             9 |                     1 |         8 |
| 11      | Finale                  |             8 |                     3 | 5 winners |

## 3. Shared episode loop

Use a coherent episode progression without turning every phase into a player
decision. Most activities and outcomes resolve autonomously.

**Proposed phase structure reflecting the established pacing:**
1. **Briefing/opening:** Explain the mission and stakes; broadcast the opening.
2. **Preparation:** Contestants form teams, assign roles, and choose material under
   the episode's rules.
3. **Practice and daily life:** Show training, exhaustion, conflicts, friendships,
   and their consequences. Auditions is exempt from this required practice arc.
4. **Small player interaction:** Present the episode-specific opportunity at its
   appropriate point, without requiring the player to manage every activity.
5. **Performance:** Simulate and present the challenge from the resulting state.
6. **Broadcast reaction:** Allocate exposure and calculate audience/viewership
   changes. This does not require an editing decision in every episode.
7. **Results:** Resolve the applicable judges, votes, saves, and eliminations.
8. **Recap and peer recognition:** Explain changes, save the episode, and resolve
   or schedule the contestants' MVP recognition for the completed episode.

The ordering can vary when the episode requires it. Each phase must use a clearly
defined snapshot: later audience reaction cannot retroactively change a performance.
When results are broadcast after voting, distinguish that reaction from the vote
that already closed.

The player can inspect relevant contestant information before deciding. Choices
should preview their intent and tradeoff, not guarantee an exact outcome.

**Proposed decision contract:** Each interaction records its available options,
eligibility rules, selected option, affected entities, immediate changes, deferred
consequences, and a human-readable explanation. Contestant and audience autonomy
must remain visible; production decisions are not automatic wins.

## 4. How the systems connect

**Proposed causal model:**

```text
Player choices + contestant traits + current state
    -> preparation, roles, relationships, and production priorities
    -> performance quality and contestant events
    -> broadcast edit and allocated screen time
    -> audience response, fanbase changes, and show viewership
    -> applicable rankings, saves, and eliminations
    -> emotional changes, relationship changes, and next episode's state
```

### Contestant attributes

Use `types/contestant.ts` as the starting model, rather than creating an unrelated
set of game stats.

| Existing data                             | Proposed role in the simulation                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Core skills                               | Track execution, stage presence, visuals, uniqueness, and leadership                                                 |
| Utility skills                            | Training growth, memory, stamina, performance variance, and variety ability                                          |
| Personality                               | Autonomous choices, cooperation, conflict, stress responses, and public perception                                   |
| Specialties                               | Song, concept, role, and mission fit                                                                                 |
| `condition` and happiness                 | Readiness, recovery needs, and reactions to outcomes                                                                 |
| `relationships`                           | Teammate preference, trust, cooperation, conflict, and emotional consequences                                        |
| `audienceRatio`                           | General audience preference toward an individual contestant                                                          |
| `fanbaseRatio`                            | Strength of that contestant's committed voting support                                                               |
| `productionRatio`                         | Production preference and editorial attention, not audience approval                                                 |
| `contestantsLikeness`                     | Summary of incoming relationships from other contestants                                                             |
| `screenTime`                              | Cumulative exposure; keep episode-specific allocations separately                                                    |
| `score`, `grade`, `rank`, `missionRating` | Cumulative points, quality grades, overall season standing, and mission evaluation; exact point mapping remains open |
| Leader, center, and MVP counts            | Recorded opportunities and achievements                                                                              |
| Cards, events, and change logs            | Starting influences, triggered developments, and traceable history                                                   |

Ratios currently use -1 to 1; relationships and happiness use 0 to 100.
Skills used in checks and their required levels use integers from 1 to 5, never
fractional skill values; Practice additionally allows 0 for "Not practiced".
Personality traits use -10 to 10. New formulas must respect
these units and avoid mixing percentages, ratios, points, and broadcast minutes.

### Performance and judging

**Established evaluation goal:** Reward delivered quality, including difficulty,
plus a bounded bonus for meaningful improvement in later episodes. Auditions
establishes the baseline and has no growth bonus. Later growth measurement,
eligibility, and limits still need definition.

**Established granularity:** Simulate contestants' assigned performance parts,
then aggregate those outcomes into individual evaluations and group results.
Both core skills and utility skills must play meaningful roles. The existing
`PerformanceSong` / `PerformancePart` structures are a starting point, not a
completed scoring system.

**Established design order:** Define the performance/challenge/task setup before
choosing difficulty ceilings or bonuses. Auditions' difficulty ceilings and
star-quality scoring are confirmed below; later challenge rules remain separate.

#### Genre affinity - contestant data implemented, performance integration planned

**Established shape:** Add a genre-affinity specialty using a six-entry library
following the `AttributeCard` pattern in `utilities/attribute-libraries.ts`.
Each entry can represent a cluster of musical genres rather than one literal genre,
similar to the existing dance-style archetypes. This is not a per-genre numeric
rating map or an arbitrary list of preferred genres.

**Established six clusters:**

| Affinity          | Musical cluster                                    |
| ----------------- | -------------------------------------------------- |
| Mainstream Pop    | Pop, dance-pop, catchy chart material              |
| Soul & Groove     | R&B, soul, funk                                    |
| Hip-Hop           | Rap-led music and rhythmic crossover               |
| Rock Edge         | Rock, pop-rock, punk-influenced material           |
| Acoustic & Ballad | Intimate ballads, folk, singer-songwriter material |
| Electronic        | Electro, house, synth-driven club music            |

**Proposed integration:** A contestant selects one affinity archetype; musical
tasks/songs declare matching affinity favors so the specialty can affect fit.
Keep genre affinity distinct from track and technical ability. Non-musical tasks
need not have a genre.

**Established audience integration:** Genre affinity is the sixth audience-mood
category, using the same shortlist/no-repeat rules and +3% match bonus. The maximum
six-category bonus is +18%, replacing the earlier five-category +15% maximum.

**Implemented:** `specialties.genreAffinity` and the six-entry
`GENRE_AFFINITIES` library, with equal initial occurrence weights and no stat
influences. The creator supports selection/randomization; review, detail,
statistics, and listing views include the specialty. Older profiles and saved
drafts normalize to an unselected affinity, without randomly assigning one.
`PerformancePart.specialtyFavors` can also reference genre affinity.

**Open:** Performance-fit effects and the remaining song metadata. Episode
audience-mood selection and voting bonuses are planned, not implemented.

#### Task structure and evaluation - design in progress

**Established tested-skill structure:** Each performance part lists its tested
skills in order. The first skill has double the weight of each remaining skill:
weights are `[2, 1, 1, ...]`, normalized by their sum when combining contributions.
For two skills, the shares are 2/3 and 1/3; for three, they are 1/2, 1/4, and 1/4.
Each entry carries its own required level; for example, one part may require
vocals 4 and dance 3. This replaces the earlier single-overall-difficulty design.
Apply each skill's minimum to the shared raw dice separately, then combine the
evaluated skill outcomes at those weights. Conversion to a 0-100 technical score
uses each tested skill's difficulty ceiling and the dice conversion below.

**Established audition integration:** Ordered tested-skill weights combine skills
inside the 55% technical component. They do not replace the separate 35% stage
presence contribution or the two batch-dependent 10% bonuses.

**Established difficulty reward:** Use difficulty-dependent technical-score
ceilings. Easy material has a lower maximum technical score; harder material
unlocks top technical marks. This is not the alternative where easy material
can earn full technical marks and difficult material receives an extra bonus.
Audition star-quality contributions remain separate.

| Required difficulty | Maximum technical score |
| ------------------- | ----------------------- |
| 1                   | 60                      |
| 2                   | 70                      |
| 3                   | 80                      |
| 4                   | 90                      |
| 5                   | 100                     |

**Established technical-score conversion:** After applying a tested skill's
minimum to each die, convert its adjusted total to a fraction of that skill's
difficulty ceiling:

```text
delivery fraction = (adjusted die 1 + adjusted die 2 - 2) / 10
skill technical score = delivery fraction * difficulty ceiling
part technical score = sum(skill technical score * skill weight) / sum(skill weights)
```

Thus an adjusted total of 2 earns 0% of the ceiling, 7 earns 50%, and 12 earns
100%. Apply each skill's own ceiling before combining contributions at weights
`[2, 1, 1, ...]`.

**Worked tested-skill example, before Practice:** Bob has vocals 3 and dance 4.
A part lists vocals first,
requiring vocals 4 and dance 3. With shared raw dice `[1, 4]`:

| Tested skill | Minimum | Adjusted dice | Delivery fraction | Ceiling | Skill score |
| ------------ | ------- | ------------- | ----------------- | ------- | ----------- |
| Vocals       | 2       | 2, 4          | 40%               | 90      | 36          |
| Dance        | 5       | 5, 5          | 80%               | 80      | 64          |

The vocal/dance subtotal is `(2 * 36 + 64) / 3 = 45.333...`.
In milestone 1 Auditions, Practice is 0, so retain this subtotal and apply the 55%
technical weight. In later episodes with nonzero Practice, the complete part
technical score is `(2 * 36 + 64 + practice technical score) / 4`, before any
mission-specific component weight.
Practice uses the primary vocal requirement of 4, so its technical-score ceiling
is 90. If Bob has Practice 3, its minimum is 2, giving adjusted dice `[2, 4]`
and a Practice technical score of 36. The complete part score is
`(2 * 36 + 64 + 36) / 4 = 43`, before the later mission's component weight.
If Bob has Practice 0, omit that contribution and retain the vocal/dance subtotal.
Fractional scores are distinct from skill values, which must remain integers.
Retain unrounded component/final scores for ranking and grades; round only for
display. The number of displayed decimals remains open.

**Proposed:** Define performance criteria per challenge. Track skill, difficulty,
specialty fit, preparation, condition, and team cooperation should matter in
different proportions in later missions. Consistency may affect practice in
sessions that test it; no extra direct live consistency adjustment applies in
milestone 1.

Store component scores and explanations, not just a total. Keep technical
performance, trainer/judge evaluation, audience preference, and production
preference separate so each episode can use its intended decision-maker.

Core and utility growth should follow training and experience. Personality
should shape behavior, not act as a universal "positive traits always win" bonus.

**Established condition pacing:** Exhaustion partially recovers between episodes;
severe exhaustion and injuries can persist. It should be a light supporting system,
not a heavily featured survival-management mechanic. Prioritize an entertaining show
and contestant journey rather than constant rest scheduling.

**Open for later missions:** Score scales, weights, growth limits, randomness
bounds, and any additional judging influence. Auditions' component rules are
established below; production cannot affect its survival cutoff.

#### Practice and temporary performance readiness

**Established:** Episodes include practice sessions that primarily test utility
skills. Each episode determines which utilities are relevant; examples include
memory, stamina, learning, and consistency. Do not require every utility in every
session. Milestone 1 Auditions has no simulated practice sessions: Practice remains
0 and is omitted from scoring. This later-episode system is not a launch blocker.

Practice sessions automatically yield a temporary **Practice** skill that
contributes to the upcoming performance. Keep this readiness value distinct from
permanent core/utility skill growth and from the separate meaningful-growth bonus.

**Established performance integration:** When Practice is nonzero, automatically
append it to each part's tested-skill list as a secondary skill with weight 1.
Its required level equals the requirement of that part's first-listed skill.
Preserve the original
first skill's weight of 2; every other listed skill remains weight 1. For
`[vocals, dance]`, the scoring weights become vocals 2, dance 1, Practice 1:
50%, 25%, and 25% of that part's technical score. For a one-skill part, the original
skill receives 2/3 and Practice receives 1/3. Practice is separately scored, not
merely a modifier to the other skills' minimum faces.

**Implemented state placement:** `aggregations.practice` is a numeric field,
defaulting to 0 ("Not practiced"). The creator displays it read-only; practice
sessions will calculate it, not the profile author. Review/detail views and an
optional listing column display it. Older records and saved simulations normalize
missing values to 0; fresh simulation initialization resets it to 0. Recorded
simulation values survive persistence/reload. Source profiles carry the default
field, but simulation updates must never write runtime practice results back to
the source contestant database.

**Established scope:** One temporary Practice value per contestant is shared
across the whole episode, including every performance/song and assigned part.
Do not maintain different readiness values for separate songs in the same
episode. Reset Practice to 0 at the beginning of every episode. After each
completed session, retain the greater of the existing Practice and that session's
result; a worse session never erases preparation.

**Established session resolution:**
- Each episode defines a finite set of sessions, each listing ordered utility
  skills with individual integer required levels from 1 to 5. Do not test core
  skills during practice. Vocal preparation might test learning, memory, and
  consistency; dance preparation might test acrobatics and stamina; rap preparation
  might test consistency, memory, and charisma. These are examples, not fixed lists.
- Roll ordinary 2d6 once per contestant per session. Share the raw faces across
  that session's tested utilities, independently of the later performance roll.
- For each utility, raise each raw face to at least
  `clamp(2 * utility - required level, 1, 5)`, then sum its adjusted faces.
- Weight the first-listed utility's adjusted sum twice and every remaining
  utility's adjusted sum once. Convert their unrounded weighted average using
  the bands below. Fractional intermediate averages are allowed; the resulting
  Practice skill is always an integer. Do not apply performance-score ceilings
  when generating Practice itself.

| Weighted adjusted sum | Session Practice result |
| --------------------- | ----------------------- |
| 2 to below 4          | 1                       |
| 4 to below 6          | 2                       |
| 6 to below 8          | 3                       |
| 8 to below 10         | 4                       |
| 10 through 12         | 5                       |

For example, utility sums of 8 and 5 with weights 2 and 1 yield
`(2 * 8 + 5) / 3 = 7`, giving session Practice 3.

**Established unpracticed behavior:** Practice 0 means no completed practice,
not a failed session. Every completed session yields at least 1. When Practice is
0, omit it from performance scoring and calculate weights from the part's listed
skills alone. Performances without practice are expected to be rare.

**Established limits and traceability:** There are no unlimited player-triggered
retries. Additional sessions require an explicitly defined episode event or
player opportunity. Record each session's tested utilities and requirements,
raw dice, adjusted sums, session Practice result, and whether it improved the
episode's best value. Present a concise result with expandable details and persist
resolved outcomes so reloading never rerolls them.

**Scope boundary:** These rules calculate temporary readiness only. Permanent
skill growth and fatigue/condition penalties need separate designs; do not invent
either as an implicit practice effect. The older direct consistency adjustment
is not stacked onto these checks or milestone 1 live scoring. Consistency can
contribute through practice sessions that explicitly test it.

#### Automatic 2d6 execution mechanic

**Established minimum-face calculation:** Skill and difficulty determine the
minimum face on each die:
`minimum face = clamp(skill + (skill - required difficulty), 1, 5)`.
Their example gives vocals 3 against difficulty 4 a minimum of 2, and dance 4
against difficulty 3 a minimum of 5; untested rap contributes nothing.
The minimum cannot exceed 5: even an expert on easy material must actually roll
a six to receive a six. A calculated minimum below 1 becomes 1.
Tested skill affects technical execution only through this minimum. If different
skill levels produce the same clamped minimum on the same task, identical
technical chances are intentional. For example, skills 1, 2, and 3 against
difficulty 5 all have minimum 1. Do not add a second direct skill modifier merely
to distinguish them.
Auditions' scoring components are finalized below. Actual song/part contracts,
live-reaction influence, and audience-only critical twists still need design;
later missions require their own aggregation rules.

**Established minimum-face handling:** Roll ordinary d6s with faces 1 through 6,
then raise any face below the tested skill's calculated minimum to that minimum.
Do not sample equally among only the allowed faces or reroll low results.
Apply each tested skill's minimum to the same underlying pair, preserving the
one-roll-per-contestant-per-performance rule.

For Bob's dance skill 4 against difficulty 3, the calculated minimum is 5:
raw faces 1 through 5 become 5, while 6 stays 6. A shared raw roll of `[1, 4]`
becomes `[2, 4]` for his vocal minimum of 2 and `[5, 5]` for his dance minimum of 5.
The minimum is derived from skill and difficulty, not always the saved skill alone.
Record both raw and adjusted faces; critical-twist interpretation remains open.

**Earlier baseline approach - superseded for milestone 1:** The previously agreed
stat-based expected-quality model is replaced by minimum-face scoring, not stacked
with it. The player does not manage every roll; relevant core and utility skills
must remain meaningful in their specified checks.

**Established roll cadence:** Roll once per contestant per performance, not once
per assigned part. Share the raw pair across the contestant's parts and apply each
tested skill's minimum separately; requirements and preparation still differ. Extra parts
must not grant additional independent rolls that average away execution risk.

**Earlier execution adjustment - historical, not used in milestone 1:** The old
formula centered ordinary 2d6 on 7 and scaled by consistency. Do not apply it to
raw or adjusted faces alongside the selected scoring mechanic:

```text
execution adjustment = (2d6 total - 7) * (6 - consistency)
quality before other modifiers = expected quality + execution adjustment
```

| Consistency | Adjustment per point above/below 7 | Possible adjustment |
| ----------- | ---------------------------------: | ------------------: |
| 1           |                                  5 |          -25 to +25 |
| 3           |                                  3 |          -15 to +15 |
| 5           |                                  1 |            -5 to +5 |

At consistency 3 and expected quality 70, a roll of 5 gives 64, 7 gives 70, and
10 gives 79 before other modifiers. Higher consistency narrows the swing; lower
consistency permits both bigger stumbles and bigger surprises.

**Established double-roll twists:** Special outcomes affect audience reception,
not a reversal of the technical execution adjustment:
- Double 1: Flawed execution can produce an unexpectedly captivating or authentic
  moment that wins people over: "supposed to be bad, but somehow amazing."
- Double 6: Technically excellent execution can feel sterile or overly by-the-book,
  producing a soft engagement penalty for lacking something special.

Keep the selected minimum-face technical scoring for judging/evaluation. Do not turn
double 1 into automatic technical perfection or double 6 into technical failure,
and do not add an unapproved second direct performance-score modifier.
Whether doubles are detected on raw or adjusted faces, audience-twist magnitudes,
trait/context conditions, and exact reception metrics still need definition.

**Proposed other utility roles:** Affect appropriate preparation, challenge, and
growth mechanics, not necessarily every score as universal bonuses.

Record rolls and their actual score effects so outcomes can be explained and
reloading does not reroll them. Remaining Auditions work includes song/part
contracts, temporary live-reaction influence, and audience-twist details, not a
second expected-quality formula or fractional skills. Later missions still need
aggregation, utility-effect, and growth rules.

**Alternatives not selected:** A success-count d6 pool and a skill-sized pool capped
at skill + 1 (using either its average or highest result) were explored. Do not
implement them alongside the selected 2d6 approach.

### Leaders and centers

**Established:** Every performance group has a leader/captain, and every performance
has a center. The leader may also be the center.

The team votes for its center. Voting preferences consider skill fit, ambition,
friendships, and rivalries. Stage presence, visual, and uniqueness are specifically
relevant; the performance determines which attributes matter more.

Leadership skill affects whether a captain can manage group tension. Putting
contestants who dislike each other on a team must not automatically make the team
fail: the leader's ability and the group's actual interactions matter.

**Open:** How leaders are selected outside episodes with explicit captain rules,
voter eligibility/self-votes, center-vote ties, whether centers can change between
performances, and how mission-specific criteria influence each voter's preference.

### Relationships

Relationships are directional: A liking B does not imply B likes A equally.
The existing `Record<string, number[]>` supports a value history per other contestant.

**Proposed:** Contestant-led team selection considers relationships alongside
skill fit and personality. Strong trust improves coordination; conflict may hurt
cooperation or create a compelling story without necessarily ruining a performance.
Production-assigned teams use the same relationship system.

Record changes from specific events such as support during practice, role disputes,
shared success, blame, betrayal, and elimination. Clamp values to 0-100 and explain
changes. Recompute `contestantsLikeness` from incoming relationships.

**Open:** Exact deltas, the active/archive population used for likeness, how
sensitivity and gentleness modify reactions, and when history samples are appended.
Do not change every pair automatically without a defined interaction or rule.

### Screen time and the opening

Every active contestant must receive at least 1% of the episode's contestant
screen-time budget. Popular contestants receive more; editorial choices and
meaningful events also influence the remaining allocation.

**Established:** Split-screen exposure counts for every contestant shown. If six
contestants share a section occupying 1% of the broadcast, each receives 1% exposure,
not one-sixth of 1%. Some contestants may receive exposure only through these cuts,
with no individually featured audition.

Broadcast duration and individual exposure are therefore different measurements.
Broadcast segments must fit within 100% of the defined runtime budget, but the sum
of individual exposure percentages can exceed 100% through simultaneous appearances.
Do not normalize individual exposure back to 100%, as that would erase this rule.

**Established for Episode 1:** Production automatically reserves baseline montage
coverage so everyone meets the minimum. Player-selected edit packages allocate
additional exposure; the player cannot accidentally omit someone from the baseline.

Exposure amplifies audience response to what was shown. More screen time is an
opportunity for popularity, not a guarantee of positive reception.

**Open:** Define the budget: contestant-focused airtime versus total runtime,
whether opening exposure counts toward the 1% floor, treatment of contestants
eliminated during that episode, and any airtime cap. Define how simultaneous
exposure affects attention/popularity compared with a solo feature; equal credited
duration does not yet imply equal audience impact.

### Audience, votes, and show viewership

Audience size and viewer satisfaction are **show-wide**. Neither is a contestant's
`audienceRatio` or simply the sum of contestant popularity.

**Established:** Audience size can rise even when satisfaction falls. Low
satisfaction causes viewer attrition over subsequent episodes. After the finale,
satisfaction also determines how many viewers remain fans of the final group.

**Proposed:** Use a 0-100 satisfaction meter and retain episode-by-episode history
for both metrics. Calculate satisfaction changes from performance quality,
engaging stories, attachment to the cast, variety, and perceived fairness.

**Established initial meters:** Audience size is a fictional viewer count, starting
at 100,000 viewers. Satisfaction starts at 50 on a 0-100 scale.

**Open:** The delay and strength of retention effects, new-viewer acquisition,
and the post-season conversion formula.

Individual audience preference, fanbase loyalty, and exposure can feed voting,
but need distinct roles and bounded effects. A disliked contestant can create
attention without making the show enjoyable.

**Established:** One overall ranking carries across the season, accumulating
contributions from audience votes, performances, and other factors. It is not
reset for each mission. Audience votes contribute from Episode 1, but the ranking
is not publicly revealed until Episode 3.

The overall ranking is distinct from a particular performance's evaluation.
Episode 1's performance-only elimination and Episode 2's team losses/saves retain
their explicit rules. Later references to "lowest ranked" use the cumulative
overall ranking, including Episode 4's lowest-ranked member within each group.
Episode 2 still needs an audience-save decision separate from normal rank updates.

**Established ranking inputs:** Audience votes, evaluated performance, and a
defined, limited production-preference contribution. Production influence is
hidden rather than an officially disclosed portion of the ranking. Viewers can
react to visible favoritism, suspicious results, or revealed manipulation, but
must not automatically know secret internal production values.

**Established baseline weights:**

| Episodes | Performance | Audience votes | Hidden production |
| -------- | ----------: | -------------: | ----------------: |
| 1-2      |         60% |            30% |               10% |
| 3-7      |         45% |            45% |               10% |
| 8-11     |         30% |            60% |               10% |

These weight each episode's new contribution; they do not replace Episode 1's
separate performance-only elimination rule.

**Established ranking memory:** Earlier contributions gradually lose weight. The
overall score is a decaying cumulative record, not an equally weighted permanent
sum and not an abrupt reset. Retain the original episode contributions in history.

At each completed episode, retain 75% of the previous total, then add that episode's
new weighted contribution:

```text
new overall score = previous overall score * 0.75 + new episode contribution
```

Apply the retention rule to the whole previous total. Older contributions retain
the weights they received when earned; do not retroactively reweight their history.

**Established component scales:** Each new-episode component uses 0-100.
Performance uses mission-specific evaluation; votes use leader-relative
normalization; production preference uses the existing -1 to 1 ratio:

```text
production component = 50 * (productionRatio + 1)
episode contribution = performance weight * performance component
                     + vote weight * vote component
                     + production weight * production component
```

Weights are fractions (for example, 60% is 0.60). Neutral production preference
therefore gives 50 production-component points, not a 50-point ranking bonus:
the 10% weight makes its new-episode contribution five points.

**Open:** Mission evaluation details, voting windows, tie-breakers, elimination
backlash, and what private ranking information the player can inspect before Episode 3.

**Established vote normalization:** Give the episode's leading vote-getter 100
vote-component points; other contestants receive points proportional to their
votes relative to that leader. Preserve vote gaps rather than using only positions.

```text
vote component = 100 * contestant votes / highest episode vote count
```

Raw vote counts remain in history. Define the no-votes case explicitly rather than
dividing by zero or inventing votes.

**Established fan behavior:** Loyal fan support persists across episodes, while
general audience preferences can change more readily. When a favorite leaves,
their fans generally transfer support to another contestant, especially someone
connected to that favorite, rather than automatically leaving the show.

**Established production-preference drivers:** A mixture of entertainment/story
value, final-group marketability, professional reliability, and skill potential.
Do not reduce production preference to a copy of either the technical score or
audience vote count.

### Episode audience preferences

**Established:** At the beginning of every episode, the player picks one value
from each of these six specialty categories to represent that episode's audience mood:
- `VOCAL_COLORS`
- `DANCE_STYLES`
- `RAP_STYLES`
- `VISUAL_VIBES`
- `LEADERSHIP_STYLES`
- Genre affinity (planned six-entry library)

Contestants matching those preferences receive more audience favor that episode.
Present small randomized shortlists per category, not the entire libraries.
Persist the selected mood with the episode.

**Established match strength:** Each matching category gives +3% general-viewer
vote appeal, stacking additively to at most +18% across six categories. Apply it
for that episode only. Do not rewrite skills/personality, multiply the signed
`audienceRatio` itself, or make loyal fans abandon an unmatched contestant.

Normally each pick must differ from the previous episode's pick in that category.
Shortlists use values held by active contestants. If no different active value
exists, allow a repeat rather than offering an irrelevant value or removing the
category's choice.

This is a recurring small player interaction, not a recurring editing loop.
It does not imply that the player controls contestant song choices or performances.

**Open:** Shortlist size/sampling, general-viewer appeal calculation and conversion
to votes, and whether the mood has any satisfaction effect.
The separate idea of audience segments is not an approved requirement.

**Open:** Fan acquisition and transfer proportions, aggregation/storage model,
how general audience preferences generate votes, and how fan support relates to
the existing `fanbaseRatio` modifier. Audience retention still follows the separate
show-satisfaction rules.

### MVP recognition

**Established:** Contestants choose MVP recognition for the preceding completed
episode. There is one overall MVP per episode, chosen by all survivors. Only
survivors can vote or receive the award; eliminated contestants are ineligible.
This is a peer decision, not the player naming a winner.

Each voter's perception of the performance and their relationships influence their
choice. Personality determines how strongly they value friendship compared with
perceived performance quality. Current overall rank does not directly determine
their choice; the MVP need not be the highest-ranked or technically best contestant.

**Open:** The precise post-elimination voting phase, self-votes, ties, perception
rules, and award consequences.
The existing `aggregations.mvp` can count awards, but retain each vote/award in
episode history rather than recording only a counter.

**Proposed:** Recognition affects emotions and relationships. Do not silently add
ranking points until an explicit reward rule is approved.

### Secrets and event consequences

Seven contestants receive hidden secret cards during setup. These may or may not
be revealed during the season. Reveal state is separate from owning the card.

**Established secret interaction:** The player does not know which contestants
have secret cards at setup. At the end of each eligible episode, offer three random contestants and
ask the player to choose one. If the chosen contestant has an unrevealed secret,
it becomes public and its consequences resolve. If they have no secret, no secret
is revealed and the show moves on. This is an intentional no-op: do not add
consolation exposure, a substitute scene, or another gameplay effect on a miss.

**Established shortlist pool:** Draw from everyone who participated in that episode,
including contestants who were just eliminated or withdrew. A reveal after departure
can affect the show and people's reactions, but cannot undo the departure.

**Established availability gate:** If no survivors have an unrevealed secret,
the secret-check segment can be skipped. Secret-specific roulette outcomes are
omitted when the current active cast has no eligible unrevealed secrets. Check
eligibility at the time of each phase, not using advance knowledge of future exits.
The end-of-episode gate applies even though an otherwise eligible shortlist may
include contestants who just departed.

**Established discovery events:** The roulette has distinct secret-discovery outcomes:
- A contestant discovers a secret and makes it public, triggering reveal consequences.
- A contestant discovers a secret but keeps it private, substantially changing the
  relationship between the discoverer and secret holder without a public reveal.

The selected event determines which branch occurs; it does not require a separate
player disclosure decision. Record what has become known and to whom. The sign and
size of the private relationship change need context-specific rules.

**Established player visibility:** A private-discovery event shows the full event
and secret to the player. The in-world audience still does not know it. This means
the player can gain knowledge through an event and use it in a later secret check;
initial secrecy is not a permanent ban on player discovery.

Initial card influences apply once; public reveal consequences apply when their
trigger occurs and must not repeat accidentally. Hidden secret assignments must
not leak through player-facing card lists or generic contestant details.

**Open:** Repeat selections and ordering relative to MVP voting.
Define audience/production responses using the existing card `consequence` data
where appropriate.

### Practice and dorm-life event roulette

**Established:** Episodes include varied autonomous events, especially during
practice and dorm life: fights, extra bonding, secret discoveries, and other
developments. An episode can contain multiple events, not just one.

A visual roulette is a desired presentation, with roughly 8-12 possible outcomes
under consideration. Include constructive events as well as conflicts; do not make
every spin a fight or every episode follow the same emotional pattern.

**Established:** Event odds are state-weighted. Relationships, personality,
exhaustion, and recent developments influence which events are likely; the wheel
is not a set of uniformly random categories unrelated to the cast.

Include "Miracle recovery" among the candidate roulette outcomes, supporting the
show's entertainment focus. Its eligibility and recovery effect remain to be defined.

**Open:** Final outcome list, eligibility and participant selection, weighting
formulas, number/timing of spins, whether the player actively spins, and whether the
roulette shows event categories or fully specified incidents.

**Proposed:** Use current relationships, personality, training load, and condition
to make eligible events plausible. Keep the random result persistent, explain its
actual consequences in the episode, and avoid rerolling into incompatible events.

## 5. Setup - Episode 0

**Established runtime isolation:** Deep-copy selected source contestants into the
season runtime before applying simulation effects. Simulation must never mutate
or write back to the source contestant database. Freeze all simulation-relevant
library definitions, including cards, specialties, and songs/parts, for the run;
later source/library edits affect only new runs.

### Step 1: Select the cast

Ask the player:
1. **Include Bias contestants?** Include the five canonical winners from Squirrel
   Zone lore. Inclusion does not guarantee they survive or win this simulation.
2. **Push Bias contestants?** Available only when inclusion is enabled. Give those
   contestants advantages that increase, but do not guarantee, their chances.

**Established push mechanic:** Give the five lore favorites a higher initial
production preference only. Do not boost their skills/performance, force favorable
roles or opportunities, guarantee exposure packages, or guarantee a save.
Production preference contributes to the overall ranking under the same limited,
hidden production rule used for all contestants.

The one-time initial bonus is +0.25 `productionRatio`, clamped to the -1 through 1
range. Apply it once after ordinary starting effects, not as a recurring bonus
or protected preference floor. It does not affect Episode 1's performance-only cut.

Require at least 50 available contestants. Target 20-26 vocalists and 12-18 each
for rap and dance, totaling 50. Prefer higher existing grades, randomize equal-grade
candidates, and fill track shortages from other available contestants.
The saved selection grade is not automatically the eventual audition grade.

**Open:** Validate the five lore IDs and
define how forced inclusions count toward track targets. Existing code supports
inclusion but not the separate push setting.

### Step 2: Assign cards

The intended starting candidates have prefilled skills and specialties, with
personality traits initialized to neutral before card effects.
The user confirms that database personalities are currently all zero.
- Keep an existing valid persona; otherwise assign a unique random persona.
- Assign a unique random compatible Identity Card.
- Assign a unique random compatible Interest Card.
- Assign a unique Secret Card to seven randomly selected contestants.

Compatible means no contradictory positive/negative influences on the same field
across assigned cards: for example, +1 discipline cannot coexist with -1 discipline.
This includes core skills, utility skills, personality, and aggregations. Opposing
audience, fanbase, production, or happiness effects are also incompatible.

**Established compatibility scope:** Apply that rule among assigned cards only.
Fixed specialty influences may counterbalance them in the final personality average;
specialties do not constrain card eligibility. Zodiac has no starting effects.

**Established specialty protection:** Authored specialties can never be replaced.
Do not assign a card whose explicit specialty change would conflict with the
contestant's existing value. A matching value that makes no change is not an
override. Compare canonical library values and validate source data.
This restriction is separate from allowing specialty stat influences to
counterbalance card influences.

**Established persona uniqueness:** Every persona must be unique within the selected
50, including already-saved personas. Preserve a retained contestant's saved persona;
resolve duplicate-persona conflicts through eligible contestant swaps rather than
rewriting the saved persona. Personas belonging only to non-selected contestants
are not reserved against this cast's new assignments.

**Established assignment repair:** Keep the selected cast and valid assignments as
stable as possible. If constraints prevent a complete assignment, try swapping the
blocking non-required contestant with an available alternative from the candidate
pool, rather than restarting selection of all 50. The current design has 100 candidate
options. Required included bias contestants cannot be swapped out.

Prefer compatible local repairs and retain the intended track mix/selection rules.
Do not silently omit required cards, accept a forbidden specialty change, or treat
ten random misses as proof no valid card exists. If no valid repair can satisfy the
hard constraints, report the conflict explicitly instead of looping indefinitely.
Source database contestants remain unchanged throughout.

**Open:** Other explicit `set` targets, repair ordering/search limits, track-mix
fallbacks, and how to report conflicts involving required bias contestants.

### Step 3: Apply card effects

**Established starting sources:** Assigned persona, identity, interest, and secret
cards contribute, as do the contestant's existing specialties. Zodiac does not
apply starting stat/personality effects; it remains flavor.

**Established personality combination:** For each trait, average the values from
sources that actually affect it. Treat those values as target personality levels,
not additive bonuses. For example, discipline values 6 and 8 produce 7, rather
than a sum of 14 clamped to 10. Do not include unrelated cards or the initial zero
as additional samples. A trait with no contributions remains neutral.

**Established skill combination:** Add core/utility skill deltas, but cap each
skill's total setup change to +/-1 from its saved value, remaining within 1-5.
This is a limit on the combined setup adjustment, not a reason to reject an
otherwise compatible card that contains a +2 influence. Personality averaging
does not apply to skill deltas.

**Established aggregation combination:** Add effects rather than averaging target
levels. Clamp audience, fanbase, and production ratios to -1 through 1 and happiness
to 0-100. Assigned-card opposition is rejected before combination; fixed specialty
influences remain outside the compatibility gate.

**Established:** Apply initial effects once to simulation copies.
**Proposed:** Explicit `set` values are overrides, not deltas; their allowed scope
and precedence need approval.

**Open:** Rounding and fractional precision, other aggregation bounds, allowed override
targets, and precedence of multiple overrides.

The current weighted-average implementation is not an approved future rule:
additional positive influences can lower a stat. It must be reviewed before reuse.

### Step 4: Finish initialization

Recalculate alignment, initialize directional relationships to 50 for every other
contestant, and create the initial change-log entry. Keep database contestants
unchanged.

**Established:** Reset season-only counters, statuses, and outcomes explicitly rather
than carrying results from a previous run. Persist the setup choices, assigned cards,
and initial cast snapshot so reloading does not reassign them.

**Established fresh state:** Before setup effects, start experience and all
audience/production/fanbase ratios at zero, happiness at 50, and season counters
at zero. Do not preserve authored historical experience or old ratio modifiers.
The contestant's authored appearance, core/utility skills, and specialties remain
the base profile. Card effects and the optional bias push apply to this fresh state.

**Open:** Whether alignment remains fixed after setup, initial condition rules,
and how to represent an audition grade that has not yet been awarded.

### Step 5: Opening title

Present five rounds of three contestants. In each round, the player selects one
to feature in the opening sequence. The sequence is displayed before every episode,
and the featured contestants gain additional exposure.

**Proposed:** Draw non-repeating candidates across the initial five rounds, producing
five distinct featured contestants. Explain the recurring exposure advantage.

**Established replacement interaction:** When a featured contestant is eliminated
or withdraws, offer three eligible survivors and let the player choose a replacement
for that opening slot before the next episode. Do not automatically keep departed
contestants featured or replace them without the player's choice.

**Open:** Candidate sampling rules, feature strength, voluntary feature changes,
and whether the opening is a visual sequence or a text/card presentation in the
first playable version.

The existing `data/themes-song.json` describes a 30-contestant performance; do not
assume it already implements this 50-contestant opening selection.

### Audition song pool

**Established:** During setup, the simulator automatically selects a subset of
audition songs from each track's song library. For example, if there are five songs
per track, a run could select three vocal, three dance, and three rap songs.
Those selections form the shared audition options for that run.

Contestants choose autonomously from the selected pool; the player does not assign
or approve their songs. Persist the pool so reloading does not change the options.
Off-track choices are allowed subject to the personality rules in Episode 1.

**Open:** Fixed versus configurable pool size, insufficient library handling,
and selection weights.
Song choices lock before auditions begin; earlier performances cannot change them.

## 6. Episode plans

The format and elimination counts below are established. Player interactions and
system connections are proposals unless explicitly identified as established.

### Episode 1 - Auditions

**Format:** 50 contestants each perform one quick audition song focused on vocals,
rap, or dance. Grades reflect absolute performance quality. Eliminate the bottom
20 by audition evaluation, regardless of grade; the eliminated group need not all
have F grades.

**Established:** Editing cannot change Episode 1 survival. Its consequences affect
popularity, viewer satisfaction, audience retention, and future support, not the
audition elimination cutoff. No production save is part of this episode.

**Established song selection:** Contestants autonomously choose from the shared
track-based pool selected by the simulator during setup.

**Established arrangements:** Each audition song has one fixed arrangement with
fixed required levels for its parts' tested skills. Contestants do not simplify
it or choose a harder version. Each tested skill has its own requirement rather
than sharing one overall song difficulty. Utility effects outside the tested-skill
requirements follow general rules.

They may choose songs outside their registered track. The song's track determines
the primary technical skill within the 55% component; a rapper choosing a vocal
audition is evaluated on the arrangement's vocal-led tested skills, not their
registered rap track.

**Established off-track decision drivers:** Personality shapes whether a
contestant takes this risk. Discipline at -7 or below makes changing track more
likely; curiosity at +7 or above also encourages it. High investment, maturity,
or discipline (+7 or above) individually rules out the risk entirely. Any one of
these protective traits is a hard veto, even when curiosity or low discipline
would otherwise encourage changing track.

**Established song-choice judgment:** Weigh ability and genre affinity, but allow
personality to override good judgment. Do not always optimize expected evaluation
or protect contestants from poor choices; reckless choices can genuinely backfire.
This does not override the protective-trait veto on changing tracks.

**Open:** Baseline off-track probability, the strength of encouraging traits below
the hard-veto boundary, and how the contestant chooses among alternative tracks
and songs.

**Established audition evaluation:** The song's primary track supplies the
technical foundation, but Auditions specifically rewards star quality:
- Stage presence is the strongest bonus factor.
- Judges favor either visual or uniqueness for each batch of contestants.
- Judges also favor either potential or charisma for that batch.

These are audition-specific criteria, not universal weights for every mission.
Star quality can compensate for poor primary-track ability without a hard technical
floor. In the working example, a contestant with vocals 3 and stage presence 5
should normally outscore one with vocals 4 and stage presence 2 when all other
factors are equal.

**Established audition weights:**

| Component                               | Weight |
| --------------------------------------- | ------ |
| Primary track                           | 55%    |
| Stage presence                          | 35%    |
| Batch preference: visual OR uniqueness  | 10%    |
| Batch preference: potential OR charisma | 10%    |

**Established stage-presence conversion:** Use the integer `stagePresence` skill
against requirement 3. On the same raw performance dice used for technical
checks, raise each face to at least `clamp(2 * stagePresence - 3, 1, 5)`, then
score `100 * (adjustedSum - 2) / 10`. No technical difficulty ceiling applies to
this 0–100 component.

For a part testing `[vocals, dance]`, combine vocal and dance contributions at
weights 2:1 within the technical component, rather than assigning the full 55%
to vocals alone. Keep stage presence and batch bonuses separate.

The fixed foundation intentionally totals 90%. The two selected bonuses supply
another 20%, allowing a possible 110% before the 100% cap. Do not renormalize these
weights to total 100%. Only the selected attribute in each pair supplies its
batch's bonus; the judges' preferences change between batches to make their
evaluation less static.

**Established final score and ties:**

```text
final = min(100, 0.55 * technical + 0.35 * stagePresence
                 + 0.10 * selectedBonusA + 0.10 * selectedBonusB)
```

Keep component values and the capped final unrounded for ranking and grades;
display rounding only (decimal count still open). Equal capped final scores use
higher technical, then higher stage presence, then a persisted seeded draw.
Do not use uncapped surplus as a hidden tie-breaker. Auditions has no growth
bonus or extra direct consistency variance adjustment.

**Established judging batches:** Evaluate the randomized live audition order in
batches of 13 contestants: 13, 13, 13, then the remaining 11. The prime-number batch
size is intentional, to make the pattern less obvious. At each batch boundary,
judges react to what the previous batch lacked when selecting the next batch's
preferred bonuses. Use weighted randomness: a missing quality is more likely to
be favored next, but the response is not guaranteed.

**Established batch memory:** Standout moments matter more than a simple batch
average. One exceptional display of uniqueness can satisfy the judges' appetite
for uniqueness even after 12 otherwise conventional auditions. Do not make the
overall average alone decide whether the quality was missing.

**Established preference selection:** For the first batch, make independent
seeded equal-probability choices of visual versus uniqueness and potential versus
charisma. For each subsequent batch and each of the four qualities:

```text
satisfaction = max(previous batch mean impression,
                   0.8 * previous batch highest impression)
selection weight = 101 - satisfaction
```

Use only the immediately previous batch, not cumulative history. Independently
choose one quality from each pair with probability proportional to its selection
weight. Lock both preferences before evaluating the entire batch.

**Established bonus basis:** Evaluate visual, uniqueness, potential, and charisma
through audition-specific judge impressions informed by the contestant's
attributes. A high saved attribute is not an unconditional bonus regardless of
delivery. Potential reflects signs of promise, distinct from demonstrated growth.
Use the existing performance roll rather than introducing extra bonus rolls.
For each quality, use its corresponding integer skill against requirement 3,
`floor = clamp(2 * skill - 3, 1, 5)`, and each adjusted face `max(raw face, floor)`.
Its impression is `100 * (adjustedSum - 2) / 10`, with no technical ceiling.
Calculate all four 0–100 impressions for every contestant for batch memory, even
though only the two selected qualities contribute to that batch's scores.
Potential is demonstrated promise, not permanent skill growth.

**Established grades:** A ≥85, B ≥70, C ≥55, D ≥40, F <40; no E.
These absolute thresholds are the agreed starting balance and may be calibrated
against simulated distributions. Eliminate the bottom 20 by audition evaluation
independently of grade, with no audience or production save.

**Established player interaction:** After the auditions, the player selects between
complete, preassembled broadcast sequence packages with different casts and tones,
including short split-screen cuts. Each decision offers a limited selection of
packages, not an unrestricted contestant list or manual casting of every slot.

The player knows performance descriptions and grades while choosing packages.
The elimination list is revealed later. Editing still cannot change the locked
audition evaluation; withholding the reveal must not fabricate uncertainty when
the available information makes an outcome inferable.

Package previews show only their cast, footage, and editorial intent/tone. They do
not disclose predicted effects, risk labels, numerical ranges, or exact stat changes.
The player must judge the likely consequences from the content.

Automatic baseline montage coverage guarantees everyone's exposure floor.
The chosen sequence packages distribute additional attention above that baseline.

There is not enough broadcast time to show all 50 auditions sequentially. A few
terrible and a few amazing auditions must make the cut because both can attract
viewers. Many other performances receive condensed coverage; approximately ten
of the eliminated contestants may receive only shared split-screen exposure,
while still meeting the minimum exposure rule.

Songs and audition order are not player-controlled: contestants lock their own
song choices, and the simulator randomizes the performance order.

**Open:** Package composition rules, number of package alternatives and decisions,
runtime allocation and how mandatory standout/terrible
features are enforced.
Do not confuse filmed performance order with the player's later broadcast order.

**Established contestant reactions:** Audition order and shared song choices matter.
A contestant who performed poorly earlier may react to a later contestant performing
the same song. Their personality determines whether this creates affinity,
resentment, or another response, affecting directional relationships and happiness.

Auditions resolve live, one at a time. Song choices are locked beforehand, but
reactions immediately update contestant state and can affect contestants who have
not performed yet. Later events cannot retroactively change an earlier performance.
Use temporary condition/readiness state and directional relationship changes,
not instant permanent core/utility skill-rating changes. This readiness is not
Practice >0: no practice sessions are simulated in milestone 1. Exact triggers,
temporary state, magnitudes, and performance-influence formulas remain undesigned;
no dice effect is implied.

**Proposed additional connections:** Song/track fit and temporary readiness affect
performance. Grades affect happiness and reputation; broadcast exposure affects
audience attachment. Reactions to auditions can establish first impressions and
supportive or rival relationships.

**Open:** Actual song/part catalog, pool/selection weights and off-track
probabilities; live-reaction triggers, magnitudes, temporary performance influence,
and relationship consequences; broadcast/audience contracts and episode closure
as listed in the milestone checklist.
Calibrate the audition model for a believable spread of performances, but do not
force 20 F grades, reroll results to fill a quota, or secretly lower performances.

### Episode 2 - Group Battles

**Format:** 30 contestants form six groups of five. Losing teams are eliminated,
then judges, audience, and production/label each save one contestant: 12 leave,
18 remain. Trainers give feedback and choose the winning teams.

**Established team formation:** The top six contestants become captains. Contestants
then negotiate their own teams, considering friendships and willingness to join.
Teams can include frenemies or contestants who dislike one another. Captains use
their leadership skills to manage the resulting tension. Each team votes for its
performance center under the shared role rules.

The top six are drawn from the continuing overall ranking. Audience votes already
contribute at this point even though that ranking is not yet public.

**Established battle structure:** Three head-to-head battles, with the two teams
in each pair performing different songs. Three winning teams advance and 15
contestants from losing teams are at risk.

**Established save interaction:** Judges and audience independently save contestants
before the production/label save. Those saves must be distinct. Then offer the
player a shortlist drawn from the remaining at-risk contestants, from which they
choose the production save. Exactly three distinct contestants are saved.

**Established withdrawal adjustment:** If a contestant from a winning team
withdraws, offer an extra production-save shortlist so another losing-team
contestant survives. This is an explicit exception to the normal three-save count,
preserving the episode's total departures and 18 remaining contestants.
Departed contestants cannot be selected for a save.

**Proposed additional player interaction:** Respond to a practice conflict.
Team formation and center selection belong to the contestants, not the player.

**Connections:** Relationships affect teammate selection and coordination. Saving
someone can change trust, audience reaction, and perceptions of favoritism.

**Established negotiation deadline:** If negotiations leave unfilled places,
production assigns the remaining contestants to open slots. Record involuntary
placements honestly and apply the resulting emotional/relationship consequences;
do not pretend every team formed through mutual agreement.

**Open:** Set the top-six tie-breaker and how battle pairings are drawn;
define song-selection authority and comparison of different songs. Define how
negotiations handle rejected invitations and how deadline assignments fill exactly
six teams of five. Set the order between judge and audience saves, conflict handling,
their selection criteria, and the production-save shortlist rules. Explain why a
saved contestant survives despite their team's loss.

### Episode 3 - Boot Camp

**Format:** 18 contestants in three groups undertake tests of performance, agility,
and related abilities. No elimination. The continuing overall ranking is publicly
revealed for the first time; audience votes have contributed since Episode 1.

**Proposed small interaction:** Respond to a specific request for extra training,
recovery, or team-building support, rather than scheduling the entire boot camp.

**Connections:** Learning, memory, stamina, and leadership influence growth and
readiness. Shared training changes relationships; the broadcast adds to the
cumulative ranking before its first public reveal.

**Open:** Test list, group sizes/composition, growth limits, fatigue rules, and
how the first public reveal is presented.

### Episode 4 - Mega Groups

**Format:** Two groups of nine perform two songs each. The lowest-ranked contestant
in each group is eliminated, leaving 16.

**Proposed small interaction:** Respond to one leader or center dispute without
taking control of all group composition, songs, or role assignments.

**Connections:** Leadership and relationships matter at a larger scale. Uneven
role distribution creates tradeoffs between stage quality, fairness, and exposure.

**Established elimination basis:** The lowest contestant in the cumulative overall
ranking within each group leaves.

**Open:** When the ranking is locked and how both songs contribute to it.

### Episode 5 - Photoshoot

**Format:** 16 contestants complete individual and group photoshoots emphasizing
Uniqueness and Visual. No elimination. Contestants vote for "The Ultimate Visual."

**Proposed small interaction:** Choose between a few photo-feature opportunities
or respond to a contestant's concept request, rather than directing the whole shoot.

**Connections:** Visual vibe, uniqueness, charisma, and confidence drive different
forms of success. Peer votes interact with relationships but should still reflect
the photoshoot. Recognition affects confidence, rivalry, and public attention.

**Open:** Peer-vote eligibility, self-votes, tie-breakers, and the title's reward.
Keep the peer award separate from the audience ranking.

### Episode 6 - Track Specials

**Format:** 16 contestants perform track-special songs in groups of three or four.
Eliminate the lowest-ranked contestant, leaving 15.

**Established grouping fallback:** Keep performances within each contestant's track.
When the remaining track populations cannot form groups of three or four, allow
solo/duo exceptions. Do not alter earlier eliminations to manufacture track quotas.
A strong performance with this extra individual exposure can be especially valuable
for the contestant's popularity.

**Proposed small interaction:** Decide who receives a limited extra practice
opportunity; song and role selection otherwise follow the mission's autonomous rules.

**Connections:** Track ability and specialties dominate, with cooperation and
preparation modifying the result.

**Open:** Partitioning rules, song/role authority, and exposure allocation between
groups of different sizes. Elimination uses the cumulative overall ranking.

### Episode 7 - Versatility

**Format:** Three groups of five take on challenges outside each group's dominant
track. The three lowest-ranked contestants leave, leaving 12.

**Established off-track rule:** Try to distribute contestants so the challenge
pushes as many as possible outside their own track. Some may still perform in their
usual track. Production and the general audience see those contestants' contributions
as less special in this mission; existing fans still appreciate them without that
same discount.

**Proposed small interaction:** Respond to one request for coaching support or
an ambitious off-track concept, rather than setting every group's challenge.

**Connections:** Learning, memory, potential, resilience, and cooperation become
important. Recognize improvement without making established skill irrelevant.

**Open:** Group formation authority, dominant-track ties, challenge selection,
difficulty comparability, and the size of the production/general-audience discount
for staying in-track. Elimination uses the cumulative overall ranking.

### Episode 8 - Variety Show

**Format:** Three groups of four complete three parts: a variety segment, an
interview, and an improvised comedy/acting skit. Eliminate two, leaving 10.

**Proposed small interaction:** Decide how to respond to an awkward moment or
unexpected revelation, rather than scripting the entire variety show.

**Established third segment:** Improvised comedy/acting tests creativity,
confidence, composure, and group chemistry.

**Connections:** Charisma, extroversion, sincerity, maturity, and relationships shape
the broadcast. Reserved contestants need viable ways to succeed too.

**Open:** Group formation and scoring across all three parts.
Elimination uses the cumulative overall ranking.

### Episode 9 - Music Videos

**Format:** 10 contestants create their own music videos, involving acting.
Contestants are encouraged to collaborate, but organize themselves autonomously.
Do not prescribe a fixed number of videos or force equally sized teams. Eliminate
one, leaving nine.

**Established group dynamics:** Let duos, trios, larger groups, and other voluntary
arrangements emerge. This tests cooperation and reveals cliques, exclusion, and
whether contestants want to work together.

The resulting video count affects the show as a whole. More than five videos makes
the episode too repetitive/boring, which is bad for all contestants. A single video
also creates a weak episode with too little material for the runtime. Do not
silently rearrange groups to fix the episode; the consequences of their choices
are part of the simulation.

**Established exclusion fallback:** A contestant who does not join a group must
make a solo video. Exclusion does not excuse them from submitting a performance;
their personality and emotional response can still affect how that solo unfolds.

**Proposed small interaction:** Respond to a concept/support request from a limited
selection of contestants, rather than approving every concept or editing every video.

**Connections:** Uniqueness, stage presence, visual vibe, curiosity, and leadership
support concept execution. Production allocation has visible fairness consequences.

**Open:** Negotiation and participation rules, emotional responses to exclusion,
how acting is derived from existing stats, resource limits, and how video count
affects audience/satisfaction and contestant outcomes.
Elimination uses the cumulative overall ranking.

### Episode 10 - Specialties

**Format:** Nine contestants perform in three trios focused on their strengths.
Eliminate one, leaving eight.

**Proposed small interaction:** Respond to competing requests for a standout
opportunity, while contestants retain their mission-defined team and role decisions.

**Connections:** Specialty synergy and relationships compete with individual
spotlight opportunities. The episode establishes momentum going into the finale.

**Open:** Who forms the trios and how to compare different specialty combinations.
Elimination uses the cumulative overall ranking.

### Episode 11 - Finale

**Format:** Eight finalists perform in two groups of four, with one original song
per group, plus one full-cast song. There are three performances total.
Three contestants leave and the final five are revealed.

**Proposed small interaction:** Offer one final, bounded production decision without
giving the player control of every group, role, performance, or final result.

**Connections:** Season-long attachment, current performance, fanbase support, and
the player's editorial history culminate in the final result and show viewership.
Bias pushes may help contestants but cannot guarantee the canonical five win.

**Open:** Group formation, final vote weights/windows, tie-breakers, and whether
production has any explicit final vote beyond its established ranking contribution.
The continuing overall ranking determines the final five; do not replace it with
an unrelated finale-only score.

**Established conclusion:** Include a post-season outcome showing how satisfaction
affects the viewers who remain fans of the final group.

**Proposed presentation:** Reveal all five winners, final audience size and
satisfaction, and a season retrospective linking key player choices to contestant
journeys before showing the post-season outcome.

## 7. State, history, and player-facing screens

**Established runtime contract:** Store a season seed and reproducible randomness
state, frozen starting data and simulation-relevant definitions, choices, phase,
and resolved outcomes. The same frozen start, seed, and choices must reproduce
results. Reloading must neither reroll outcomes nor reapply effects, and must
resume pending interactions and the current phase. Deep-copied runtime contestants
and frozen definitions isolate the run from subsequent source/library edits.

**Required season-level state, with later-episode fields added as designed:**
- Run ID, rules/data version, random seed/state, episode, and current phase.
- Setup options, bias settings, opening selections, and initial cast snapshot.
- Frozen simulation-relevant library/song/part definitions.
- Active/archived contestants, audience size, viewer satisfaction, their histories,
  and the post-season fan-retention outcome.
- Current mission, teams, role assignments, autonomous preparation decisions,
  practice developments, and any resources relevant to that mission.
- Temporary contestant Practice aggregations, their preparation context, and
  recorded session outcomes.
- Pending interactions and deferred consequences, including secret reveal state.
- Performance components, judge feedback, peer votes, audience votes, rankings,
  saves, eliminations, and completed episode snapshots.
- A chronological event/decision ledger covering both autonomous developments
  and player choices, with causes, targets, before/after values, and explanations.

**Required contestant change history:** Setup appends an episode 0 entry, and
each completed episode appends an entry to each participating contestant's
simulation-only change log, including contestants eliminated during that episode.
Capture every modified contestant field with before/after values and its cause,
including card/persona assignments, skills, aggregations, relationships, condition,
rank, score, and status when changed. Preserve intermediate changes and their
causes even when a field returns to its starting value. Record episode-end
results and summaries alongside these changes. Persist entries with the resolved
phase/episode so resuming cannot duplicate them. Never write this runtime history
back to source contestant profiles. The existing setup logger is not yet a
complete implementation of this requirement.

The contestant change log supports individual recaps but cannot alone represent
the show's decisions, teams, votes, or full history. Do not hide season events in
an arbitrary contestant's log.

**Established episode presentation:** The show is player-paced. Present meaningful
character scenes, practice developments, performances, and reveals rather than
autoplaying through the season. Before each episode, the player explicitly clicks
"Start episode X"; completing one episode does not start the next automatically.

The player can always revisit previous material, open a contestant profile, and
return to the same place in the current episode. Inspection/history navigation
must not advance the simulation, reroll events, or reapply effects.

**Proposed supporting screens:** Season dashboard; episode briefing/progress;
decision cards; performance/broadcast results; ranking and elimination reveals;
contestant relationship/history views; and a season timeline/recap.

Save at decision boundaries and resume in the same phase. Persist resolved
random outcomes so reloading does not reroll a performance or apply effects twice.
Commit a completed phase's changes together, and surface persistence failures.
All season mutations stay separate from the source contestant library.

## 8. Decisions to settle before implementation

The established decisions above are not reopened by this list. The milestone 1
blocker checklist and approved order are at the top of this document. The broader
remaining gaps below also cover later episodes; they are not all launch blockers.
Practice is specified for later episodes, not required for milestone 1.
1. Actual Auditions song/part catalog, ordered per-skill requirements, pool size,
   insufficient-library behavior, selection weights, and off-track probabilities.
   Later missions still need evaluation/aggregation rules, utility effects,
   meaningful-growth measurement, and bonus limits; Auditions scoring is settled.
2. Satisfaction changes, new-viewer acquisition, retention timing/strength, and
   post-season fan conversion.
3. General-viewer voting, fan acquisition/transfer proportions, audience-preference
   shortlist size/sampling, and the use of existing popularity/fanbase modifiers.
4. Remaining episode-specific group/role/song authority and judging criteria.
5. Card-effect precision, other explicit override targets, repair/search limits,
   data validation, and the five canonical bias IDs.
6. Opening feature strength, initial/replacement sampling, and presentation.
7. Broadcast budget, floor eligibility, opening inclusion, solo versus simultaneous
   exposure effects, and Auditions package composition/count, alternatives,
   number of choices, and runtime allocation. Audience-only double detection
   (raw versus adjusted), twist effects, appeal/fan acquisition, and viewer/
   satisfaction deltas remain open; keep the +3% mood matches and +18% maximum.
8. Auditions live-reaction triggers, temporary condition/readiness state,
   magnitudes/performance influence, and directional relationship consequences.
   Later episodes also need roulette catalog/weights/frequency and history cadence.
9. Exact Auditions reveal/results timing and cumulative score contributions under
   the established ranking weights, normalization, and 75% retention rule.
   Voting windows, rank lock points, and later save/tie procedures remain open;
   Auditions evaluation ties and performance-only survival are settled.
10. Center/MVP/Ultimate Visual voting details, recognition effects, and secret-check
    repeat-selection rules.
11. Withdrawal probabilities/cap/timing and remaining team-specific cut adjustments.
12. Persistence/schema implementation and private information available to the
    player versus the in-world audience. Seeded reproducibility, frozen source
    isolation, phase resumption, and navigation without rerolls/reapplied effects
    are requirements, not open design alternatives.

## 9. Implementation sequence

1. Settle milestone 1 contracts in order: songs/selection → live reactions →
   broadcast/audience → episode closure. Do not reopen established scoring,
   ranking, shortlist, or secret-check no-op rules.
2. Add season state, phase progression, decision/effect records, persistence, and
   deterministic randomness before adding episode-specific shortcuts.
3. Align setup/card application with the approved rules and add opening selection.
4. Build the complete Setup → 50 Auditions → results → 30-survivor slice through
   those systems: autonomous song selection, live reactions, choices, performance,
   broadcast packages, meaningful audience/popularity effects, grading,
   elimination, and closure. No simulated practice or growth bonus in Auditions.
   Do not implement isolated scoring unless separately requested.
5. Add Episode 2 to exercise teams, directional relationships, and distinct saves.
6. Add Episode 3 to establish training and the first public overall-ranking reveal.
7. Extend the same foundations through Episodes 4-11 after separately designing
   their remaining content/rules; the season outline is not implementation-complete.
8. Balance full seasons for meaningful choices, exposure fairness, bias strength,
   and plausible final groups.

## 10. Completion criteria

**Milestone 1 acceptance:** Complete Setup and all 50 auditions through results
with exactly 30 survivors, including the broadcast-package interaction and
meaningful audience/popularity consequences. Enforce the confirmed scoring,
absolute grades, seeded ties, source isolation, reproducibility, and phase
resumption rules. Practice and the full 11-episode season are not milestone 1
requirements.

**Full-season criteria (later scope):**
- The roster follows the season table and always ends with five distinct winners.
- Every episode includes player interaction. Choices have traceable gameplay
  consequences except the explicitly permitted unsuccessful secret check.
- Original database contestants are never mutated by a season.
- Simulation-relevant library/song definitions stay frozen for the run; source
  edits affect new runs only. Identical frozen starts, seeds, and choices
  reproduce results.
- Assigned cards and initial influences are applied once under explicit rules.
- Every eligible contestant receives the exposure floor, including credited
  split-screen appearances. Broadcast segments fit the runtime budget; summed
  individual exposure is allowed to exceed 100%.
- Relationships remain directional and bounded; effects have traceable causes.
- Audience size, viewer satisfaction, individual popularity, fanbase support, and
  production preference remain distinct and produce understandable consequences.
- Low satisfaction has later retention consequences, including a post-season
  outcome after the finale.
- Seasons reach Episode 11 even when audience results are poor.
- Secret assignments stay hidden from the player until discovery/reveal rules
  permit disclosure, and a public reveal applies its consequences only once.
- Saves, ties, grades, and eliminations obey the published rules without duplicates.
- Eliminated contestants cannot participate in later competitive missions unless
  an explicit future rule allows it.
- Reloading preserves decisions, pending consequences, results, and random state.
- Every episode requires an explicit start; scenes are player-paced, and history
  and profile navigation preserve the current episode position.
- Recaps explain meaningful changes, and the season archive retains the complete
  record of challenges, performances, decisions, and outcomes.
