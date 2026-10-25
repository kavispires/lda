# The Search - Show and Simulator Plan

## Status and scope

This is a living design document, not a description of completed functionality.
It covers setup (episode 0) and all 11 competition episodes, with particular focus
on player interaction and how the simulation systems connect.
- **Established:** Requirements from the season outline and subsequent design decisions.
- **Proposed:** Design suggestions to connect those requirements; not yet approved.
- **Open:** Decisions that must be settled before implementing the affected system.
- **Implementation default:** An explicitly documented, configurable low-level
  coefficient or algorithm, authorized for implementation and later tuning; not
  an additional story mechanic or a claim that its exact algebra was approved.

Contestant management, card libraries, cast initialization, and playable
Episodes 1, 2, and 3 now exist. New simulations use the narrative format described
below; version-1 and version-2 saves retain their original episode rules.
Broader-season gaps still need design.

### Silent TV value and artistic experience

`aggregations.score` is now cumulative **TV value**, not competition points.
It is an owner-facing measure of how much compelling television a contestant
creates. It never changes votes, audience preference, performances, captain
selection, saves, rankings, or other show outcomes.

Recorded on-camera moments earn one tier: +1 minor, +3 meaningful, or +6
standout. Dull moments can earn zero. A confrontation or memorable failure can
be valuable television; negative behavior is not automatically a deduction.
TV points never decay or decrease, and tiers do not stack for the same moment.
Actual aired reaction highlights count; invisible relationship calculations do
not. Performances have their own stable identity, so presenting their results
again cannot award them again.

The existing competition calculation is stored in `aggregations.rankingScore`,
unchanged in formula and outcomes. All references below to cumulative overall
score, continuing score, or ranking points mean this field. The general
Contestants catalog's separate calculated skill average is unchanged.

`aggregations.experience` retains historical card-based experience and gains
+1 for each completed substantive practice session and +3 for each completed
performance/challenge, including failure. A group challenge credits every
participant. Multiple checks or resets within one challenge do not multiply
XP. Coaching, social drama, rank reactions, and award announcements grant no
XP. There is no experience-based skill growth yet.

TV points and XP are awarded inside normal episode transitions with persisted
event identities. Reloading, browsing history, repeating an action, or using
auto-completion never duplicates an award. Existing saved seasons preserve
their competition points and experience, adopt TV value at zero, and earn
points only for subsequent activity; there is no historical backfill.

Totals and audit changes remain available in optional owner details. TV/XP
awards and ranking-point mechanics never appear in narration, host/judge
dialogue, episode explanations, or copied story rundowns. Existing saved
story text receives the same presentation filtering without changing outcomes.

### Narrative format for new simulations

Runtime versions 2 and 3 start with five opening credits slots selected from the top
ten effective seven-core-skill averages (visual, then saved seeded tie-break).
Later episodes retain surviving selections and replace only vacant slots.
Each episode has its own two-option mood in all six specialties; later options
come from the previous combined ranking's first and last active survivors, with
a distinct seeded fallback when they match. Randomize fills, but does not confirm,
the decision. Opening credits grant +0.02 audience preference once per episode,
capped at +1, independently of audition exposure.

Mike Philip presents Auditions as manual story beats: welcome, opening credits,
judges, then audition blocks of **3 / 12 / 5 / 10 / 5 / 12 / 3**.
The 3/5/5/3 featured auditions each have a public introduction followed by their
performance; the other blocks are condensed montages with expandable profiles.
Songs are locked internally, not announced on an upfront board. All fifty
performances retain causal reactions and universal opinions.

John Stan evaluates song-tested technical skills, Megan Ryder averages stage
presence/potential/uniqueness, and Michael Lion averages visual/consistency/
leadership. Leadership rotates John → Megan → Michael every seven actual
auditions, including montage contestants. The chosen song's primary track-skill
check has weight 3, the leading judge has weight 2, and each other judge has
weight 1: `(3 * track + 2 * lead + other + other) / 7`. The track check retains
the song's skill requirement, difficulty ceiling and shared performance dice;
off-track auditions use the song's track, not the contestant's usual track.
For newly started runtime-3 Auditions, this weighted result is the raw panel
score. The final evaluation adds 20% of its remaining headroom:
`final = raw + 0.20 * (100 - raw)`. This improves ordinary results while
preserving rare reachable A/F grades and the established grade thresholds.
Dice, individual checks, difficulty ceilings and judge criteria do not change.
The episode freezes scoring version 2 on start, and optional evaluation details
retain the raw result and show the adjustment. Already-started episodes without
this marker retain their original formula for every remaining audition.
Previously saved panel-only results and runtime-1/2 scoring stay unchanged.
Later episodes keep their scoring rules; changed audition results can naturally
alter subsequent selections and standings.
The judge-only bottom twenty depart, separately from cumulative 60% performance,
30% normalized votes and 10% production ranking contributions.

Coverage is nineteen normalized units: one per featured audition, one shared by
each montage. Screen time is recorded when the beat plays, not during voting.
Audience resolution is silent before results; modern Auditions has no broadcast
package decision. Four groups of five departures trigger survivor-to-departed
farewells using frozen outgoing relationships: baseline >=53 gives +2, <=47
gives -2, otherwise unchanged. No self, reciprocal or survivor-blame effects are
introduced. Full changes persist; narration shows only standout reactions.
MVP and a blocking secret investigation close the episode.

For existing runtime-2 seasons, Episode 2 receives fresh preparation, then its existing dorm cold open, opening
credits, and next-day stage/ranking reveal. Its draft, rehearsal, battle, broadcast,
three-save and elimination mechanics are unchanged; deeper Episode 2 story
restructuring is preserved as the older format. Both episodes use narrative stages, host speech
bubbles, blocking decisions, optional calculation details and read-only archives.
Inspection, animation and replay never apply simulation effects.

Versioned validation preserves saved choices, RNG and once-only effects. Existing
version-1 and version-2 runs are never silently upgraded; start a new simulation to use the latest
format. The legacy Auditions contracts below continue to describe version 1.

### Runtime 3: The Battles narrative

New simulations retain modern Auditions and use eight sequences for Episode 2:
five dorm groups of six, opening credits, captain selection/drafting/pairings,
three fully featured battles, judge reviews/results, and saves/finale.

Only the six captains are announced early. The first full eighteen-survivor
ranking appears after saves, final departures, peer MVP, and the secret check.
Mike announces that future episodes eliminate the lowest-ranked contestants;
future episode implementation and elimination counts remain out of scope.

Each of six teams has two practice sessions, a captain spotlight, a no-self-vote
center ballot, and an independent Support/Mediate/Push decision. Center grants
+1 temporary stage presence, clamped together with rival composure to skill 1..5.
Team B's rehearsal is a flashback; A's performance cannot rewrite its practice.

Center preference is visual + stage presence + charisma + outgoing affection/20.
Tied totals favor charisma, average core skill, then a saved random draw.
Captain-named teams draft individual picks in four rounds of captain order 1–6,
retaining the established passed-over resentment.

Each contestant reacts to one opposing contestant at matchup announcement:
greatest absolute outgoing-affection distance from neutral, then a seeded tie.
Existing dislike below 40 or ambition above 4 gives -2; otherwise respect gives +1.

The original individual battle formula and coordination remain dominant.
John averages technical delivery, Megan stage/potential/uniqueness, Michael
visual/consistency/leadership. Each team's final score is
`clamp(base + (John + Megan + Michael)/60, 0, 100)`, a maximum five-point bonus.
Judges use stored performance dice and equal influence, without new random rolls.
All three review every team before any battle winner is announced.

Six equal performance units give each contestant 1/30 coverage, credited once.
Audience voting closes silently without a broadcast package. Losing teams are
provisionally eliminated before three distinct saves finalize eighteen survivors.
The judges save the highest individual performer; the audience saves the next
eligible vote leader; the player chooses production's save from its shortlist.

