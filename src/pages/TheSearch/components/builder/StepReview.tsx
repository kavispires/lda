import { Button, Card, Descriptions, Divider, Space, Typography } from 'antd';
import type { Contestant } from '../../types/contestant';
import { ContestantAvatar } from '../ContestantAvatar';

type StepReviewProps = {
  contestant: Partial<Contestant>;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  onSave: () => void;
  isSaving: boolean;
  existingContestants: Contestant[];
};

export function StepReview({ contestant, setStep, onSave, isSaving }: StepReviewProps) {
  return (
    <>
      <Typography.Title level={3}>Review & Save</Typography.Title>
      <Typography.Paragraph>
        Review the contestant's information before saving. You can go back to any step to make changes.
      </Typography.Paragraph>

      <Card style={{ marginBottom: '1rem' }}>
        <Space align="start" size="large">
          <ContestantAvatar id={contestant.id || 'szc-01'} name={contestant.name || 'Name'} size={128} />
          <div>
            <Typography.Title level={4}>{contestant.name || 'Unnamed Contestant'}</Typography.Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="ID">{contestant.id}</Descriptions.Item>
              <Descriptions.Item label="Track">{contestant.track}</Descriptions.Item>
              <Descriptions.Item label="Grade">{contestant.grade}</Descriptions.Item>
              <Descriptions.Item label="Alignment">{contestant.alignment}</Descriptions.Item>
              {contestant.persona && (
                <Descriptions.Item label="Persona">{contestant.persona}</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        </Space>
      </Card>

      <Card size="small" style={{ marginBottom: '1rem' }} title="Appearance">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Age">{contestant.appearance?.age}</Descriptions.Item>
          <Descriptions.Item label="Height">
            {contestant.appearance?.height || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Build">
            {contestant.appearance?.build || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Hair Style">
            {contestant.appearance?.hairStyle || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Hair Color">
            {contestant.appearance?.hairColor || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Fur Color">
            {contestant.appearance?.furColor || 'Not specified'}
          </Descriptions.Item>
        </Descriptions>
        {contestant.appearance?.other && (
          <div style={{ marginTop: '0.5rem' }}>
            <Typography.Text strong>Other Features: </Typography.Text>
            <Typography.Text>{contestant.appearance.other}</Typography.Text>
          </div>
        )}
      </Card>

      <Card size="small" style={{ marginBottom: '1rem' }} title="Core Skills">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Vocals">{contestant.coreSkills?.vocals || 3}</Descriptions.Item>
          <Descriptions.Item label="Rap">{contestant.coreSkills?.rap || 3}</Descriptions.Item>
          <Descriptions.Item label="Dance">{contestant.coreSkills?.dance || 3}</Descriptions.Item>
          <Descriptions.Item label="Stage Presence">
            {contestant.coreSkills?.stagePresence || 3}
          </Descriptions.Item>
          <Descriptions.Item label="Visual">{contestant.coreSkills?.visual || 3}</Descriptions.Item>
          <Descriptions.Item label="Uniqueness">{contestant.coreSkills?.uniqueness || 3}</Descriptions.Item>
          <Descriptions.Item label="Leadership">{contestant.coreSkills?.leadership || 3}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: '1rem' }} title="Utility Skills">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Potential">{contestant.utilitySkills?.potential || 3}</Descriptions.Item>
          <Descriptions.Item label="Memory">{contestant.utilitySkills?.memory || 3}</Descriptions.Item>
          <Descriptions.Item label="Stamina">{contestant.utilitySkills?.stamina || 3}</Descriptions.Item>
          <Descriptions.Item label="Learning">{contestant.utilitySkills?.learning || 3}</Descriptions.Item>
          <Descriptions.Item label="Acrobatics">
            {contestant.utilitySkills?.acrobatics || 3}
          </Descriptions.Item>
          <Descriptions.Item label="Consistency">
            {contestant.utilitySkills?.consistency || 3}
          </Descriptions.Item>
          <Descriptions.Item label="Charisma">{contestant.utilitySkills?.charisma || 3}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: '1rem' }} title="Personality Traits">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Discipline">{contestant.personality?.discipline || 0}</Descriptions.Item>
          <Descriptions.Item label="Curiosity">{contestant.personality?.curiosity || 0}</Descriptions.Item>
          <Descriptions.Item label="Extroversion">
            {contestant.personality?.extroversion || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Sensitivity">
            {contestant.personality?.sensitivity || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Gentleness">{contestant.personality?.gentleness || 0}</Descriptions.Item>
          <Descriptions.Item label="Sincerity">{contestant.personality?.sincerity || 0}</Descriptions.Item>
          <Descriptions.Item label="Ambition">{contestant.personality?.ambition || 0}</Descriptions.Item>
          <Descriptions.Item label="Resilience">{contestant.personality?.resilience || 0}</Descriptions.Item>
          <Descriptions.Item label="Maturity">{contestant.personality?.maturity || 0}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: '1rem' }} title="Specialties">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Vocal Color">
            {contestant.specialties?.vocalColor || 'Not selected'}
          </Descriptions.Item>
          <Descriptions.Item label="Dance Style">
            {contestant.specialties?.danceStyle || 'Not selected'}
          </Descriptions.Item>
          <Descriptions.Item label="Rap Style">
            {contestant.specialties?.rapStyle || 'Not selected'}
          </Descriptions.Item>
          <Descriptions.Item label="Visual Vibe">
            {contestant.specialties?.visualVibe || 'Not selected'}
          </Descriptions.Item>
          <Descriptions.Item label="Leadership Style">
            {contestant.specialties?.leadershipStyle || 'Not selected'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      <Button.Group>
        <Button onClick={() => setStep((prev) => prev - 1)} size="large">
          Previous
        </Button>
        <Button loading={isSaving} onClick={onSave} size="large" type="primary">
          Save Contestant
        </Button>
      </Button.Group>
    </>
  );
}
