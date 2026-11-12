import { Content, ContentError, ContentLoading } from '@components/Content';
import { CurrentSectionDistribution } from '@components/Formation/CurrentSectionDistribution';
import { SnapshotTimeline } from '@components/Formation/SnapshotTimeline';
import { Stage } from '@components/Formation/Stage';
import { TemplateActions } from '@components/Formation/TemplateActions';
import { UnsavedChanges } from '@components/Formation/UnsavedChanges';
import { ControlledVideo } from '@components/Video/ControlledVideo';
import { useDanceFormationQuery, useFormationMutation } from '@hooks/useDanceFormation';
import { useEditHistory } from '@hooks/useEditHistory';
import { SongDistributionProvider, useSongDistributionContext } from '@services/SongDistributionProvider';
import type { Formation, FormationPose } from '@types';
import {
  activeFormationSingers,
  addFormationSnapshot,
  assignCopiedPose,
  createFormation,
  dancerIds,
  deleteFormationSnapshot,
  formatFormationTime,
  formationCenterCandidates,
  formationErrors,
  initialPose,
  reconcileCast,
  resolveFormationPose,
  retimeSnapshot,
} from '@utils/formation';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Flex,
  InputNumber,
  Popconfirm,
  Select,
  Slider,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import './EditFormationPage.scss';

export function EditFormationPage() {
  return (
    <SongDistributionProvider>
      <FormationLoader />
    </SongDistributionProvider>
  );
}

function FormationLoader() {
  const { distribution, song } = useSongDistributionContext();
  const { formationId } = useParams();
  const query = useDanceFormationQuery(
    formationId !== '$draft' ? formationId : distribution.formationId,
    distribution.id,
  );
  if (query.isPending) return <ContentLoading>Loading formation...</ContentLoading>;
  if (query.isError) return <ContentError>{query.error.message}</ContentError>;
  try {
    const saved = query.data ?? createFormation(distribution, song);
    if (
      saved.distributionId !== distribution.id ||
      saved.songId !== song.id ||
      saved.groupId !== distribution.groupId
    ) {
      return <ContentError>This formation belongs to a different distribution, song or group.</ContentError>;
    }
    return (
      <FormationEditor
        initial={reconcileCast(saved, dancerIds(distribution))}
        key={distribution.id}
        saved={saved}
      />
    );
  } catch (error) {
    return <ContentError>{error instanceof Error ? error.message : String(error)}</ContentError>;
  }
}