After final departures, a survivor's outgoing affection >=60 establishes a friend.
Per departed friend, dislike toward each defeating-team member is
`clamp(-10 + gentleness + maturity - sensitivity, -15, 0)`, capped at -15 total
per target for the episode. No saved-friend, self, or reciprocal penalties.

After the full ranking reveal, each survivor reacts emotionally and may change
their outgoing bond toward the contestant immediately above by at most two.
First place has no target. **Implementation default:** disposition is
`(affection - 50)/5 + gentleness + maturity - sensitivity - ambition`;
round disposition/10 and clamp to -2..+2. These reactions never rerank contestants.

Versioned story records, strict evidence validation, reveal-aware profiles, and
read-only archives prevent reapplying consequences or exposing future footage.
See `SHOW_EPISODES.md` for the descriptive episode treatment.

### Legacy playable foundation

Genre Affinity and the temporary Practice aggregation are now present in the
contestant model and interfaces. Audition foundations now provide the editable
song catalog, deterministic scoring/judging primitives, seeded setup snapshots,
and complete setup change histories. Episode orchestration now covers the
player-paced opening through all 50 auditions, broadcast, voting, 20 departures,
peer MVP, secret check, and recap. Episode 2 adds dorms, the ranking reveal,
captain-led drafting, utility-based practice, team battles, three distinct saves,
elimination backlash, and its own MVP/secret closure. Episodes 3–11 remain
unimplemented.

**Current playable boundary:** The catalog is
`data/audition-songs.json`, with five editable placeholder songs per track.
New setups sample and persist nine songs with the approved difficulty coverage.
No song-editing UI is required. Seeded episode transitions lock autonomous choices,
resolve causal live reactions, apply the selected broadcast, and close the episode
with exactly thirty survivors. All performances, choices, scenes, and contestant
changes remain in the season archive; cumulative standings stay hidden until
Episode 2's stage introduction. After Auditions closes, an explicit start button
continues the same saved season into Group Battles. `data/battle-songs.json`
contains editable five-part placeholder arrangements. Episode 2 closes with
eighteen survivors and does not automatically start Episode 3.
New setups persist their seed/random state and frozen definitions/source snapshots.
Older saved setups remain inspectable but do not acquire fabricated seeds or
snapshots. A storage failure is surfaced rather than reported as a saved phase.

### First playable milestone and blockers

**Established milestone 1:** Setup → 50 Auditions → results → 30 surviving
contestants, not all 11 episodes. Include the established broadcast-package player
interaction and meaningful audience/popularity consequences, not merely a scoring
and elimination screen. Later episodes require separate design; the full-season
rules below are not implementation-complete.

The four milestone design contracts are now established (checked means designed,
not implemented):
1. [x] **Songs/selection:** Shared three-song-per-track pool, difficulty coverage,
   catalog validation, autonomous locked weighted selection, and off-track rules.
2. [x] **Live reactions:** Causal observer comparisons, sparse personality-shaped
   reactions, bounded temporary composure, and directional relationships.
3. [x] **Broadcast/audience:** One of three complete cuts, footage-based effects,
   exposure floor, raw-double reception twists, moods, voting/fans, and show caps.
4. [x] **Episode closure:** Votes before grouped elimination, stored cumulative
   contributions, survivor MVP, then the secret check and recap.

The complete slice implements these contracts. Runtime foundations support
seeded reproducibility, frozen source snapshots, persisted outcomes, choices, and
phase resumption throughout. Practice is not a launch blocker: milestone 1 has no
simulated practice sessions.

## Interview checkpoint

Auditions' complete light-narrative design and numerical tunings below are
confirmed. No high-impact milestone behavior question remains from this interview.
Remaining exact coefficients may be documented configurable implementation
defaults without another constant-by-constant interview. Schema, data validation,
and balance calibration remain ongoing work. Milestone 1's runtime/UI, composed
stage-presence scoring, population accounting, and persisted phase resumption
are now implemented; this does not claim completion of the broader season.
The skill-and-requirement minimum-face mechanic replaces the earlier stat-based
baseline and direct consistency variance formula for milestone 1. Utility-driven
Practice is now implemented for Episode 2; Auditions still has no practice sessions.

Latest confirmed performance decisions:
- Share one ordinary raw 2d6 pair per contestant performance across technical,
  stage-presence, and all four bonus-quality checks. For each check use
  `floor = clamp(2 * skill - required level, 1, 5)` and `adjusted face = max(raw, floor)`.
- Technical parts retain ordered skill weights `[2, 1, ...]` and difficulty
  ceilings 60/70/80/90/100 for requirements 1–5.
- Stage presence uses the integer effective `stagePresence` skill (base plus
  temporary composure, clamped 1–5), requirement 3, and
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
    110%. Rank and grade using unrounded values; display precision is a configurable
    default, not a scoring decision.
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
- Live reactions can affect an unperformed contestant's integer effective stage
  presence through temporary composure in -1..+1; they never alter saved skills,
  technical checks, raw dice, bonus-quality skills, or Practice. Consume composure
  after that contestant performs. Past performances cannot change.
- Persist the season seed, frozen starting data, phase, choices, and resolved
  outcomes. The same frozen start/seed/choices reproduces results; reload never
  rerolls or reapplies effects. Deep-copy contestants and freeze simulation-relevant
  library/song definitions; source edits affect new runs only, never an active run.

The confirmed scene order is compact opening mood → autonomous locked song
choices/reveals → sequential live auditions/reactions → broadcast choice →
audience effects/votes → grouped elimination (20 leave, 30 survive) → survivor
MVP → secret check last → recap awaiting the next explicit episode start.
Watch the episode unfold through meaningful Continue-paced scenes, not 50 equally
long reports or 50 mandatory announcement clicks. Uneventful auditions can be
summarized; every participant and result remains inspectable and archived.
No voluntary withdrawals occur in the first playable Auditions.

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
  Auditions' phase, voting procedure, and ties are established below. Later
  mission-specific awards still need their own rules.

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

