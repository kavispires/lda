import StageSVG from 'assets/images/stage.svg';
import { ArtistAvatar } from 'components/Artist';
import { motion, type PanInfo } from 'framer-motion';
import { STAGE_X_SIZE, STAGE_Y_SIZE, useDanceFormationContext } from 'services/DanceFormationProvider';
import type { Artist, FUID } from 'types';
import './Stage.scss';
import {
  CopyOutlined,
  DeleteOutlined,
  ForwardOutlined,
  PlayCircleFilled,
  PlusOutlined,
  SnippetsOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { Button, Flex, Space, Tooltip, Typography } from 'antd';
import { useQueryParams } from 'hooks/useQueryParams';
import { useMemo } from 'react';
import { useSongDistributionContext } from 'services/SongDistributionProvider';

const HEIGHT_RATIO = 0.703703703703704;

const getCoordinates = (pos: string, width: number) => {
  const height = width * HEIGHT_RATIO;
  const [x, y] = pos.split('::').map((value) => Number(value));
  const xSize = width / STAGE_X_SIZE;
  const ySize = height / STAGE_Y_SIZE;
  const size = width / STAGE_X_SIZE + 5;
  return [x * xSize, y * ySize, size];
};

const getPositions = (x: number, y: number, width: number) => {
  const height = width * HEIGHT_RATIO;
  const xSize = width / STAGE_X_SIZE;
  const ySize = height / STAGE_Y_SIZE;
  return [Math.round(x / xSize), Math.round(y / ySize)];
};

type StageEditProps = {
  width: number;
  timestampKey: string;
  assignees: Record<FUID, Artist>;
  assigneesIds: FUID[];
};

export function StageEdit({ width, timestampKey, assignees, assigneesIds }: StageEditProps) {
  const { timeline, updateDancerPosition, previousTimestamp } = useDanceFormationContext();
  const entry = timeline[timestampKey];
  const previousEntry = timeline?.[previousTimestamp ?? '0'];

  const handleDragEnd = (dancerId: string, initialX: number, initialY: number, info: PanInfo) => {
    const [snappedX, snappedY] = getPositions(initialX + info.offset.x, initialY + info.offset.y, width);

    updateDancerPosition(Number(timestampKey), dancerId, snappedX, snappedY);
  };

  return (
    <div className="dance-stage-edit-wrapper">
      <div
        className="dance-stage"
        style={{
          position: 'relative',
          width,
          height: width * HEIGHT_RATIO,
          backgroundImage: `url(${StageSVG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
        }}
      >
        {assigneesIds.map((assigneeId, index) => {
          const [initialX, initialY, size] = getCoordinates(entry[index], width);
          const assignee = assignees[assigneeId];
          const [previousX, previousY] = getCoordinates(previousEntry?.[index] ?? '0::0', width);

          return (
            <motion.div
              animate={{
                x: initialX,
                y: initialY,
              }}
              drag
              dragMomentum={false}
              initial={{
                x: previousX,
                y: previousY,
              }}
              key={index}
              onDragEnd={(_, info) => handleDragEnd(assigneeId, initialX, initialY, info)}
              style={{
                position: 'absolute',
                cursor: 'grab',
              }}
            >
              <ArtistAvatar
                draggable="false"
                id={assigneeId}
                key={assigneeId}
                name={assignees?.[assigneeId]?.name ?? assigneeId}
                size={size}
                style={{
                  border: `2px solid ${assignee?.color ?? '#f1f1f1'}`,
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineEntry({ timestampKey, width }: { timestampKey: string; width: number }) {
  const timestamp = Number(timestampKey);
  const { queryParams } = useQueryParams();
  const { distribution, videoControls } = useSongDistributionContext();
  const {
    formation,
    deleteTimestamp,
    addTimestamp,
    clipboard,
    copyToClipboard,
    pasteEntry,
    onNextTimestamp,
    onPreviousTimestamp,
  } = useDanceFormationContext();

  const closestLyrics = useMemo(() => {
    return '???';
  }, []);

  return (
    <Space direction="horizontal" key={timestampKey} size="small">
      <Flex className="timeline-entry mb-4 surface" vertical>
        <Flex>
          "{closestLyrics}" <Typography.Text code>{timestamp}s</Typography.Text>
        </Flex>
        <StageEdit
          assignees={distribution.assignees}
          assigneesIds={formation.assigneesIds}
          key={timestampKey}
          timestampKey={timestampKey}
          width={width / Number(queryParams.get('stageSize') ?? 3)}
        />
        <Flex justify="center">
          <Space.Compact>
            <Tooltip title="Previous Timestamp">
              <Button icon={<StepBackwardOutlined />} onClick={onPreviousTimestamp} />
            </Tooltip>
            <Tooltip title="Copy">
              <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(timestamp)} />
            </Tooltip>
            <Tooltip title="Paste">
              <Button
                disabled={!clipboard}
                icon={<SnippetsOutlined />}
                onClick={() => pasteEntry(timestamp)}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} onClick={() => deleteTimestamp(timestamp)} />
            </Tooltip>
            <Tooltip title="Play">
              <Button icon={<PlayCircleFilled />} onClick={() => videoControls.seekAndPlay(timestamp)} />
            </Tooltip>
            <Tooltip title="Next Timestamp">
              <Button icon={<StepForwardOutlined />} onClick={onNextTimestamp} />
            </Tooltip>
          </Space.Compact>
        </Flex>
      </Flex>

      <Flex gap={8} justify="center">
        <ForwardOutlined />

        <Space.Compact>
          <Tooltip title="Add new timestamp">
            <Button disabled icon={<PlusOutlined />} onClick={() => addTimestamp(timestamp)} />
          </Tooltip>
          <Tooltip title="Paste">
            <Button
              disabled
              icon={<SnippetsOutlined />}
              // disabled={!clipboard}
              onClick={() => pasteEntry(timestamp + 1)}
            />
          </Tooltip>
        </Space.Compact>
        <ForwardOutlined />
      </Flex>
    </Space>
  );
}

export function Timeline({ width }: { width: number }) {
  const { timeline } = useDanceFormationContext();

  const orderedTimeline = useMemo(() => {
    return Object.keys(timeline).sort((a, b) => Number(a) - Number(b));
  }, [timeline]);

  return (
    <Flex wrap="wrap">
      {orderedTimeline.map((timestampKey) => {
        return <TimelineEntry key={timestampKey} timestampKey={timestampKey} width={width} />;
      })}
    </Flex>
  );
}
