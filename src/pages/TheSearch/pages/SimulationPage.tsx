import { AppstoreOutlined, RocketOutlined, TableOutlined } from '@ant-design/icons';
import { Content } from '@components/Content';
import { useSelector } from '@tanstack/react-store';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { type Key, useState } from 'react';
import type { ValuesOf } from 'types/common';
import { AuditionEpisodeView } from '../components/AuditionEpisodeView';
import { BattleEpisodeView } from '../components/BattleEpisodeView';
import { BootcampEpisodeView } from '../components/BootcampEpisodeView';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { ContestantDetailModal } from '../components/ContestantDetailModal';
import { CopyMarkdownButton } from '../components/CopyMarkdownButton';
import { CopyShowSoFar } from '../components/CopyShowSoFar';
import { FinaleEpisodeView } from '../components/FinaleEpisodeView';
import { MegaGroupsEpisodeView } from '../components/MegaGroupsEpisodeView';
import { MusicVideoEpisodeView } from '../components/MusicVideoEpisodeView';
import { NarrativeAuditionView, NarrativeBattleView } from '../components/NarrativeEpisodeView';
import { PhotoshootEpisodeView } from '../components/PhotoshootEpisodeView';
import { SpecialtiesEpisodeView } from '../components/SpecialtiesEpisodeView';
import { TrackSpecialsEpisodeView } from '../components/TrackSpecialsEpisodeView';
import { TrackTag } from '../components/TrackTag';
import { VarietyShowEpisodeView } from '../components/VarietyShowEpisodeView';
import { VersatilityEpisodeView } from '../components/VersatilityEpisodeView';
import { useContestantsContext } from '../services/ContestantsProvider';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { AuditionAction } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { BootcampAction } from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import type { FinaleAction } from '../types/finale-episode';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type { MusicVideoAction } from '../types/music-video-episode';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import type { SeasonRuntime, SimulationState } from '../types/simulation';
import type { SpecialtiesAction } from '../types/specialties-episode';
import type { TrackSpecialsAction } from '../types/track-specials-episode';
import type { VarietyShowAction } from '../types/variety-show-episode';
import type { VersatilityAction } from '../types/versatility-episode';
import type { TRACKS } from '../utilities/constants';
import { createSeasonCastProfiles } from '../utilities/contestant-profile';
import { isSeasonRankingVisible, projectSeasonCast } from '../utilities/episode-visibility';

