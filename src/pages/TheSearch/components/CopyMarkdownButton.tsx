import { Alert, Button, Space, Typography } from 'antd';
import { CopyIcon } from 'lucide-react';
import { useState } from 'react';

export async function copyMarkdown(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
    throw new Error(
      'Clipboard access is unavailable. Open the show in a secure browser context and try again.',
    );
  await navigator.clipboard.writeText(text);
}

export function CopyMarkdownButton({
  createText,
  label,
  successMessage,
}: {
  createText: () => string;
  label: string;
  successMessage: string;
}) {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Space orientation="vertical">
      <Button
        icon={<CopyIcon />}
        loading={copying}
        onClick={async () => {
          setCopying(true);
          setCopied(false);
          setError(null);
          try {
            await copyMarkdown(createText());
            setCopied(true);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not copy Markdown to clipboard.');
          } finally {
            setCopying(false);
          }
        }}
      >
        {label}
      </Button>
      {copied && <Typography.Text role="status">{successMessage}</Typography.Text>}
      {error && <Alert role="alert" title={error} type="error" />}
    </Space>
  );
}