function FormationEditor({ initial, saved }: { initial: Formation; saved: Formation }) {
  const { distribution, song, group, videoControls } = useSongDistributionContext();
  const history = useEditHistory(initial, saved);
  const formation = history.value;
  const mutation = useFormationMutation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(initial.snapshots[0].id);
  const [selectedDancers, setSelectedDancers] = useState<string[]>([]);
  const [halfSteps, setHalfSteps] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [clipboard, setClipboard] = useState<FormationPose | null>(null);
  const ids = dancerIds(distribution);
  const castChanged =
    saved.assigneesIds.length !== ids.length || ids.some((id) => !saved.assigneesIds.includes(id));
  const selected = formation.snapshots.find((s) => s.id === selectedId) ?? formation.snapshots[0];
  const selectedIndex = formation.snapshots.indexOf(selected);
  const centerCandidates = formationCenterCandidates(song, distribution, selected.timestamp);
  const errors = formationErrors(formation, song, ids);
  const inPreview = (preview || videoControls.isPlaying) && errors.length === 0;
  const locked = mutation.isPending || inPreview;
  const togglePlayback = useCallback(() => {
    if (errors.length > 0) return;
    if (videoControls.isPlaying) videoControls.pauseVideo();
    else {
      setPreview(true);
      videoControls.playVideo();
    }
  }, [errors.length, videoControls]);

  useEffect(() => {
    const handleSpace = (event: KeyboardEvent) => {
      if (
        event.key !== ' ' ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            'input, textarea, select, [role="textbox"], [role="combobox"], [role="dialog"], [role="alertdialog"]',
          ))
      )
        return;
      event.preventDefault();
      if (!event.repeat) togglePlayback();
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [togglePlayback]);

  const act = (action: () => void) => {
    try {
      action();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  };
  const select = (id: string) => {
    const snapshot = formation.snapshots.find((s) => s.id === id);
    if (!snapshot) return;
    setSelectedId(id);
    setPreview(false);
    setSelectedDancers([]);
    videoControls.seekTo(snapshot.timestamp);
  };
  const retime = (id: string, time: number) =>
    act(() => {
      history.edit(retimeSnapshot(formation, id, time, song));
      setSelectedId(id);
      setPreview(false);
      videoControls.seekTo(time);
    });
  const editPose = (positions: FormationPose) =>
    history.edit({
      ...formation,
      snapshots: formation.snapshots.map((s) => (s.id === selected.id ? { ...s, positions } : s)),
    });
  const stagePose = inPreview
    ? resolveFormationPose(formation.snapshots, videoControls.currentTime)
    : selected.positions;
  const names = (values: string[]) =>
    values.map((id) => distribution.assignees[id]?.name ?? id).join(', ') || 'None';
  return (
    <Content>
      <UnsavedChanges dirty={history.dirty} />
      <Typography.Title level={2}>
        {group.name}: {song.title} — Formation
      </Typography.Title>
      <Space className="w-100" orientation="vertical" size="middle">
        {castChanged && !reviewed && (
          <Alert
            description={`Added: ${names(ids.filter((id) => !saved.assigneesIds.includes(id)))}. Removed: ${names(saved.assigneesIds.filter((id) => !ids.includes(id)))}. Existing dancers retain their positions; newcomers are placed at the back. Review every snapshot.`}
            showIcon
            title="Review cast changes before saving"
            type="warning"
          />
        )}
        {errors.length > 0 && (
          <Alert
            description={
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            }
            showIcon
            title="Formation needs correction"
            type="error"
          />
        )}
        <Flex align="center" gap={8} wrap>
          <Button disabled={errors.length > 0} onClick={togglePlayback} title="Play/pause (Space)">
            {videoControls.isPlaying ? 'Pause' : 'Preview'}
          </Button>
          <Button onClick={() => select(selected.id)}>Edit selected pose</Button>
          <Typography.Text code>{formatFormationTime(videoControls.currentTime)}</Typography.Text>
          <Button
            disabled={mutation.isPending || errors.length > 0}
            onClick={() =>
              act(() => {
                videoControls.pauseVideo();
                const result = addFormationSnapshot(formation, Math.round(videoControls.currentTime), song);
                history.edit(result.formation);
                setSelectedId(result.selectedId);
                setPreview(false);
              })
            }
          >
            Add snapshot at playhead
          </Button>
          <Button
            disabled={!history.canUndo || mutation.isPending}
            onClick={() => {
              videoControls.pauseVideo();
              setPreview(false);
              history.undo();
            }}
          >
            Undo
          </Button>
          <Button
            disabled={!history.canRedo || mutation.isPending}
            onClick={() => {
              videoControls.pauseVideo();
              setPreview(false);
              history.redo();
            }}
          >
            Redo
          </Button>
          <Button
            disabled={errors.length > 0}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(formation, {
                onSuccess: (value) => {
                  flushSync(() => {
                    history.markSaved(value);
                    setReviewed(true);
                  });
                  navigate(`/distributions/${distribution.id}/formation/${value.id}`, { replace: true });
                },
              })
            }
            type="primary"
          >
            Save formation
          </Button>
          <Button onClick={() => navigate(`/distributions/${distribution.id}`)}>View distribution</Button>
          <Link to="/formation-templates">Template library</Link>
          <Typography.Text type="secondary">
            {history.dirty ? 'Unsaved changes' : formation.id === '$draft' ? 'New formation' : 'Saved state'}
          </Typography.Text>
        </Flex>
        <Slider
          aria-label="Formation playhead"
          max={song.endAt}
          min={song.startAt}
          onChange={(value) => {
            setPreview(true);
            videoControls.seekTo(value);
          }}
          step={1}
          tooltip={{ formatter: (value) => formatFormationTime(value ?? 0) }}
          value={Math.max(song.startAt, Math.min(song.endAt, videoControls.currentTime))}
        />
        <SnapshotTimeline
          currentTime={videoControls.currentTime}
          disabled={mutation.isPending}
          endAt={song.endAt}
          onRetime={retime}
          onSelect={select}
          selectedId={selected.id}
          snapshots={formation.snapshots}
          startAt={song.startAt}
        />
        <div className="formation-editor">
          <div className="formation-editor__stage">
            <Flex align="center" className="mb-2" gap={12} wrap>
              <Checkbox checked={halfSteps} onChange={(event) => setHalfSteps(event.target.checked)}>
                Allow half-cell steps
              </Checkbox>
              <Select
                aria-label="Selected dancers"
                disabled={locked}
                mode="multiple"
                onChange={setSelectedDancers}
                options={ids.map((id) => ({ value: id, label: distribution.assignees[id].name }))}
                placeholder="Select dancers to move together"
                style={{ minWidth: 280 }}
                value={selectedDancers}
              />
              <Tooltip
                title={
                  selectedDancers.length === 2
                    ? 'Swap positions'
                    : 'Select exactly two dancers to swap positions'
                }
              >
                <Button
                  aria-label="Swap positions"
                  disabled={locked || selectedDancers.length !== 2}
                  icon={<ArrowLeftRightIcon />}
                  onClick={() =>
                    act(() => {
                      const [first, second] = selectedDancers;
                      editPose({
                        ...selected.positions,
                        [first]: { ...selected.positions[second] },
                        [second]: { ...selected.positions[first] },
                      });
                    })
                  }
                />
              </Tooltip>
              <Typography.Text type="secondary">
                {inPreview
                  ? 'Playback preview — choose Edit selected pose to drag'
                  : 'Shift-click to multi-select; arrow keys move selected dancers'}
              </Typography.Text>
            </Flex>
            <Stage
              activeIds={activeFormationSingers(song, distribution, videoControls.currentTime)}
              artists={distribution.assignees}
              disabled={locked}
              fitViewport
              halfSteps={halfSteps}
              onInvalid={(error) => message.error(error)}
              onMove={editPose}
              onSelection={setSelectedDancers}
              positions={stagePose}
              selected={selectedDancers}
            />
          </div>
          <div className="formation-editor__sidebar">
            <Space className="formation-editor__media" orientation="vertical" size="middle">
              <ControlledVideo
                hideControls={false}
                onStateChange={(event) => {
                  if (event.data === 1) setPreview(true);
                  videoControls.onStateChange(event);
                }}
                playerRef={videoControls.playerRef}
                setEnd={videoControls.setEnd}
                setPlaying={videoControls.setPlaying}
                videoId={song.videoId}
                width={320}
              />
              <CurrentSectionDistribution
                distribution={distribution}
                onSeek={(timestamp) => {
                  setPreview(true);
                  videoControls.seekTo(timestamp);
                }}
                song={song}
                timestamp={videoControls.currentTime}
              />
            </Space>
            <Space className="formation-editor__snapshot-controls" orientation="vertical" size="middle">
              <Typography.Title level={4}>
                Snapshot {selectedIndex + 1} · {formatFormationTime(selected.timestamp)}
              </Typography.Title>
              <Space wrap>
                <Button
                  disabled={selectedIndex === 0}
                  onClick={() => select(formation.snapshots[selectedIndex - 1].id)}
                >
                  Previous
                </Button>
                <Button
                  disabled={selectedIndex === formation.snapshots.length - 1}
                  onClick={() => select(formation.snapshots[selectedIndex + 1].id)}
                >
                  Next
                </Button>
              </Space>
              <label htmlFor="snapshot-timestamp">
                Timestamp (milliseconds)
                <InputNumber
                  aria-label="Snapshot timestamp"
                  disabled={mutation.isPending || selected.timestamp === song.startAt}
                  id="snapshot-timestamp"
                  max={song.endAt}
                  min={song.startAt}
                  onChange={(value) => {
                    if (value !== null) retime(selected.id, value);
                  }}
                  precision={0}
                  value={selected.timestamp}
                />
              </label>
              {formation.snapshots[0].timestamp !== song.startAt && (
                <Button onClick={() => retime(formation.snapshots[0].id, song.startAt)}>
                  Anchor first pose at song start
                </Button>
              )}
              <label htmlFor="snapshot-transition">
                Incoming transition (seconds)
                <InputNumber
                  aria-label="Incoming transition seconds"
                  disabled={mutation.isPending || selectedIndex === 0}
                  id="snapshot-transition"
                  max={
                    selectedIndex
                      ? (selected.timestamp - formation.snapshots[selectedIndex - 1].timestamp) / 1000
                      : 0
                  }
                  min={0}
                  onChange={(value) => {
                    if (value === null) return;
                    const transition = Math.round(value * 1000);
                    const gap = selectedIndex
                      ? selected.timestamp - formation.snapshots[selectedIndex - 1].timestamp
                      : 0;
                    if (transition < 0 || transition > gap) {
                      message.error('Transition must fit the preceding gap.');
                      return;
                    }
                    history.edit({
                      ...formation,
                      snapshots: formation.snapshots.map((s) =>
                        s.id === selected.id ? { ...s, transition } : s,
                      ),
                    });
                  }}
                  precision={3}
                  step={0.1}
                  value={selected.transition / 1000}
                />
              </label>
              <Typography.Text type="secondary">
                0 = hard cut. Movement finishes exactly at this snapshot.
              </Typography.Text>
              <Space wrap>
                <Button
                  onClick={() => {
                    setClipboard(structuredClone(selected.positions));
                    message.info('Pose copied');
                  }}
                >
                  Copy pose
                </Button>
                <Button
                  disabled={!clipboard || locked}
                  onClick={() => {
                    if (clipboard) editPose(structuredClone(clipboard));
                  }}
                >
                  Paste exact pose
                </Button>
                <Button
                  disabled={!clipboard || locked}
                  onClick={() =>
                    act(() => {
                      if (clipboard)
                        editPose(assignCopiedPose(selected.positions, clipboard, centerCandidates));
                    })
                  }
                  title="Center the current or next non-adlib singer at this snapshot; then minimize total travel, with existing audience and center tie-breaks"
                >
                  Paste by closest dancer
                </Button>
                <Popconfirm
                  onConfirm={() => editPose(initialPose(ids))}
                  title="Reset this pose to centered rows?"
                >
                  <Button disabled={locked}>Reset pose</Button>
                </Popconfirm>
                <Popconfirm
                  onConfirm={() => {
                    history.edit(deleteFormationSnapshot(formation, selected.id, song.startAt));
                    select(formation.snapshots.find((s) => s.id !== selected.id)?.id ?? selected.id);
                  }}
                  title="Delete this snapshot?"
                >
                  <Button
                    danger
                    disabled={
                      mutation.isPending ||
                      formation.snapshots.length === 1 ||
                      selected.timestamp === song.startAt
                    }
                  >
                    Delete snapshot
                  </Button>
                </Popconfirm>
              </Space>
              <TemplateActions
                centerCandidates={centerCandidates}
                disabled={locked}
                onApply={editPose}
                positions={selected.positions}
              />
              {formation.assigneesIds.join('|') !== ids.join('|') && (
                <Button
                  disabled={mutation.isPending}
                  onClick={() =>
                    act(() => {
                      history.edit(reconcileCast(formation, ids));
                      setSelectedDancers([]);
                      setClipboard(null);
                    })
                  }
                >
                  Review current cast
                </Button>
              )}
              <Select
                aria-label="Choose snapshot"
                onChange={select}
                options={formation.snapshots.map((s, index) => ({
                  value: s.id,
                  label: `${index + 1} — ${formatFormationTime(s.timestamp)}`,
                }))}
                value={selected.id}
              />
            </Space>
          </div>
        </div>
      </Space>
    </Content>
  );
}
