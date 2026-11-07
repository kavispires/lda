import { Modal } from 'antd';
import { useCallback } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

export function UnsavedChanges({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty],
    ),
  );
  return (
    <Modal
      cancelText="Keep editing"
      okButtonProps={{ danger: true }}
      okText="Discard changes"
      onCancel={() => blocker.reset?.()}
      onOk={() => blocker.proceed?.()}
      open={blocker.state === 'blocked'}
      title="Discard unsaved changes?"
    >
      Your unsaved formation edits will be lost.
    </Modal>
  );
}