**General later-season withdrawal proposal, superseded for Episode 4 below:** Withdrawals are rare (usually none; one or
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

| Existing data                             | Proposed role in the simulation                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core skills                               | Track execution, stage presence, visuals, uniqueness, and leadership                                                                                     |
| Utility skills                            | Training growth, memory, stamina, performance variance, and variety ability                                                                              |
| Personality                               | Autonomous choices, cooperation, conflict, stress responses, and public perception                                                                       |
| Specialties                               | Song, concept, role, and mission fit                                                                                                                     |
| `condition` and happiness                 | Readiness, recovery needs, and reactions to outcomes                                                                                                     |
| `relationships`                           | Teammate preference, trust, cooperation, conflict, and emotional consequences                                                                            |
| `audienceRatio`                           | General audience preference toward an individual contestant                                                                                              |
| `fanbaseRatio`                            | Strength of that contestant's committed voting support                                                                                                   |
| `productionRatio`                         | Production preference and editorial attention, not audience approval                                                                                     |
| `contestantsLikeness`                     | Summary of incoming relationships from other contestants                                                                                                 |
| `screenTime`                              | Cumulative exposure; keep episode-specific allocations separately                                                                                        |
| `score`, `grade`, `rank`, `missionRating` | Cumulative points, quality grades, overall season standing, and mission evaluation; Auditions mapping is established, later mission mappings remain open |
| Leader, center, and MVP counts            | Recorded opportunities and achievements                                                                                                                  |
| Cards, events, and change logs            | Starting influences, triggered developments, and traceable history                                                                                       |

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

**Established Auditions fit:** Matching affinity doubles song-selection weight;
it is not an extra technical or judge-score bonus. Required fixed-arrangement
song metadata is defined in the pool contract.
**Open for later missions:** Additional performance-fit effects/song metadata.
Episode audience-mood selection and voting bonuses are designed, not implemented.

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
display. Display precision is a configurable implementation default.

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
Auditions' scoring, song/part contracts, temporary composure, and audience-only
critical twists are established below; later missions require their own
aggregation rules.

**Established minimum-face handling:** Roll ordinary d6s with faces 1 through 6,
then raise any face below the tested skill's calculated minimum to that minimum.
Do not sample equally among only the allowed faces or reroll low results.
Apply each tested skill's minimum to the same underlying pair, preserving the
one-roll-per-contestant-per-performance rule.

For Bob's dance skill 4 against difficulty 3, the calculated minimum is 5:
raw faces 1 through 5 become 5, while 6 stays 6. A shared raw roll of `[1, 4]`
becomes `[2, 4]` for his vocal minimum of 2 and `[5, 5]` for his dance minimum of 5.
The minimum is derived from skill and difficulty, not always the saved skill alone.
Record both raw and adjusted faces; Auditions detects audience twists only on
the shared raw pair, never adjusted doubles.

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
For Auditions, natural/raw double 1 adds 10 audience-reception points and natural/raw
double 6 subtracts 10; clamp reception to 0–100. No extra trait gate or judge/
technical modifier applies. The reception formula is specified under Episode 1.

**Proposed other utility roles:** Affect appropriate preparation, challenge, and
growth mechanics, not necessarily every score as universal bonuses.

Record rolls and their actual score effects so outcomes can be explained and
reloading does not reroll them. Remaining Auditions work is implementing the
established song, composure, and audience contracts, not designing a second
expected-quality formula or fractional skills. Later missions still need
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

**Open for broader season:** Deltas outside the established Auditions reactions,
the active/archive population used for likeness, and later history cadence.
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

**Established Auditions budget:** Use contestant-focused airtime for all 50 episode
participants, including the 20 later eliminated. Opening-title exposure is
additional and does not satisfy this floor. Half the cut's runtime is baseline
coverage, half features; split-screen runtime counts once, exposure for each
person. Exact segment allocation and solo/shared attention coefficients are
configurable implementation defaults, subject to these invariants.

**Open for later episodes:** Define the budget: contestant-focused airtime versus total runtime,
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

**Established:** Use a 0-100 satisfaction meter and retain episode-by-episode history
for both metrics. Calculate satisfaction changes from performance quality,
engaging stories, attachment to the cast, variety, and perceived fairness.

**Established initial meters:** Audience size is a fictional viewer count, starting
at 100,000 viewers. Satisfaction starts at 50 on a 0-100 scale.

**Established Auditions timing/caps:** Satisfaction changes by at most +/-10 per
episode, bounded 0–100. Strong shown reception can bring up to 12% new viewers.
Low satisfaction causes attrition at the next episode's opening, at most 10% of
the then-current audience, never retroactive removal of closed voters. Exact
curves are tunable implementation defaults; post-season conversion remains open.

Individual audience preference, fanbase loyalty, and exposure can feed voting,
but need distinct roles and bounded effects. A disliked contestant can create
attention without making the show enjoyable.

**Established:** One overall ranking carries across the season, accumulating
contributions from audience votes, performances, and other factors. It is not
reset for each mission. Audience votes contribute from Episode 1, but the ranking
is first publicly revealed on stage in the Episode 2 finale.

All fifty contestants have a season position from initialization, kept hidden
until that reveal. Departures lock into the bottom remaining positions, ordered
by their season standing when they leave: Auditions departures occupy 31-50;
The Battles departures occupy 19-30. Episode 4 locks its ranked elimination at
18 and its withdrawal at 17, leaving sixteen contestants competing within 1-16.
Later episodes never move a departed contestant's locked position, and the
Season Cast table continues to show every contestant's place.

The overall ranking is distinct from a particular performance's evaluation.
Episode 1's performance-only elimination and Episode 2's team losses/saves retain
their explicit rules. Later references to "lowest ranked" use the cumulative
overall ranking, including Episode 4's lowest-ranked contestant overall.
Episode 2's audience save is separate from normal ranking updates.

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
competition-points total is a decaying cumulative record, not an equally weighted permanent
sum and not an abrupt reset. Retain the original episode contributions in history.

At each completed episode, retain 75% of the previous total, then add that episode's
new weighted contribution:

```text
new rankingScore = previous rankingScore * 0.75 + new episode contribution
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

**Established visibility:** Store all cumulative calculations and changes from
Episode 1, but hide the cumulative leaderboard, ranking points, and ranks from the normal
UI, including history details and rendered history JSON, until Episode 2's
on-stage ranking announcement. Dorm scenes do not reveal it early.
Individual audition grades/components/results remain inspectable; this is a
presentation boundary, not deletion of logs.

**Open for later missions:** Evaluation details, voting windows, tie-breakers,
and elimination backlash beyond the established Auditions closure.

**Established vote normalization:** Give the episode's leading vote-getter 100
vote-component points; other contestants receive points proportional to their
votes relative to that leader. Preserve vote gaps rather than using only positions.

```text
vote component = 100 * contestant votes / highest episode vote count
```

Raw vote counts remain in history. Auditions' implementation default for zero
votes is zero vote-component points for everyone, never fabricated votes.

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
For Auditions, show three random options per category on one compact opening
screen; choose one each and lock for the episode. Persist shortlists and choices,
so reload never rerolls. If fewer than three eligible distinct values exist,
offer all of them (implementation guard), preserving the existing repeat rule.

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

Auditions' appeal/voting rules are established below; mood is an episode-only
general-appeal modifier, not another scoring or satisfaction bonus.
**Open for later episodes:** Any different sampling or audience mechanics.
The separate idea of audience segments is not an approved requirement.

Auditions' fan acquisition, transfer, and `fanbaseRatio` use are established below.
Persistent fan counts are separate from ratio modifiers. Storage/schema work
remains; audience retention follows the separate show-satisfaction rules.

### MVP recognition

**Established:** Contestants choose MVP recognition for the preceding completed
episode. There is one overall MVP per episode, chosen by all survivors. Only
survivors can vote or receive the award; eliminated contestants are ineligible.
This is a peer decision, not the player naming a winner.

Each voter's perception of performance, directional relationships, and personality
affinity influence their choice. For Auditions their weights are 40%/40%/20%;
personality does not replace those weights. Current overall rank does not directly determine
their choice; the MVP need not be the highest-ranked or technically best contestant.

**Established Auditions:** After elimination, all 30 survivors privately vote once
for another survivor, never themselves. Use weighted random choice from the
40% observed-performance / 40% directional-relationship / 20% personality-affinity
blend, with each component on 0–100. Perception and affinity formulas are
configurable defaults, not simply judge rank. A suitable default uses visible
delivery/star-quality perception and mean normalized personality-trait similarity.
Plurality wins; ties use a persisted seeded draw. Increment `aggregations.mvp`;
recognition only, no automatic ranking bonus or unapproved stat effects.
The existing `aggregations.mvp` can count awards, but retain each vote/award in
episode history rather than recording only a counter.

**Open for later episodes:** Mission-specific recognition/emotional effects.

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

**Established Auditions order/eligibility:** The three-person check follows MVP
and is the last interaction before recap. Exclude already publicly revealed
secret holders from future shortlists; previous misses may reappear. Draw from
this episode's participants, including newly eliminated contestants, subject to
the existing survivor availability gate. Hit: public reveal and authored
consequence exactly once. Miss: no-op. Private-discovery rules are unchanged.

Apply only validated authored numeric consequences and existing condition/status
strings; defer outcome-changing targets until a future opening. Clamp ordinary stat bounds,
and never reapply starting card influences or invent extra penalties. Unsupported
targets/configuration must produce an explicit configuration error, not a silently
ignored effect. Any public response occurs after votes close and may change
closing state/future popularity, never closed votes, past performances, or survival.
Generic card `set` override scope/precedence remains open for broader-season design;
this is not permission to add an override mechanic to Auditions.

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

**Established:** During setup, sample and persist three songs per track: one
approachable, one intermediate, one demanding. These are shared options; multiple
contestants may choose the same song. The five editable JSON placeholders per
track already exist, but sampling/validation remains implementation work.
Each fixed arrangement declares ordered tested skills and per-skill requirements.
Implementation default: bucket by primary requirement 1–2 / 3 / 4–5 respectively,
with seeded sampling within buckets. Validate every track's required coverage
before running; insufficient/invalid catalog is an explicit configuration error,
never fabricated songs, an undersized pool, or a quiet fallback.

Contestants choose autonomously from the selected pool; the player does not assign
or approve their songs. Persist the pool so reloading does not change the options.
Off-track choices are allowed subject to the personality rules in Episode 1.

Song choices lock before auditions begin; earlier performances cannot change them.

## 6. Episode plans

The format and elimination counts below are established. Episode 1's complete
light-narrative contract is established; later episode interactions and connections
remain proposals unless explicitly identified as established.

### Episode 1 - Auditions

**Format:** 50 contestants each perform one quick audition song focused on vocals,
rap, or dance. Grades reflect absolute performance quality. Eliminate the bottom
20 by audition evaluation, regardless of grade; the eliminated group need not all
have F grades.

**Established presentation/phase contract:** The player watches an episode unfold,
using Continue between meaningful scenes rather than receiving 50 equally long
reports. Start explicitly, then:
1. Compact opening mood screen: six locked specialty choices.
2. Autonomous song choices lock for all 50, with notable choices revealed.
3. Randomized live auditions resolve sequentially in 13/13/13/11 batches, with
   immediate eligible reactions after each audition. Summarize uneventful stretches
   while highlighting meaningful performances/reactions; no 50-click requirement.
4. After all 50 are scored, choose one complete broadcast cut.
5. Resolve shown-footage audience effects, then close audience votes.
6. Reveal the 20 departures and 30 survivors in a few short groups, focusing on
   upsets/emotional departures. Full lists/results remain inspectable.
7. All survivors privately vote for MVP; resolve and recognize the winner.
8. Secret check last (or skip under its established gate), then recap.
9. Save completed state and await the next explicit episode start.

Scene counts and low-level layout are implementation defaults, not new mechanics.
All participants, individual results, choices, and actual state mutations remain
inspectable/archived within the visibility rules. No voluntary withdrawals,
simulated practice, or growth occurs in this milestone. Sequential resolution is
mandatory even when presentation groups auditions: never calculate a past audition
retrospectively from later reactions, results, or ranks.

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

**Established off-track decision:** Normally the probability is 10%; it becomes
25% only when BOTH discipline <= -7 AND curiosity >= +7. High investment, maturity,
or discipline (+7 or above) individually rules out the risk entirely. Any one of
these protective traits is a hard veto, even when curiosity or low discipline
would otherwise encourage changing track.

**Established song-choice judgment:** Weigh ability and genre affinity, but allow
personality to override good judgment. Do not always optimize expected evaluation
or protect contestants from poor choices; reckless choices can genuinely backfire.
This does not override the protective-trait veto on changing tracks.

Selection considers all tested skills with first-skill weight 2, others 1,
generally favoring requirements close to current ability. Matching genre
multiplies a song's selection weight by 2. Use weighted randomness, not a
guaranteed best song. Configurable implementation default: weighted mean absolute
skill/requirement gap `g`, fit weight `1 / (1 + g)`, then genre multiplier.
For multi-part arrangements, use the arrangement's ordered requirements in that
gap calculation. On an off-track roll, default to equal seeded choice among the
other valid tracks, then use the same song weights. These coefficients/algorithms
are tunable defaults, not extra personality drama or player song approval.

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

**Established stage-presence conversion:** For this audition only, use integer
`effectiveStagePresence = clamp(baseStagePresence + composure, 1, 5)` against
requirement 3. On the same raw performance dice used for technical
checks, raise each face to at least `clamp(2 * effectiveStagePresence - 3, 1, 5)`, then
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
display rounding only (decimal count is a configurable default). Equal capped final scores use
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

#### Live reaction contract

After each audition, every other cast member forms a small directional opinion,
including those already performed; exclude the performer. A completed fifty-person
Auditions therefore records all 2,450 observer/performer opinions. This is specific
to watching Auditions, not a general rule that relationships drift without contact.
At most one notable reaction per observer per audition. Most opinions are quiet
and do not become episode notes. Order affects state and directional relationships,
not locked songs.

Use visible delivery and star-quality impressions, never future results or ranks.
Before their own audition, observers compare against capability expectations from
their locked song and current skills, without rolling their future performance.
After performing, they may compare with their actual past result. Same-song
comparisons are stronger. Configurable perception default: compare the same
0–100 blend of 55% technical delivery, 35% stage presence, and equal shares of the
remaining 10% across four star-quality impressions; expectation averages the
ordinary raw-pair possibilities through existing scoring without drawing a roll.
This is a perception metric, not a replacement judge score.

**Adopted tuning:** Require an absolute meaningful comparison gap >=15 points
normally, >=10 for the same song; only then roll a 15% normal or 45% same-song
reaction chance. Personality shapes admiration, inspiration, intimidation,
jealousy, confidence, or sympathy. Ambition/sensitivity may favor rivalry or
intimidation; gentleness/maturity may favor admiration/inspiration. Excellence
does not automatically cause envy. Exact personality/type weights are configurable
defaults conditioned on the observed comparison, not invented events.

Quiet opinions change the directional relationship by +/-1. A notable reaction
replaces that small impression with +/-3 total, or +/-5 for a strong same-song
reaction; do not stack an extra quiet point. All effects stay bounded 0–100,
with no automatic reciprocity. Implementation defaults reuse the existing
comparison/personality-shaped reaction weights for quiet opinion direction:
admiration, inspiration, and sympathy are positive; jealousy, intimidation,
and confidence from judging a weaker performance are negative. Quiet impressions
never change composure. Default strong-gap thresholds are 30 normally / 20 same-song, tunable.
Highlight at most two strong reactions per Continue-paced scene, preferring larger
actual relationship/composure effects rather than listing every observer's changes.
Keep every performance summary and log ALL actual mutations,
including nonnarrated ones. Narrative selection must not discard resolved effects.

Only notable reactions affect temporary composure. It accumulates opposing signed
reaction effects and clamps to
-1..+1 (default individual effect: +1 for inspiration/confidence, -1 for
intimidation; admiration/jealousy/sympathy can be relationship-only). It changes
only effective integer stage presence for the observer's own upcoming audition;
consume/reset after performing. It NEVER edits saved/permanent core or utility
skills, technical checks, raw dice, or Practice. Already-finished observers may
change relationships but not past performance or accumulate readiness for a later
mission. All bonus impressions still use base corresponding skills.

**Save compatibility:** Newly started Auditions persist the
`everyone-forms-opinions` relationship policy. Existing started episodes retain
`reactions-only`, including their original +/-1 or strong same-song +/-3 effects
and randomness sequence. Missing policy metadata migrates to that legacy mode;
do not backfill opinions or rewrite saved votes, fan transfers, or MVP outcomes.

Persist reaction causes, composure transitions, base/effective stage-presence
levels, shared raw dice, per-check adjusted dice/floors, and their effects.
Foundation scoring needs explicit temporary effective-stage input; its current
absence is required code work, not a conflict with the unchanged floor rules.

#### Broadcast contract

**Established player interaction:** Once all 50 auditions are scored and before
votes or elimination reveal, choose ONE of THREE complete preassembled cuts:
musical-performance emphasis; personality/star-quality emphasis; or
backstage/rivalry emphasis. No manual slot casting or repeated editing decisions.

The player knows performance descriptions and grades while choosing packages.
The elimination list is revealed later. Editing still cannot change the locked
audition evaluation; withholding the reveal must not fabricate uncertainty when
the available information makes an outcome inferable.

Package previews show only their cast, footage, and editorial intent/tone. They do
not disclose predicted effects, risk labels, numerical ranges, or exact stat changes.
The player must judge the likely consequences from the content.

Every cut reserves 50% of contestant runtime for baseline coverage of all 50,
guaranteeing >=1% exposure each, and 50% for ten featured contestants. Features
include at least two strongest and two weakest available auditions, plus six
theme-varied contestants, without duplicates. Strongest/weakest are relative:
never describe an audition as amazing/terrible unless absolute quality supports it.
Shared coverage may be someone's only footage; no fixed number of eliminated
contestants must receive a particular edit. Split-screen runtime counts once,
but exposure counts for every person shown. Segment allocation is a configurable
default constrained by these budgets/floors.

Use only actual recorded footage/reactions for scene and rivalry content; do not
fabricate feuds to fill a cut. A cut without rivalry can emphasize available
backstage/personality footage instead. There is no fixed good/neutral/bad cut
bonus: audience outcomes depend on actual shown performances, star quality,
variety, and emotional scenes. Exposure can affect popularity, fans, and the
show, never judging or the elimination cutoff.

Songs and audition order are not player-controlled: contestants lock their own
song choices, and the simulator randomizes the performance order.

Do not confuse filmed performance order with the player's later broadcast order.

#### Audience, votes, and closing state

**Established reception:** All components are 0–100:
`base reception = .40 * technical + .30 * stagePresence + .10 * visual
- .10 * uniqueness + .10 * charisma`. Use resolved delivery (including effective
  stage presence); do not include judge-selected bonus preferences. Then raw double
  1 adds 10 reception points, raw double 6 subtracts 10; clamp 0–100.
  Adjusted doubles never trigger this, and neither twist modifies judging/technical
  scores. Reception is distinct from vote appeal.

**Established voting:** Each viewer casts one vote while all 50 remain eligible.
A fresh season starts entirely general, with no existing fans. Loyal fans vote
for their eligible favorite. Each general viewer notices three distinct
exposure-weighted candidates, then chooses one based on reception, the episode's
six mood matches (+3% each, max +18% general appeal), and existing `audienceRatio`.
Implementation defaults: sample without replacement proportional to shown
exposure, then choose with positive weight
`max(1, reception) * (1 + audienceRatio / 2) * (1 + .03 * moodMatches)`.
Use a pre-broadcast preference snapshot for this vote; subsequent popularity
changes must not recursively feed the same calculation. Coefficients are
configurable, not user-facing algebra or a guaranteed best-candidate vote.
If fewer than three candidates are eligible, notice all; if none, record zero
votes without fabricating candidates. Persist raw totals and the voting population.

**Fans/population conservation:** Persist integer fan counts per favorite separately
from `fanbaseRatio`, plus the general-viewer population. After voting, a base 10%
of general voters convert to fans of the candidate they actually voted for,
adjusted by the recipient's fanbase modifier. Configurable default conversion
probability: `clamp(.10 * (1 + fanbaseRatio), 0, 1)`; seeded draws or population-
conserving integer allocation may aggregate this. Move viewers from general to
fan counts; never duplicate them or count existing loyal voters as new conversions.
After elimination, transfer 80% of departed favorites' fans to survivors, favoring
positive connections from the departed favorite to each survivor; 20% become
general undecided viewers, not audience departures. Default transfer weight:
`1 + max(0, relationship - 50)`; integer largest-remainder allocation with persisted
seeded ties preserves totals. If no survivors are eligible, all affected fans
become general rather than vanishing. Transfer-weight coefficients and integer
rounding are tunable defaults; the established 80%/20% split is not an open question.

**Show effects and timing:** Starting meters remain 100,000 viewers/satisfaction
50. Derive show changes from actual shown performance/star quality, variety, and
recorded emotional scenes, not the selected cut's name. Rivalry may attract
viewers while reducing enjoyment, but neither outcome is guaranteed.
Satisfaction delta is capped +/-10 and satisfaction stays 0–100. Strong reception
can acquire up to 12% new viewers. Low satisfaction removes up to 10% of the
current audience at the NEXT episode opening, not from already-closed voting.
Configurable formula defaults may blend runtime-weighted reception and actual
scene valence/variety into bounded enjoyment/attention indices; positive attention
drives acquisition, enjoyment drives satisfaction. Document these exact curves
and any scene coefficients in configuration rather than claiming them approved.
No fixed rivalry penalty or cut-name bonus is allowed.

Implementation timing default: calculate the 12% acquisition ceiling against
the pre-broadcast audience and resolve that acquisition before voting;
new viewers join as general and vote in this episode. Freeze that population
at vote opening. Integer rounding and later attrition allocation must preserve
`audience = general + sum(fans)` and cannot remove closed votes. Future attrition
uses the closing satisfaction, including any valid post-vote response.
Popularity default: update `audienceRatio` from exposure-scaled signed reception
after closing votes, clamped -1..1; scale is a documented tunable coefficient.
Keep fan counts, popularity, show audience, satisfaction, and production preference
distinct. Do not invent extra happiness/reputation penalties from grades.

**Ranking/closure:** Before elimination reveal, persist the existing Episode 1
contribution: 60% audition performance, 30% leader-relative votes
(`100 * votes / maximumVotes`, default zero for all when maximum is zero), 10%
existing production preference; retain .75 of previous cumulative total.
No audience or production save. All cumulative calculations/changes are stored
but hidden from normal UI/history details until Episode 2's stage introduction. Individual audition
grades/results remain inspectable. Reveal departures in a few short groups with
complete archived lists, transfer fans, then resolve survivor MVP and the last
secret-check interaction under their shared contracts. Any post-vote public
secret response changes only closing state/future popularity, not votes or survival.

**Implemented for milestone 1:** Pool validation/sampling, locking/selection,
reaction/composure input, narrative pacing, cut assembly, audience/fan population
accounting, persisted phases, MVP, and validated authored secret consequences.
Remaining low-level fit, perception, personality weights, scene allocation,
audience curves, and rounding are authorized configurable implementation defaults,
not unresolved high-impact story design.
Calibrate the audition model for a believable spread of performances, but do not
force 20 F grades, reroll results to fill a quota, or secretly lower performances.

### Episode 2 - Group Battles

**Format:** 30 contestants form six groups of five. Losing teams are eliminated,
then judges, audience, and production/label each save one contestant: 12 leave,
18 remain. Trainers give feedback and choose the winning teams.

**Established opening:** Production assigns the thirty survivors randomly to five
fixed dorm rooms of six. Contestants cannot choose or refuse their placement.
Show one highlighted personality/relationship-weighted interaction per room,
including constructive interactions rather than guaranteed fights.
Show all five complete room rosters immediately on arrival. A highlighted
interaction can feature two roommates; it does not mean the room has only two occupants.

The next day, the host announces the challenge and reveals the continuing overall
ranking for the first time. Public votes and delivered performances contribute;
the final top five debut as **Squirrel Zone 2**. The existing cumulative formula
remains in force, including its hidden production contribution; the host does not
disclose internal production preference. Dorm scenes must not leak the ranking.

**Established team formation:** The top six in Episode 1's continuing overall
ranking become captains. In four rounds, captains pick in repeated rank order
1 through 6, not snake order. Each captain selects their highest-liked available
contestant using their outgoing relationship. Break ties by the candidate's
utility charisma, then the average of all seven core skills, then seeded
randomness. Picks are compulsory. This replaces the earlier negotiation,
invitation-refusal, and deadline-assignment proposal.
Each pick records its actual deciding criterion, including tie-breakers, in the
saved scene. Show all four draft rounds before advancing to the battle pairings.
Contestant names in sentences open their details without inline portraits.
After the section text, show one portrait button for each mentioned contestant,
including highlighted reactions, plus the scene's recorded participants.
Rankings show portraits directly in their rows, without a trailing button group.
Sections involving more than 20 unique contestants also omit the trailing buttons
and keep protagonist portraits inline instead. Persist identity references so
equal or overlapping names do not route links to the wrong contestant.
After each pick, contestants still unpicked lose 1 relationship point toward
both the captain and the chosen contestant. Gentleness >= 5 or maturity >= 5
grants immunity, including when sensitivity <= -5; otherwise sensitivity <= -5
increases each loss to 2. Captains and already-selected contestants do not react,
and a contestant stops reacting as soon as they are picked. Losses accumulate
across picks, stay within the normal 0-100 bounds, and persist in change history.

**Established battle structure:** Three head-to-head battles, with the two teams
in each pair performing different songs of comparable difficulty. Production
randomly pairs teams and assigns songs using the saved seed. Editable placeholder
songs and their five parts live under `data/battle-songs.json`. Three winning
teams advance and 15 contestants from losing teams are at risk.

**Established preparation and roles:** The captain is the team leader and assigns
one featured song part to each contestant, prioritizing skill fit. Show whether
each contestant likes or dislikes their assignment, considering ambition and
relationships. The leader is not automatically the center. Each member votes for
another member as center, considering visual, stage presence, charisma, and their
outgoing relationships. **No self-votes.** Resolve tied center votes by stage
presence, then visual, then charisma, then a persisted seeded draw.

Each team completes exactly two practice sessions: learning their parts and a
full rehearsal. Use the established utility-based temporary Practice rules and a
separate core leadership check for each session. Leadership affects management
of tension and cooperation, not automatic success or failure based on a disliked
teammate. Coordination has a small bounded effect on the team score. This episode
does not introduce permanent skill growth or implicit fatigue penalties.

**Established presentation:** Show A's preparation and performance, then B's
preparation as a flashback and B's performance. Both preparations are resolved
before A performs. A's performance can affect B's immediate temporary composure,
not B's already-completed practice. Repeat for all three battles. Keep major
moments prominent and relationship details as sparse, indented highlights.

**Established evaluation:** Evaluate assigned parts using the shared scoring
foundation, integrating nonzero Practice as a secondary tested skill. Combine
individual evaluations into a team score with a bounded coordination modifier.
The higher team score wins; public votes affect saves and the overall ranking,
not the battle winner. Persist checks, dice, individual and team scores, and
explainable tie-breaks.

**Established save interaction:** Judges and audience independently save contestants
before the production/label save. Resolve the judge save first using delivered
individual performance, then audience support among the remaining eligible
contestants. Those saves must be distinct. Offer the player a shortlist drawn
from the remaining at-risk contestants, from which they choose the production
save. Exactly three distinct contestants are saved. A save is an explicit
individual exception to their team's loss; only twelve contestants leave.

**Established withdrawal adjustment:** If a contestant from a winning team
withdraws, offer an extra production-save shortlist so another losing-team
contestant survives. This is an explicit exception to the normal three-save count,
preserving the episode's total departures and 18 remaining contestants.
Departed contestants cannot be selected for a save.
Voluntary withdrawal mechanics remain a separate implementation scope; Episode 2
must not silently invent departures or extra saves.

**Established elimination backlash:** Take outgoing friendships immediately before
results. A survivor considers a contestant a friend at relationship 60 or higher.
Each actually eliminated friend produces a -15 relationship change toward each
member of the team that defeated that friend, excluding self. Cap the combined
episode penalty at -30 per target and clamp relationships to 0-100. Apply only
after the three saves; a saved friend does not trigger elimination backlash.
Record causes and full changes without narrating every affected pair.

**Established player interaction and closure:** Rooms, drafting, parts, centers,
and winners are autonomous. Pause in blocking, non-dismissible decision dialogs
for one featured practice-conflict response, a broadcast-cut choice before voting,
and the production save after judge/audience saves. If there is no genuine dispute,
frame the practice decision honestly as an approach rather than inventing a fight.
Finish with an eighteen-survivor, no-self-vote MVP, the secret check, and recap.
Newly eliminated contestants remain eligible for the closing secret check.
Record one complete Episode 2 change history for every participant; preserve the
twenty Episode 1 departures and the Episode 1 archive.

**Implementation defaults:** Low-level event weights, leadership thresholds,
bounded coordination coefficients, part-assignment preference weights, comparable
song difficulty selection, the save-shortlist ordering, and numerical tie-break
fallbacks are deterministic tunable defaults. They must be recorded and
explainable, not hidden extra outcome guarantees. Scenes, choices, all random
draws, and consequences persist atomically before publication. An older completed
Auditions run may snapshot the new battle catalog when Episode 2 starts; it must
not reroll or rewrite Episode 1.

Current scoring defaults retain `min(100, .55 * technical + .35 * stage
- .20 * mean of the four impressions)`. Average the five individual scores,
  add coordination bounded to -5 through +5, and clamp the team result to 0-100.
  Leadership succeeds at an adjusted 2d6 total of at least 8, using the song's
  difficulty as its requirement; each session shifts coordination by one point.
  Temporary B-team composure is recorded, consumed after performing, and never
  changes permanent skills or completed practice. Opening ranks are renumbered
  among the thirty survivors at the stage reveal, without rewriting Episode 1's
  historical standings.

### Episode 3 - Boot Camp

**Accepted format:** Eighteen survivors retain their Episode 2 rooms and empty
beds, then enter three seeded random groups of six. Mike Philip hosts; Sargent
Miller assesses four outdoor challenges, not the audition judges. Nobody leaves,
but this is a surprise announced only by Mike in Sequence 8.

**Preparation and player control:** Start explicitly after completed runtime-3
Battles, retain surviving opening cast, fill missing slots from the strongest-core
shortlist, and choose six specialty moods from the highest/lowest survivor
anchors (with unique fallbacks and Randomize). Credits grant +0.02 preference
once. Advance individually saved beats; history and profile inspection are
read-only. Runtime-1/2 behavior remains unchanged.

**Eight sequences:** Empty beds; opening; outdoor briefing and groups; Marathon
Mic; Action Sequence; Distraction Box; Sync Gauntlet; relief, peer MVP, and ranking.
Extroversion >= 5 costs one happiness per empty bed; <= -5 gains one; clamp to
0-100 and apply once. Dorm opinions and group first impressions have recorded,
directional relationship consequences, never invented friendships.

**Blind pair selection:** All six members cast equal two-distinct-person ballots
before Challenges 1 and 2. Eligible self-votes are allowed; already-used members
cannot be nominated. Personality, maturity's stronger/weaker balancing, and
outgoing affection inform choices without knowledge of the exercise. Saved
random tie keys resolve cutoff ties. Challenge 3 uses the remaining pair without
a redundant ballot. Lock all three pairs before revealing each exercise.

**Accepted scoring:** Seeded medium-difficulty two-d6 skill-floor checks normalize
to 0-100. Marathon Mic is 50% stamina, 30% consistency, 20% microphone delivery;
Dance uses the stronger vocal/rap skill with a saved tie choice. Action Sequence
is 60% acrobatics, 20% own consistency, 20% the pair's weaker consistency.
Distraction Box is 60% consistency and 40% learning. Sync Gauntlet starts at
50% stamina and 50% consistency per member. Final group score is 60% mean
stamina and 40% weakest consistency, minus three points per actual reset.
Keep all scores bounded to 0-100 and persist check/tie evidence.

**Fatigue and behavior:** Pair loads 6/5/4 minus stamina, bounded to 0-5, cost two
final-performance points per unit. Personality thresholds are >= 5 / <= -5;
risky failures require recorded low dice (raw total <= 4), not sensitivity alone.
Technical personality adjustments are bounded to +/-10 except explicit panic
failure. Final attempts require every timing contribution to reach 60; resets
give +10 temporary correction, with support/fatigue/checking-out effects
reassessed. Stop after five resets with assistance or a safety stop. Additional
individual reset/behavior penalties cap at ten. No permanent skill growth,
lasting injuries, or uncontrolled collapse; restore starting condition/practice.

**Rewards and closure:** Challenges 1-3 each award one individual winner; the
finale awards a winning group and an individual standout from all eighteen.
Each individual win gives +0.05 audience preference, capped at +1, and +5
continuing-score points once; repeat wins are allowed. No fixed group bonus or
guaranteed placement rise. Aggregate performance is 50% pair score, 30% final
individual score, 20% final group score. Apply ordinary audience/continuing-score
rules before the fixed winner points. Baseline pair/group coverage plus at most
two extra recorded spotlight units informs public support; charisma and edits
are reception, not invented technical skill.

**Reveal boundary:** Keep Episode 2's public ranks/scores available until the new
ranking airs. Hide internal closure and future exercises from details/profiles.
Sequence 8 reveals no elimination, then eighteen no-self peer MVP ballots, then
contiguous ranks 1-18 with actual placement reactions. MVP adds no hidden ranking
bonus. There is no investigation or automatic Episode 4. Complete Episode 3
rundowns include actual scenes, ballots, dice, fatigue, events, winners, audience,
MVP, and ranking; older exports and initialization-only cast profiles stay intact.

### Episode 4 - Mega Groups

**Format:** Eighteen survivors form two nine-person teams and perform four
distinct songs in A1/B1/A2/B2 order. Each song has nine assigned parts. One
overall rank-18 elimination and one later voluntary withdrawal leave sixteen.
The ten-sequence narrative is documented in SHOW_EPISODES.md.

**Opening:** Preserve dorms. Comfort the single unhappiest contestant with the
gentlest surviving roommate (or a visitor if alone): +10 reciprocal affection,
+5 happiness to the distressed contestant and +0.10 audienceRatio to both.
The opening retains its ordinary boost. Mike's tired/fun/ready hand-raisers
receive +0.01 fanbaseRatio/audienceRatio/productionRatio respectively, once.

**Blind teams:** Freeze editable `mega-group-tests.json` and
`mega-group-songs.json` definitions for the run. Choose one seeded pair:
Hamburger (resilience+maturity) versus Ice cream (curiosity+sensitivity);
Cat (ambition+gentleness) versus Dog (extroversion+sincerity); Balloon
(curiosity+extroversion) versus Skate (discipline+resilience). Each contestant
chooses the greater own sum without knowing earlier membership; ties use
saved draws. Apply small directed arrival reactions.

**Rebalancing:** Every original member of an overcrowded team nominates exactly
the excess number of distinct other members. Prefer moving the lowest equal
blend of normalized outgoing affection and mean core skill. Highest totals
move; tied cutoffs use saved draws. Ballots are secret to contestants but
visible to viewers. Movers lose 3 happiness and 5 outgoing affection toward
each original stayer. Original stayers lose 1 happiness once. Apply final-team
relationship reactions separately. Both teams finish with exactly nine.

**Practice and roles:** Public leader ballots compare leadership with a +1
effective point for matching the voter's own leadership style, then outgoing
affection. Center ballots compare stage presence, outgoing affection and
visual. Self-votes are allowed for these role elections. One leader and center
serve both songs. Two standard practice sessions cover both songs; actual
tension/harmony and Support/Mediate/Push decisions carry real consequences.
Preserve five-person Battles results when sharing group-size-aware helpers.

**Judging and ranking:** All three regular judges respond immediately after
each performance. Jane Strauss appears only in Sequence 9. Average normalized
consistency and uniqueness checks from both songs' saved dice; >=70 grants
one +0.05 productionRatio benefit, with no flat point award or disapproval
penalty. Average each contestant's two individual performances equally and
run the unchanged cumulative audience/ranking calculation exactly once.

**Closing order:** Jane -> locked audience/ranking -> eighteen-person no-self
peer MVP -> standard secret investigation -> public ranking/movement/reactions
-> rank-18 elimination -> separate withdrawal. Secrets defer outcome-changing
effects. MVP/investigation may recognize a later departure; never rerun them.
No saves.

**Withdrawal:** Among the seventeen survivors, inspect only the single
unhappiest contestant. If investment <0 they withdraw; otherwise the lowest
available rank withdraws. No discipline-plus-ambition test. Preserve the
announced ranking separately, then lock withdrawal at final season position
17, elimination at 18 and compact survivors to 1-16. Do not move prior departures.
Record the withdrawal distinctly from competitive elimination and process
each departure's audience/fan consequences once.

**Persistence and visibility:** Existing runtime-3 Boot Camp saves adopt only
missing Episode 4 catalogs on first preparation; no reset or historical replay.
Persist all choices, ballots, practice, four performances and reveal states.
Keep prior public ranks until the reveal, preserve earlier archives, and hide
Jane/future results/the withdrawal candidate before their scenes.

**Silent progression:** Extend the existing TV/XP ledger without competition
coupling. Two completed practice sessions (+1 each) and two songs (+3 each)
give +8 activity XP per contestant, including failures. Social/award/repeated
viewing beats grant no XP. TV tiers follow actual on-camera moments and never
feed decisions. No award mechanics appear in narration or copied rundowns.

**Ending:** Complete Markdown export and automatic playback land on Episode
4's final screen. Episode 5 Photoshoot is unlocked next, but starts only on an
explicit Episode 5 action. Its flow is specified below.

### Episode 5 - Photoshoot

**Established format:** Sixteen Episode 4 survivors complete individual shoots
and four four-person covers. Eight sequences: dorm aftermath, opening, wardrobe
draft, styling, solo photography, covers, gallery/ballots, then recognition,
investigation and ranking. Mike announces no elimination in Sequence 3; the dorm
opening cannot react to safety before that announcement. Nobody leaves.

**Preparation:** Retain surviving opening members and replace only vacant slots.
The six moods use highest/lowest final Episode 4 survivor specialties, not the
original eighteen-person performance ranking. Normal once-only +0.02 opening
preference applies when credits air. Keep actual dorms and empty beds.

**Catalog and draft:** Freeze the editable four-concept/outfit/prop catalog in
the season. Existing completed Episode 4 saves adopt only missing definitions.
Ranked survivors 1-4 become Concept Leaders, choose available concepts in rank
order, then draft three teammates each in repeating leader order. Draft priority
is outgoing relationship, charisma, mean core skill, saved draw. Preserve The
Battles' seeded behavior when reusing helpers.

Concept choice combines 70% visual-vibe fit and 30% normalized preferred traits.
Catalog fit tables explicitly cover saved visual-vibe keys at 0/50/100 for
clash/neutral/strong. Wardrobe proposals maximize fit then curiosity-aligned
novelty; negotiation can produce actual personality-grounded conflict/support.

**Four production decisions:** Choose Intervene or Let them clash for each team.
Intervene grants a temporary +15 photo-result modifier, concept-appropriate
outfits and -3 happiness per member once. Self-style quality averages normalized
mean uniqueness and mean curiosity; modifier is
`clamp(.5 * (quality - 50), -15, +25)`. Branches cannot stack. Final outfit fit
adds -5/0/+5. These never permanently modify core skills or generic practice.

**Native photo checks:** Each contestant has one saved raw 2d6 pair per individual
shoot and a fresh pair for the group shoot, shared across that shoot's checks.
Use existing minimum-face checks at required level 3, normalized to 0-100.
Individual result is `.40 visual + .40 uniqueness + .20 charisma`, plus styling
and outfit fit, bounded 0-100 with ordinary grade thresholds. Megan discusses
uniqueness/potential; Michael visual/marketability; John has no invented music test.
Actual strong/weak photos produce peer reactions. Extroversion >=5 or charisma >=4
can generate banter, one attention unit and +5 reception, not guaranteed fans.

**Covers:** Public four-person center ballots allow self-votes. Preference is
visual + uniqueness + charisma + outgoing affection/20; tied preferences use
stage presence then draw; tied totals use visual, charisma then draw.
Group personal base is `.35 visual + .25 uniqueness + .25 stagePresence +
.15 charisma`, plus styling/fit. Center gains a temporary +5 result.

A non-center with ambition >=5 attempts to steal focus. Stage-presence evidence
> =70 succeeds: +10 personal result, one attention unit, +5 reception; teammates'
> outgoing affection toward them falls 6, or 8 for the displaced center. Failure
> costs 10 result points, earns grounded criticism and losses of 3/4 respectively.
> Gentle non-centers not already stealing yield: -5 own result and +2 cohesion
> per supporter, capped +6; a real beneficiary gains +2 affection toward the helper.
> Cohesion is `clamp((mean directed affection - 50)/10, -5, +5)` plus support,
> minus 3 per stealing attempt capped at -6. Apply saved cohesion to all four;
> the cover result averages their bounded personal results.

**Gallery and Ultimate Visual:** Narrative descriptions/portraits/grades, not
generated images. Sixteen private-in-world, viewer-visible ballots exclude self.
Ordinary preference maximizes `.65 outgoing relationship + .35 individual photo`;
ties favor photo then draw. A photo >=95 exceeding the closest friend's photo by
> =25 can override friendship. Award ties favor individual photo then saved draw.
> Group photos do not decide the award.

Ultimate Visual replaces MVP, increments its existing counter once with a distinct
label and grants +0.10 permanent audienceRatio once. No flat ranking-point bonus.
Apply the benefit before closing ordinary audience voting; competition evidence
is 60% individual and 40% personal group photo. Reception adds only recorded
positive edits, capped +10. Baseline attention weight 2, up to 2 extra actual
attention units, normalized for voting only; shared-shot screen time remains
separate. Existing cumulative ranking/population formulas resolve once unchanged.

**Investigation and ending:** Seal results before offering three randomly selected,
distinct eligible participants (all available if fewer remain). Exclude publicly
revealed holders, allow previous misses, retain the existing active-secret gate,
and do not bias selection using hidden assignments. Miss is no-op; hit uses
existing authored consequences with status/ranking effects deferred. Reveal ranks
and movement from Episode 4 final survivor positions afterward. All sixteen remain
active and locked departure slots 17-50 stay fixed. Episode 6 is next, not started
or implemented.

**Silent progression and saves:** Styling +1, individual shoot +3 and group shoot
+3 give +7 activity XP per participant, including poor photos. Existing 1/3/6 TV
tiers credit actual moments only. Neither enters decisions or ranking; both stay
out of narration/rundowns. Preserve compressed/raw-save loading, every-beat
snapshot validation and persist-before-publication safety. Auto-complete preserves
existing decisions, intervenes for undecided teams and resolves the ordinary
investigation before the Episode 5 final screen. Copying includes all factual
events/ballots/results without hidden secrets or silent awards.

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
- Auditions' sampled song pool, all locked choices, randomized live order,
  batch preferences, base/effective checks, composure/reaction causes, and resolved
  scene boundaries; all three cut manifests and the selected cut's runtime/exposure.
- Mood shortlists/choices, vote-opening audience/preference snapshot, general/fan
  integer populations and transitions, raw votes, MVP ballots/tie result,
  revealed-secret/consequence IDs, and pending next-opening attrition.
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
back to source contestant profiles. Setup and Auditions use the same before/after
history foundation with causes and stable phase IDs. In-progress episode changes
are saved with each scene; closure appends one episode entry per participant,
including the twenty eliminated contestants.

The contestant change log supports individual recaps but cannot alone represent
the show's decisions, teams, votes, or full history. Do not hide season events in
an arbitrary contestant's log.

**Established episode presentation:** The show is player-paced. Present meaningful
character scenes, practice developments, performances, and reveals rather than
autoplaying through the season. Before each episode, the player explicitly clicks
"Start episode X"; completing one episode does not start the next automatically.
Auditions uses light narrative: highlight consequential moments and summarize
uneventful auditions, with Continue between meaningful scenes, not 50 equally
long reports or mandatory individual announcements. All details remain accessible;
exact summary-scene count and layout are implementation defaults.

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

The established decisions above are not reopened by this list. Milestone 1's
important behavior contracts are closed; its checked design checklist is not an
implementation-completion checklist. No further high-impact Auditions question
was left unapproved in this interview.

**Implemented milestone defaults and remaining tuning, not new story design:**
- Catalog and saved-episode validation reject insufficient pools or incomplete
  progress rather than silently repairing configuration or rerolling outcomes.
- `engine/audition-config.ts` centralizes the approved caps and tunable coefficients;
  live/audience helpers document their remaining local weighting and rounding.
  Live scenes cover up to four auditions, stopping at judging-batch boundaries;
  elimination scenes reveal five departures each.
- Audience enjoyment combines 80% exposure-weighted reception and 20% variety,
  minus actual negative-footage share; attention combines 70% reception and 30%
  actual scene intensity. Satisfaction changes by at most ten points, acquisition
  by at most 12%, and low satisfaction queues at most 10% next-opening attrition.
  Cut IDs themselves provide no numerical bonuses.
- Secret consequences validate numeric stat deltas and the existing authored
  condition/status strings. Conditions apply immediately after voting; status
  and cumulative-score effects are queued as deferred consequences, never used to
  undo locked votes, performances, or the thirty-survivor cut. Applying those
  queued effects and attrition belongs to a future episode-opening implementation.
- Balance calibration remains open; foundation, live, audience, persistence,
  secret, visibility, and full-episode tests exercise the current slice.

**Broader-season decisions still open:**
1. Later mission evaluation/aggregation, utility effects, permanent skill growth,
   fatigue/condition penalties, and meaningful-growth bonus limits. Practice's
   specified later-episode engine remains unimplemented, not required for Auditions.
2. Post-season fan retention/conversion and any mission-specific audience variants.
3. Remaining episode-specific group/role/song authority, judging criteria,
   voting windows, rank locks, saves, and later tie procedures.
4. Generic card-effect precision, allowed `set` targets/override precedence,
   repair/search limits, other validation, and the five canonical bias IDs.
   Do not invent a missing arbitrary override policy for this milestone.
5. Broader opening-title initial/replacement sampling, feature strength, and
   presentation. These setup details are separate from the closed Auditions
   cut/mood contract; baseline audition exposure never depends on an opening bonus.
6. Later-episode broadcast budget/eligibility and solo/shared attention variants.
7. Later roulette catalog/weights/frequency, private-discovery relationship rules,
   history cadence, and active/archive likeness population.
8. Center/Ultimate Visual voting and mission-specific recognition effects beyond
   Auditions' survivor MVP.
9. Withdrawal probabilities/cap/timing and remaining team-specific cut adjustments;
   withdrawals are excluded from the first playable Auditions.
10. Later private-information boundaries beyond the established secret visibility
    and hidden cumulative leaderboard until Episode 2's stage introduction.

## 9. Implementation sequence

1. Use the now-established milestone 1 contracts: songs/selection → live reactions →
   broadcast/audience → episode closure. Document configurable implementation
   defaults; do not reopen scoring, Practice, batch appetite, grades, ties,
   ranking, shortlist, or secret-check no-op rules.
2. Add season state, phase progression, decision/effect records, persistence, and
   deterministic randomness before adding episode-specific shortcuts.
3. Align setup/card application with the approved rules and add opening selection.
4. Build the complete Setup → 50 Auditions → results → 30-survivor slice through
   those systems: autonomous song selection, live reactions, choices, performance,
   broadcast packages, meaningful audience/popularity effects, grading,
   elimination, and closure. No simulated practice or growth bonus in Auditions.
   Reuse the existing scoring foundations, adding the explicit composed
   stage-presence input without changing technical or bonus-quality checks.
5. Add Episode 2 to exercise teams, directional relationships, and distinct saves.
6. Add Episode 3 to establish boot-camp training and continuing ranking updates.
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
The episode must feel like a light, player-paced unfolding show: compact mood,
locked songs, meaningful live highlights, one of three footage-based cuts,
votes before grouped elimination, survivor MVP, secret check last, and recap
awaiting the next explicit start. Verify sparse causal reactions/composure,
exposure/runtime invariants, population conservation, next-opening attrition,
post-vote-only secret consequences, complete inspectable audition archives, and
no cumulative leaderboard leakage through normal history UI before Episode 3.
These are acceptance requirements, not claims of implementation.

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