export function SimulationPage() {
  const { contestants: contestantsData } = useContestantsContext();
  const simulationState = useSelector(simulationStore, (state) => state);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useBias, setUseBias] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectionSnapshot, setInspectionSnapshot] = useState<SimulationState | null>(null);
  const inspectContestant = (id: string | null, snapshot: SimulationState | null = null) => {
    setInspectionSnapshot(snapshot);
    setSelectedId(id);
  };

  const handleAuditionAction = (action: AuditionAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchAudition(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next audition scene.');
    }
  };

  const handleBattleAction = (action: BattleAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchBattle(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next battle scene.');
    }
  };

  const handleBootcampAction = (action: BootcampAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchBootcamp(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Boot Camp scene.');
    }
  };

  const handleMegaGroupsAction = (action: MegaGroupsAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchMegaGroups(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Mega Groups scene.');
    }
  };

  const handlePhotoshootAction = (action: PhotoshootAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchPhotoshoot(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Photoshoot scene.');
    }
  };
  const handleTrackSpecialsAction = (action: TrackSpecialsAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchTrackSpecials(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Track Specials scene.');
    }
  };
  const handleVersatilityAction = (action: VersatilityAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchVersatility(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Versatility scene.');
    }
  };
  const handleVarietyShowAction = (action: VarietyShowAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchVarietyShow(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Variety Show scene.');
    }
  };
  const handleMusicVideoAction = (action: MusicVideoAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchMusicVideo(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Music Videos scene.');
    }
  };
  const handleSpecialtiesAction = (action: SpecialtiesAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchSpecialties(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Specialties scene.');
    }
  };
  const handleFinaleAction = (action: FinaleAction, revision: number) => {
    try {
      setError(null);
      simulationActions.dispatchFinale(action, revision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the next Finale scene.');
    }
  };

  const handleStartSimulation = async () => {
    setIsInitializing(true);
    setError(null);
    setProgress(0);

    try {
      setProgressText('Selecting 50 diverse contestants...');
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgressText('Assigning attribute cards and calculating influences...');
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgressText('Initializing simulation state...');
      setProgress(80);
      await new Promise((resolve) => setTimeout(resolve, 200));

      simulationActions.initializeSimulation(contestantsData, { useBias });

      setProgressText('Simulation ready!');
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleClearSimulation = () => {
    if (window.confirm('Are you sure you want to clear the current simulation? This cannot be undone.')) {
      try {
        simulationActions.clearSimulation();
        setProgress(0);
        setProgressText('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not clear the saved simulation.');
      }
    }
  };

  const hasSimulation = simulationState.contestants.length > 0;
  const specialtiesArchiveState: SimulationState = simulationState.runtime?.finale
    ? {
        ...simulationState,
        contestants: simulationState.runtime.finale.startingContestants,
        runtime: {
          ...simulationState.runtime,
          finale: undefined,
          episode: 10,
          phase: 'episode-complete',
          show: simulationState.runtime.finale.startingShow,
          revealedSecrets: simulationState.runtime.finale.startingRevealedSecrets,
          deferredConsequences: simulationState.runtime.finale.startingDeferredConsequences,
        },
      }
    : simulationState;
  const musicVideoArchiveState: SimulationState = specialtiesArchiveState.runtime?.specialties
    ? {
        ...specialtiesArchiveState,
        contestants: specialtiesArchiveState.runtime.specialties.startingContestants,
        runtime: {
          ...specialtiesArchiveState.runtime,
          specialties: undefined,
          episode: 9,
          phase: 'episode-complete',
          show: specialtiesArchiveState.runtime.specialties.startingShow,
          revealedSecrets: specialtiesArchiveState.runtime.specialties.startingRevealedSecrets,
          deferredConsequences: specialtiesArchiveState.runtime.specialties.startingDeferredConsequences,
        },
      }
    : specialtiesArchiveState;
  const varietyShowArchiveState: SimulationState = musicVideoArchiveState.runtime?.musicVideo
    ? {
        ...musicVideoArchiveState,
        contestants: musicVideoArchiveState.runtime.musicVideo.startingContestants,
        runtime: {
          ...musicVideoArchiveState.runtime,
          musicVideo: undefined,
          episode: 8,
          phase: 'episode-complete',
          show: musicVideoArchiveState.runtime.musicVideo.startingShow,
          revealedSecrets: musicVideoArchiveState.runtime.revealedSecrets.filter((entry) =>
            musicVideoArchiveState
              .runtime!.musicVideo!.startingContestants.find((person) => person.id === entry.contestantId)
              ?.events.includes(`SECRET_REVEALED:${entry.cardId}`),
          ),
        },
      }
    : musicVideoArchiveState;
  const versatilityArchiveState: SimulationState = varietyShowArchiveState.runtime?.varietyShow
    ? {
        ...varietyShowArchiveState,
        contestants: varietyShowArchiveState.runtime.varietyShow.startingContestants,
        runtime: {
          ...varietyShowArchiveState.runtime,
          varietyShow: undefined,
          episode: 7,
          phase: 'episode-complete',
          show: varietyShowArchiveState.runtime.varietyShow.startingShow,
          revealedSecrets: varietyShowArchiveState.runtime.revealedSecrets.filter((entry) =>
            varietyShowArchiveState
              .runtime!.varietyShow!.startingContestants.find((person) => person.id === entry.contestantId)
              ?.events.includes(`SECRET_REVEALED:${entry.cardId}`),
          ),
        },
      }
    : varietyShowArchiveState;
  const trackSpecialsArchiveState: SimulationState = versatilityArchiveState.runtime?.versatility
    ? {
        ...versatilityArchiveState,
        contestants: versatilityArchiveState.runtime.versatility.startingContestants,
        runtime: {
          ...versatilityArchiveState.runtime,
          versatility: undefined,
          episode: 6,
          phase: 'episode-complete',
          revealedSecrets: versatilityArchiveState.runtime.revealedSecrets.filter((entry) =>
            versatilityArchiveState
              .runtime!.versatility!.startingContestants.find((person) => person.id === entry.contestantId)
              ?.events.includes(`SECRET_REVEALED:${entry.cardId}`),
          ),
        },
      }
    : versatilityArchiveState;
  const photoshootArchiveState: SimulationState = trackSpecialsArchiveState.runtime?.trackSpecials
    ? {
        ...trackSpecialsArchiveState,
        contestants: trackSpecialsArchiveState.runtime.trackSpecials.startingContestants,
        runtime: {
          ...trackSpecialsArchiveState.runtime,
          trackSpecials: undefined,
          episode: 5,
          phase: 'episode-complete',
          revealedSecrets: trackSpecialsArchiveState.runtime.revealedSecrets.filter((entry) =>
            trackSpecialsArchiveState
              .runtime!.trackSpecials!.startingContestants.find((person) => person.id === entry.contestantId)
              ?.events.includes(`SECRET_REVEALED:${entry.cardId}`),
          ),
        },
      }
    : trackSpecialsArchiveState;
  const megaGroupsArchiveState = photoshootArchiveState.runtime?.photoshoot
    ? {
        ...photoshootArchiveState,
        contestants: photoshootArchiveState.runtime.photoshoot.startingContestants,
        runtime: {
          ...photoshootArchiveState.runtime,
          photoshoot: undefined,
          revealedSecrets: photoshootArchiveState.runtime.revealedSecrets.filter((entry) =>
            photoshootArchiveState
              .runtime!.photoshoot!.startingContestants.find((person) => person.id === entry.contestantId)
              ?.events.includes(`SECRET_REVEALED:${entry.cardId}`),
          ),
        },
      }
    : photoshootArchiveState;
  const bootcampArchiveState = megaGroupsArchiveState.runtime?.megaGroups
    ? {
        ...megaGroupsArchiveState,
        contestants: megaGroupsArchiveState.runtime.megaGroups.startingContestants,
        runtime: { ...megaGroupsArchiveState.runtime, megaGroups: undefined },
      }
    : megaGroupsArchiveState;
  const archivedState = bootcampArchiveState.runtime?.bootcamp
    ? {
        ...bootcampArchiveState,
        contestants: bootcampArchiveState.runtime.bootcamp.startingContestants,
        runtime: { ...bootcampArchiveState.runtime, bootcamp: undefined },
      }
    : bootcampArchiveState;
  const AuditionView =
    simulationState.runtime && simulationState.runtime.version !== 1
      ? NarrativeAuditionView
      : AuditionEpisodeView;
  const BattleView =
    simulationState.runtime && simulationState.runtime.version !== 1
      ? NarrativeBattleView
      : BattleEpisodeView;

  return (
    <Content>
      <Typography.Title level={1}>
        <RocketOutlined /> Simulation
      </Typography.Title>
      <Typography.Paragraph style={{ fontSize: '16px' }}>
        Initialize a new survival show simulation with 50 diverse contestants. The system will automatically
        assign personas, attributes, and calculate initial statistics.
      </Typography.Paragraph>
      <Alert
        description={
          simulationState.runtime && simulationState.runtime.version !== 3
            ? 'Follow fifty contestants through Auditions, then the final thirty into dorm life, team drafts and Group Battles. Eighteen will survive Episode 2.'
            : 'Follow fifty contestants through Auditions, then thirty into dorm life, captain-led drafts and The Battles. Discover the results as each episode unfolds.'
        }
        showIcon
        style={{ marginBottom: '1rem' }}
        title="The Search"
        type="info"
      />

      {simulationState.persistenceError && (
        <Alert
          description={simulationState.persistenceError}
          showIcon
          style={{ marginBottom: '1rem' }}
          title="Saved Simulation Error"
          type="error"
        />
      )}

      {error && (
        <Alert
          closable={{ onClose: () => setError(null) }}
          description={error}
          showIcon
          style={{ marginBottom: '1rem' }}
          title="Simulation Error"
          type="error"
        />
      )}

      {!hasSimulation && !isInitializing && (
        <Card style={{ marginTop: '2rem', maxWidth: '800px' }}>
          <Typography.Title level={3}>Initialization Process</Typography.Title>
          <Typography.Paragraph>When you start a new simulation, the system will:</Typography.Paragraph>
          <ul>
            <li>Select 50 diverse contestants from Firestore (~23 VOCAL, ~14 RAP, ~14 DANCE)</li>
            <li>Assign unique persona cards to each contestant</li>
            <li>Add identity, interest, lifestyle, history, quirk, and secret attribute cards</li>
            <li>Calculate influences from all cards and specialties</li>
            <li>Initialize relationships between all contestants</li>
            <li>Create baseline statistics for the competition</li>
          </ul>

          <div style={{ marginTop: '2rem' }}>
            <Checkbox
              checked={useBias}
              onChange={(e) => setUseBias(e.target.checked)}
              style={{ marginBottom: '1rem', display: 'block' }}
            >
              Force-include bias contestants (contestants with bias=true will always be selected)
            </Checkbox>

            <Button
              icon={<RocketOutlined />}
              loading={isInitializing}
              onClick={handleStartSimulation}
              size="large"
              type="primary"
            >
              Start New Simulation
            </Button>
          </div>
        </Card>
      )}

      {isInitializing && (
        <Card style={{ marginTop: '2rem', maxWidth: '800px' }}>
          <Typography.Title level={3}>Initializing Simulation...</Typography.Title>
          <Progress percent={progress} status="active" />
          <Typography.Paragraph style={{ marginTop: '1rem' }}>{progressText}</Typography.Paragraph>
        </Card>
      )}

      {hasSimulation && !isInitializing && (
        <>
          {simulationState.runtime ? (
            <>
              {simulationState.runtime.version === 1 && (
                <Typography.Paragraph type="secondary">
                  Seed: {simulationState.runtime.seed}. Songs, source profiles and definitions are frozen for
                  this season.
                </Typography.Paragraph>
              )}
              {simulationState.runtime.photoshoot ? (
                <>
                  {simulationState.runtime.trackSpecials ? (
                    <>
                      {simulationState.runtime.versatility ? (
                        <>
                          {simulationState.runtime.varietyShow ? (
                            <>
                              {simulationState.runtime.musicVideo ? (
                                <>
                                  {simulationState.runtime.specialties ? (
                                    <>
                                      {simulationState.runtime.finale ? (
                                        <>
                                          <FinaleEpisodeView
                                            actionError={error}
                                            key={`${simulationState.runtime.runId}-finale`}
                                            onAction={handleFinaleAction}
                                            onInspect={inspectContestant}
                                            state={simulationState}
                                          />
                                          <Collapse
                                            items={[
                                              {
                                                key: 'specialties',
                                                label: 'Episode 10 — Specialties archive',
                                                children: (
                                                  <SpecialtiesEpisodeView
                                                    onAction={handleSpecialtiesAction}
                                                    onInspect={(id) =>
                                                      inspectContestant(id, specialtiesArchiveState)
                                                    }
                                                    state={specialtiesArchiveState}
                                                  />
                                                ),
                                              },
                                            ]}
                                            style={{ marginTop: 16 }}
                                          />
                                        </>
                                      ) : (
                                        <>
                                          <SpecialtiesEpisodeView
                                            actionError={error}
                                            key={`${simulationState.runtime.runId}-specialties`}
                                            onAction={handleSpecialtiesAction}
                                            onInspect={inspectContestant}
                                            state={simulationState}
                                          />
                                          {simulationState.runtime.specialties.phase === 'complete' && (
                                            <FinaleEpisodeView
                                              actionError={error}
                                              onAction={handleFinaleAction}
                                              onInspect={inspectContestant}
                                              state={simulationState}
                                            />
                                          )}
                                        </>
                                      )}
                                      <Collapse
                                        items={[
                                          {
                                            key: 'music-video',
                                            label: 'Episode 9 — Music Videos archive',
                                            children: (
                                              <MusicVideoEpisodeView
                                                onAction={handleMusicVideoAction}
                                                onInspect={(id) =>
                                                  inspectContestant(id, musicVideoArchiveState)
                                                }
                                                state={musicVideoArchiveState}
                                              />
                                            ),
                                          },
                                        ]}
                                        style={{ marginTop: 16 }}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <MusicVideoEpisodeView
                                        actionError={error}
                                        key={`${simulationState.runtime.runId}-music-video`}
                                        onAction={handleMusicVideoAction}
                                        onInspect={inspectContestant}
                                        state={simulationState}
                                      />
                                      {simulationState.runtime.musicVideo.phase === 'complete' && (
                                        <SpecialtiesEpisodeView
                                          actionError={error}
                                          onAction={handleSpecialtiesAction}
                                          onInspect={inspectContestant}
                                          state={simulationState}
                                        />
                                      )}
                                    </>
                                  )}
                                  <Collapse
                                    items={[
                                      {
                                        key: 'variety-show',
                                        label: 'Episode 8 — Variety Show archive',
                                        children: (
                                          <VarietyShowEpisodeView
                                            onAction={handleVarietyShowAction}
                                            onInspect={(id) => inspectContestant(id, varietyShowArchiveState)}
                                            state={varietyShowArchiveState}
                                          />
                                        ),
                                      },
                                    ]}
                                    style={{ marginTop: 16 }}
                                  />
                                </>
                              ) : (
                                <>
                                  <VarietyShowEpisodeView
                                    actionError={error}
                                    key={`${simulationState.runtime.runId}-variety-show`}
                                    onAction={handleVarietyShowAction}
                                    onInspect={inspectContestant}
                                    state={simulationState}
                                  />
                                  {simulationState.runtime.varietyShow.phase === 'complete' && (
                                    <MusicVideoEpisodeView
                                      actionError={error}
                                      onAction={handleMusicVideoAction}
                                      onInspect={inspectContestant}
                                      state={simulationState}
                                    />
                                  )}
                                </>
                              )}
                              <Collapse
                                items={[
                                  {
                                    key: 'versatility',
                                    label: 'Episode 7 — Versatility archive',
                                    children: (
                                      <VersatilityEpisodeView
                                        onAction={handleVersatilityAction}
                                        onInspect={(id) => inspectContestant(id, versatilityArchiveState)}
                                        state={versatilityArchiveState}
                                      />
                                    ),
                                  },
                                ]}
                                style={{ marginTop: 16 }}
                              />
                            </>
                          ) : (
                            <>
                              <VersatilityEpisodeView
                                actionError={error}
                                key={`${simulationState.runtime.runId}-versatility`}
                                onAction={handleVersatilityAction}
                                onInspect={inspectContestant}
                                state={simulationState}
                              />
                              {simulationState.runtime.versatility.phase === 'complete' && (
                                <VarietyShowEpisodeView
                                  actionError={error}
                                  onAction={handleVarietyShowAction}
                                  onInspect={inspectContestant}
                                  state={simulationState}
                                />
                              )}
                            </>
                          )}
                          <Collapse
                            items={[
                              {
                                key: 'track-specials',
                                label: 'Episode 6 — Track Specials archive',
                                children: (
                                  <TrackSpecialsEpisodeView
                                    onAction={handleTrackSpecialsAction}
                                    onInspect={(id) => inspectContestant(id, trackSpecialsArchiveState)}
                                    state={trackSpecialsArchiveState}
                                  />
                                ),
                              },
                            ]}
                            style={{ marginTop: 16 }}
                          />
                        </>
                      ) : (
                        <>
                          <TrackSpecialsEpisodeView
                            actionError={error}
                            key={`${simulationState.runtime.runId}-track-specials`}
                            onAction={handleTrackSpecialsAction}
                            onInspect={inspectContestant}
                            state={simulationState}
                          />
                          {simulationState.runtime.trackSpecials.phase === 'complete' && (
                            <VersatilityEpisodeView
                              actionError={error}
                              onAction={handleVersatilityAction}
                              onInspect={inspectContestant}
                              state={simulationState}
                            />
                          )}
                        </>
                      )}
                      <Collapse
                        items={[
                          {
                            key: 'photoshoot',
                            label: 'Episode 5 — The Photoshoot archive',
                            children: (
                              <PhotoshootEpisodeView
                                onAction={handlePhotoshootAction}
                                onInspect={(id) => inspectContestant(id, photoshootArchiveState)}
                                state={photoshootArchiveState}
                              />
                            ),
                          },
                        ]}
                        style={{ marginTop: 16 }}
                      />
                    </>
                  ) : (
                    <>
                      <PhotoshootEpisodeView
                        actionError={error}
                        key={`${simulationState.runtime.runId}-photoshoot`}
                        onAction={handlePhotoshootAction}
                        onInspect={inspectContestant}
                        state={simulationState}
                      />
                      {simulationState.runtime.photoshoot.phase === 'complete' && (
                        <TrackSpecialsEpisodeView
                          actionError={error}
                          onAction={handleTrackSpecialsAction}
                          onInspect={inspectContestant}
                          state={simulationState}
                        />
                      )}
                    </>
                  )}
                  <Collapse
                    items={[
                      {
                        key: 'mega-groups',
                        label: 'Episode 4 — Mega Groups archive',
                        children: (
                          <MegaGroupsEpisodeView
                            onAction={handleMegaGroupsAction}
                            onInspect={(id) => inspectContestant(id, megaGroupsArchiveState)}
                            state={megaGroupsArchiveState}
                          />
                        ),
                      },
                      {
                        key: 'bootcamp',
                        label: 'Episode 3 — Boot Camp archive',
                        children: (
                          <BootcampEpisodeView
                            onAction={handleBootcampAction}
                            onInspect={(id) => inspectContestant(id, bootcampArchiveState)}
                            state={bootcampArchiveState}
                          />
                        ),
                      },
                      {
                        key: 'battles',
                        label: 'Episode 2 — The Battles archive',
                        children: (
                          <BattleView
                            onAction={handleBattleAction}
                            onInspect={(id) => inspectContestant(id, archivedState)}
                            state={archivedState}
                          />
                        ),
                      },
                      {
                        key: 'auditions',
                        label: 'Episode 1 — Auditions archive',
                        children: (
                          <AuditionView
                            onAction={handleAuditionAction}
                            onInspect={(id) => inspectContestant(id, archivedState)}
                            state={archivedState}
                          />
                        ),
                      },
                    ]}
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : simulationState.runtime.megaGroups ? (
                <>
                  <MegaGroupsEpisodeView
                    actionError={error}
                    key={`${simulationState.runtime.runId}-mega-groups`}
                    onAction={handleMegaGroupsAction}
                    onInspect={setSelectedId}
                    state={simulationState}
                  />
                  {simulationState.runtime.megaGroups.phase === 'complete' && (
                    <PhotoshootEpisodeView
                      actionError={error}
                      onAction={handlePhotoshootAction}
                      onInspect={setSelectedId}
                      state={simulationState}
                    />
                  )}
                  <Collapse
                    items={[
                      {
                        key: 'bootcamp',
                        label: 'Episode 3 — Boot Camp archive',
                        children: (
                          <BootcampEpisodeView
                            onAction={handleBootcampAction}
                            onInspect={setSelectedId}
                            state={bootcampArchiveState}
                          />
                        ),
                      },
                      {
                        key: 'battles',
                        label: 'Episode 2 — The Battles archive',
                        children: (
                          <BattleView
                            onAction={handleBattleAction}
                            onInspect={setSelectedId}
                            state={archivedState}
                          />
                        ),
                      },
                      {
                        key: 'auditions',
                        label: 'Episode 1 — Auditions archive',
                        children: (
                          <AuditionView
                            onAction={handleAuditionAction}
                            onInspect={setSelectedId}
                            state={archivedState}
                          />
                        ),
                      },
                    ]}
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : simulationState.runtime.bootcamp ? (
                <>
                  <BootcampEpisodeView
                    actionError={error}
                    key={`${simulationState.runtime.runId}-bootcamp`}
                    onAction={handleBootcampAction}
                    onInspect={setSelectedId}
                    state={simulationState}
                  />
                  {simulationState.runtime.bootcamp.phase === 'complete' && (
                    <MegaGroupsEpisodeView
                      actionError={error}
                      onAction={handleMegaGroupsAction}
                      onInspect={setSelectedId}
                      state={simulationState}
                    />
                  )}
                  <Collapse
                    items={[
                      {
                        key: 'battles',
                        label: 'Episode 2 — The Battles archive',
                        children: (
                          <BattleView
                            onAction={handleBattleAction}
                            onInspect={setSelectedId}
                            state={archivedState}
                          />
                        ),
                      },
                      {
                        key: 'auditions',
                        label: 'Episode 1 — Auditions archive',
                        children: (
                          <AuditionView
                            onAction={handleAuditionAction}
                            onInspect={setSelectedId}
                            state={archivedState}
                          />
                        ),
                      },
                    ]}
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : simulationState.runtime.battle ? (
                <>
                  <BattleView
                    actionError={error ?? undefined}
                    key={`${simulationState.runtime.runId}-battles`}
                    onAction={handleBattleAction}
                    onInspect={setSelectedId}
                    state={simulationState}
                  />
                  {simulationState.runtime.version === 3 &&
                    simulationState.runtime.battle.phase === 'complete' && (
                      <BootcampEpisodeView
                        actionError={error}
                        onAction={handleBootcampAction}
                        onInspect={setSelectedId}
                        state={simulationState}
                      />
                    )}
                  <Collapse
                    items={[
                      {
                        key: 'auditions',
                        label: 'Episode 1 — Auditions archive',
                        children: (
                          <AuditionView
                            onAction={handleAuditionAction}
                            onInspect={setSelectedId}
                            state={simulationState}
                          />
                        ),
                      },
                    ]}
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : (
                <>
                  <AuditionView
                    actionError={error ?? undefined}
                    key={simulationState.runtime.runId}
                    onAction={handleAuditionAction}
                    onInspect={setSelectedId}
                    state={simulationState}
                  />
                  {simulationState.runtime.audition?.phase === 'complete' && (
                    <BattleView
                      actionError={error ?? undefined}
                      onAction={handleBattleAction}
                      onInspect={setSelectedId}
                      state={simulationState}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <Alert
              description="This older setup has no seed or frozen definitions. You can inspect it, but start a new simulation to use the audition foundations."
              showIcon
              style={{ marginTop: '1rem' }}
              title="Legacy Setup"
              type="warning"
            />
          )}
          <Space align="start" style={{ marginTop: '2rem' }} wrap>
            <Button danger onClick={handleClearSimulation}>
              Clear Simulation
            </Button>
            <CopyShowSoFar key={simulationState.runtime?.runId} state={simulationState} />
          </Space>
          <SimulationOverview
            contestants={simulationState.contestants}
            inspectionSnapshot={inspectionSnapshot}
            onSelect={inspectContestant}
            runtime={simulationState.runtime}
            selectedId={selectedId}
          />
        </>
      )}
    </Content>
  );
}

function SimulationOverview({
  contestants: canonicalContestants,
  runtime,
  inspectionSnapshot,
  selectedId,
  onSelect,
}: {
  contestants: Contestant[];
  runtime: SeasonRuntime | null;
  inspectionSnapshot: SimulationState | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pageSize, setPageSize] = useState(10);
  const contestants = runtime ? projectSeasonCast(canonicalContestants, runtime) : canonicalContestants;
  const inspectionRuntime = inspectionSnapshot?.runtime ?? runtime;
  const inspectionCast = inspectionSnapshot?.runtime
    ? projectSeasonCast(inspectionSnapshot.contestants, inspectionSnapshot.runtime)
    : contestants;
  const selectedContestant = inspectionCast.find((contestant) => contestant.id === selectedId) ?? null;
  const evaluatedIds = new Set(runtime?.audition?.evaluations.map((evaluation) => evaluation.contestantId));
  const hasGrade = (id: string) => !runtime || evaluatedIds.has(id);
  const trackCounts = contestants.reduce(
    (acc, c) => {
      acc[c.track] = (acc[c.track] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const gradeCounts = contestants
    .filter((contestant) => hasGrade(contestant.id))
    .reduce(
      (acc, c) => {
        acc[c.grade] = (acc[c.grade] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  const activeStatusLabel =
    runtime?.audition && ['mvp', 'secret', 'complete'].includes(runtime.audition.phase)
      ? 'Surviving'
      : 'In cast';
  const columns = [
    ...(isSeasonRankingVisible(runtime)
      ? [
          {
            title: 'Rank',
            dataIndex: 'rank',
            key: 'rank',
            width: 75,
            sorter: (a: Contestant, b: Contestant) => a.rank - b.rank,
          },
        ]
      : []),
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: (a: Contestant, b: Contestant) => a.id.localeCompare(b.id),
    },
    {
      title: 'Avatar',
      dataIndex: 'id',
      key: 'avatar',
      width: 80,
      render: (_: string, record: Contestant) => (
        <ContestantAvatar enablePreview={false} id={record.id} name={record.name} size={48} />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Contestant, b: Contestant) => a.name.localeCompare(b.name),
    },
    {
      title: 'Track',
      dataIndex: 'track',
      key: 'track',
      width: 100,
      render: (track: ValuesOf<typeof TRACKS>) => <TrackTag track={track} />,
      sorter: (a: Contestant, b: Contestant) => a.track.localeCompare(b.track),
    },
    {
      title: runtime?.battle ? 'Latest grade' : 'Grade',
      dataIndex: 'grade',
      key: 'grade',
      width: 80,
      render: (grade: string, contestant: Contestant) => (hasGrade(contestant.id) ? grade : 'Not performed'),
      sorter: (a: Contestant, b: Contestant) =>
        (hasGrade(a.id) ? a.grade : 'Not performed').localeCompare(
          hasGrade(b.id) ? b.grade : 'Not performed',
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: Contestant, b: Contestant) => a.status.localeCompare(b.status),
      filters: [
        { text: activeStatusLabel, value: 'ACTIVE' },
        { text: 'Departed', value: 'ELIMINATED' },
      ],
      onFilter: (value: Key | boolean, record: Contestant) => record.status === value,
      render: (status: string, contestant: Contestant) =>
        status === 'ELIMINATED'
          ? runtime?.finale?.resultsPublished && runtime.finale.participantIds.includes(contestant.id)
            ? 'Not selected'
            : runtime?.versatility?.expelledId === contestant.id
              ? 'Expelled'
              : runtime?.megaGroups?.withdrawnId === contestant.id
                ? 'Withdrew'
                : 'Eliminated'
          : status === 'WINNER'
            ? runtime?.finale?.centerId === contestant.id
              ? 'Center — Squirrel Zone'
              : 'Squirrel Zone'
            : activeStatusLabel,
    },
    {
      title: 'Persona',
      dataIndex: 'persona',
      key: 'persona',
      width: 200,
      render: (persona: string) => persona || '—',
      sorter: (a: Contestant, b: Contestant) => (a.persona || '').localeCompare(b.persona || ''),
    },
  ];

  const overview = (
    <Card>
      <Space align="start" orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>Season Cast</Typography.Title>
          <Typography.Paragraph>
            Inspect any of the {contestants.length} contestants without advancing the episode.
          </Typography.Paragraph>
          {runtime?.finale ? (
            <Typography.Paragraph type="secondary">
              {runtime.finale.revealedWinnerIds.length === 5
                ? 'Viewer-only final season placements and scores. The broadcast announces the five members only.'
                : 'Ranks and continuing scores: previous public Episode 10 final standings. Final results remain sealed.'}
            </Typography.Paragraph>
          ) : runtime?.specialties ? (
            <Typography.Paragraph type="secondary">
              {runtime.specialties.rankRevealed
                ? 'Ranks and continuing scores: Episode 10.'
                : 'Ranks and continuing scores: previous public Episode 9 final standings.'}
            </Typography.Paragraph>
          ) : runtime?.musicVideo ? (
            <Typography.Paragraph type="secondary">
              {runtime.musicVideo.rankRevealed
                ? 'Ranks and continuing scores: Episode 9.'
                : 'Ranks and continuing scores: previous public Episode 8 final standings.'}
            </Typography.Paragraph>
          ) : runtime?.varietyShow ? (
            <Typography.Paragraph type="secondary">
              {runtime.varietyShow.rankRevealed
                ? 'Ranks and continuing scores: Episode 8.'
                : 'Ranks and continuing scores: previous public Episode 7 final standings.'}
            </Typography.Paragraph>
          ) : runtime?.versatility ? (
            <Typography.Paragraph type="secondary">
              {runtime.versatility.expelledId
                ? 'Final season placements after Episode 7 departures.'
                : runtime.versatility.rankRevealed
                  ? 'Announced Episode 7 performance ranking.'
                  : 'Ranks and continuing scores: previous public Episode 6 standings.'}
            </Typography.Paragraph>
          ) : runtime?.trackSpecials ? (
            <Typography.Paragraph type="secondary">
              {runtime.trackSpecials.rankRevealed
                ? 'Ranks and continuing scores: Episode 6.'
                : 'Ranks and continuing scores: previous public Episode 5 standings.'}
            </Typography.Paragraph>
          ) : runtime?.photoshoot ? (
            <Typography.Paragraph type="secondary">
              {runtime.photoshoot.rankRevealed
                ? 'Ranks and continuing scores: Episode 5.'
                : 'Ranks and continuing scores: previous public Episode 4 final standings.'}
            </Typography.Paragraph>
          ) : runtime?.megaGroups ? (
            <Typography.Paragraph type="secondary">
              {runtime.megaGroups.phase === 'complete'
                ? 'Final season placements after Episode 4 departures.'
                : runtime.megaGroups.rankRevealed
                  ? 'Announced Episode 4 performance ranking.'
                  : 'Ranks and continuing scores: previous public Episode 3 standings.'}
            </Typography.Paragraph>
          ) : (
            runtime?.bootcamp && (
              <Typography.Paragraph type="secondary">
                {runtime.bootcamp.rankRevealed
                  ? 'Ranks and continuing scores: Episode 3.'
                  : 'Ranks and continuing scores: previous public Episode 2 standings.'}
              </Typography.Paragraph>
            )
          )}
        </div>

        <Descriptions bordered column={2}>
          <Descriptions.Item label="Total Contestants">{contestants.length}</Descriptions.Item>
          <Descriptions.Item label="Resolved Auditions">{evaluatedIds.size}</Descriptions.Item>
          <Descriptions.Item label="VOCAL Track">{trackCounts.VOCAL || 0}</Descriptions.Item>
          <Descriptions.Item label="RAP Track">{trackCounts.RAP || 0}</Descriptions.Item>
          <Descriptions.Item label="DANCE Track">{trackCounts.DANCE || 0}</Descriptions.Item>
          <Descriptions.Item label="Status">
            {runtime?.finale
              ? runtime.phase === 'season-complete'
                ? 'Season complete — Squirrel Zone has debuted'
                : `Episode 11 — ${runtime.finale.phase}`
              : runtime?.specialties
                ? `Episode 10 — ${runtime.specialties.phase}`
                : runtime?.musicVideo
                  ? `Episode 9 — ${runtime.musicVideo.phase}`
                  : runtime?.varietyShow
                    ? `Episode 8 — ${runtime.varietyShow.phase}`
                    : runtime?.versatility
                      ? `Episode 7 — ${runtime.versatility.phase}`
                      : runtime?.trackSpecials
                        ? `Episode 6 — ${runtime.trackSpecials.phase}`
                        : runtime?.photoshoot
                          ? `Episode 5 — ${runtime.photoshoot.phase}`
                          : runtime?.megaGroups
                            ? `Episode 4 — ${runtime.megaGroups.phase}`
                            : runtime?.bootcamp
                              ? `Episode 3 — ${runtime.bootcamp.phase}`
                              : runtime?.battle
                                ? `Episode 2 — ${runtime.battle.phase}`
                                : (runtime?.audition?.phase ?? 'Setup complete')}
          </Descriptions.Item>
        </Descriptions>

        <div>
          <Typography.Title level={4}>Revealed Grade Distribution</Typography.Title>
          <Typography.Text>
            A: {gradeCounts.A || 0} | B: {gradeCounts.B || 0} | C: {gradeCounts.C || 0} | D:{' '}
            {gradeCounts.D || 0} | F: {gradeCounts.F || 0}
          </Typography.Text>
        </div>

        <Space style={{ marginBottom: '1rem' }}>
          {runtime && (
            <CopyMarkdownButton
              createText={() => createSeasonCastProfiles(runtime)}
              key={runtime.runId}
              label="Copy all contestant profiles"
              successMessage="All contestant profiles copied as Markdown."
            />
          )}
          <Button
            icon={<TableOutlined />}
            onClick={() => setViewMode('table')}
            type={viewMode === 'table' ? 'primary' : 'default'}
          >
            Table View
          </Button>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => setViewMode('cards')}
            type={viewMode === 'cards' ? 'primary' : 'default'}
          >
            Card View
          </Button>
        </Space>

        {viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={contestants}
            onRow={(record) => ({
              onClick: () => onSelect(record.id),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 30, 50],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} contestants`,
              onShowSizeChange: (_, newPageSize) => setPageSize(newPageSize),
            }}
            rowKey="id"
            scroll={{ x: 800 }}
            size="small"
          />
        ) : (
          <Row gutter={[16, 16]}>
            {contestants.map((contestant) => (
              <Col key={contestant.id} lg={6} md={8} sm={12} xs={24}>
                <Card hoverable onClick={() => onSelect(contestant.id)} style={{ textAlign: 'center' }}>
                  <ContestantAvatar
                    enablePreview={false}
                    id={contestant.id}
                    name={contestant.name}
                    size={80}
                  />
                  <Typography.Title level={5} style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                    {contestant.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">{contestant.id}</Typography.Text>
                  <div style={{ marginTop: '0.5rem' }}>
                    <TrackTag track={contestant.track} />
                    <Tag>{hasGrade(contestant.id) ? contestant.grade : 'Not performed'}</Tag>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Space>
    </Card>
  );
  return (
    <div style={{ marginTop: '2rem' }}>
      {runtime && runtime.version !== 1 ? (
        <Collapse items={[{ key: 'cast', label: 'Details — season cast', children: overview }]} />
      ) : (
        overview
      )}
      <ContestantDetailModal
        allContestants={inspectionCast}
        contestant={selectedContestant}
        definitions={inspectionRuntime?.definitions}
        expelledEpisode={
          selectedId && inspectionRuntime?.versatility?.expelledId === selectedId ? 7 : undefined
        }
        hidePerformance={!!runtime && !!selectedId && !hasGrade(selectedId)}
        hideSeasonRanking={!isSeasonRankingVisible(inspectionRuntime)}
        notSelectedEpisode={
          selectedId &&
          inspectionRuntime?.finale?.resultsPublished &&
          inspectionRuntime.finale.rankedIds.slice(5).includes(selectedId)
            ? 11
            : undefined
        }
        onClose={() => onSelect(null)}
        withdrawnEpisode={
          selectedId && inspectionRuntime?.megaGroups?.withdrawnId === selectedId ? 4 : undefined
        }
      />
    </div>
  );
}
