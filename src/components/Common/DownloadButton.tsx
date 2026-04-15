import { CheckSquareOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Cascader, Dropdown, type DropdownProps, Modal, Spin } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { wait } from 'utils';

type PlainObject = Record<string, any>;

type DownloadButtonProps = {
  /**
   * Data to download, can be an object, a function that returns an object, or a promise that resolves to an object
   */
  data: PlainObject | (() => PlainObject) | Promise<PlainObject> | (() => Promise<PlainObject>);
  /**
   * Name of the downloaded file
   */
  fileName: string;
  /**
   * Whether there is new data available
   */
  hasNewData?: boolean;
  /**
   * External loading state
   */
  loading?: boolean;
  /**
   * Whether the button is block-level
   */
  block?: boolean;
  /**
   * Icon to display in the button
   */
  icon?: React.ReactNode;
} & DropdownProps;

/**
 * Button to download a JSON object as a file
 */
export function DownloadButton({
  data,
  fileName,
  loading: externalLoading,
  children,
  hasNewData,
  block,
  icon,
  ...props
}: DownloadButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = internalLoading || externalLoading;
  const [selectiveMode, setSelectiveMode] = useState(false);

  const handleDownload = async () => {
    try {
      setInternalLoading(true);

      // Handle all possible data types
      let downloadData: PlainObject;

      if (typeof data === 'function') {
        const result = data();
        if (result instanceof Promise) {
          downloadData = await result;
        } else {
          downloadData = result;
        }
      } else if (data instanceof Promise) {
        downloadData = await data;
      } else {
        downloadData = data;
      }
      console.log('Preparing to download data:', downloadData);
      downloadObjectAsFile(downloadData, fileName);
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setInternalLoading(false);
    }
  };

  const items = [
    {
      key: 'selective',
      label: 'Selective Download',
      icon: <CheckSquareOutlined />,
    },
  ];

  const onMenuClick = ({ key }: { key: string }) => {
    if (key === 'selective') {
      // Implement selective download logic here
      setSelectiveMode(true);
    } else {
      console.log('Regular Download clicked');
      // handleDownload();
    }
  };

  return (
    <>
      <Dropdown.Button
        disabled={loading}
        icon={icon}
        loading={loading}
        menu={{ items, onClick: onMenuClick }}
        onClick={handleDownload}
        style={block ? { width: '100%' } : undefined}
        {...props}
      >
        {children ?? 'Download JSON'}
        {hasNewData && <Badge status="warning" />}
      </Dropdown.Button>
      <SelectiveModal
        data={data}
        fileName={fileName}
        onClose={() => setSelectiveMode(false)}
        open={selectiveMode}
      />
    </>
  );
}

type SelectiveModalProps = {
  open: boolean;
  onClose: () => void;
  data: PlainObject | (() => PlainObject) | Promise<PlainObject> | (() => Promise<PlainObject>);
  fileName: string;
};

/**
 * Modal for selective download (to be implemented)
 */
function SelectiveModal({ open, onClose, data, fileName }: SelectiveModalProps) {
  const {
    data: predata,
    isLoading,
    isRefetching,
    isSuccess,
    refetch,
  } = useQuery({
    queryKey: ['selective-download', fileName],
    queryFn: async () => {
      await wait(1500); // Simulate delay
      // Handle all possible data types
      if (typeof data === 'function') {
        const result = data();
        if (result instanceof Promise) {
          return await result;
        }
        return result;
      }
      if (data instanceof Promise) {
        return await data;
      }
      return data;
    },
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isDictionary = useMemo(
    () =>
      typeof predata === 'object' &&
      predata !== null &&
      !Array.isArray(predata) &&
      Object.values(predata).every(
        (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
      ),
    [predata],
  );

  const [selectedOptions, setSelectedOptions] = useState<string[][]>([]);
  const dictionaryOptions = useMemo(() => {
    if (!isDictionary || !predata) return [];

    // Collect all unique keys from all objects in the dictionary
    const allKeys = new Set<string>();
    Object.values(predata).forEach((obj) => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach((key) => {
          allKeys.add(key);
        });
      }
    });

    // Cascader expects single-level items without children for flat lists
    return Array.from(allKeys)
      .sort()
      .map((key) => ({
        label: key,
        value: key,
      }));
  }, [isDictionary, predata]);

  const onDownloadSelectiveData = () => {
    // Parse the predata with only the selected options
    const selectedData = Object.entries(predata).reduce((acc: PlainObject, [dictKey, dictValue]) => {
      const value = dictValue as PlainObject;
      acc[dictKey] = selectedOptions.reduce((objAcc: PlainObject, path) => {
        const key = path[0]; // Since we have a flat structure, take the first element
        if (key in value) {
          objAcc[key] = value[key];
        }
        return objAcc;
      }, {});

      return acc;
    }, {});

    downloadObjectAsFile(selectedData, `${fileName}-selective`);
  };

  return (
    <Modal onCancel={onClose} onOk={onDownloadSelectiveData} open={open} title="Selective Download">
      {isLoading && <Spin />}
      {isSuccess && (
        <>
          {/* Empty data */}
          {isEmpty(predata) && (
            <Alert
              action={
                <Button key="retry" loading={isRefetching} onClick={() => refetch()} size="small">
                  Retry
                </Button>
              }
              message="No data available for selective download."
              showIcon
              type="info"
            />
          )}
          {/* Not dictionary */}
          {!isDictionary && !isEmpty(predata) && (
            <Alert
              message="Data is not in a dictionary format to support selective download."
              showIcon
              type="warning"
            />
          )}
          {/* Dictionary key selections */}
          {isDictionary && !isEmpty(predata) && (
            <>
              <p>Select the fields you want to include in the download:</p>
              <Cascader
                multiple
                onChange={(value) => setSelectedOptions(value)}
                options={dictionaryOptions}
                placeholder="Select fields"
                showCheckedStrategy="SHOW_CHILD"
                style={{ width: '100%' }}
                value={selectedOptions}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/**
 * Converts a object into a downloadable file and prompts download
 * @param obj
 * @param filename
 */
export function downloadObjectAsFile(obj: PlainObject, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const anchorElement = document.createElement('a');
  anchorElement.href = window.URL.createObjectURL(blob);
  anchorElement.download = filename;
  anchorElement.click();
  window.URL.revokeObjectURL(anchorElement.href);
}
