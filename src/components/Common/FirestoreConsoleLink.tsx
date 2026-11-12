import { Typography } from 'antd';
import { ArrowUpRightIcon, DatabaseIcon } from 'lucide-react';

type FirestoreConsoleLinkProps = {
  path: string;
  label?: string;
  disabled?: boolean;
} & Omit<React.ComponentProps<typeof Typography.Link>, 'children'>;

export function FirestoreConsoleLink({ path, label, disabled, ...rest }: FirestoreConsoleLinkProps) {
  const { getConsoleUrl } = useFirestoreConsoleUrl();

  return (
    <Typography.Link disabled={disabled} href={getConsoleUrl(path)} target="_blank" {...rest}>
      <DatabaseIcon /> {label ?? 'Console'} <ArrowUpRightIcon />
    </Typography.Link>
  );
}

/**
 * A hook that generates a URL for the Firestore console.
 */
function useFirestoreConsoleUrl() {
  const firestoreUrl = import.meta.env.VITE_FIRESTORE_URL;
  const firestoreProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const firestorePath = import.meta.env.VITE_FIRESTORE_PATH;
  const baseConsoleUrl = `${firestoreUrl}/${firestoreProjectId}/${firestorePath}`;

  function encodeFirestorePath(documentPath: string): string {
    // Split the path by '/'
    // Remove any leading/trailing slashes and then split
    const pathSegments = documentPath.replace(/^\/+|\/+$/g, '').split('/');

    // URL-encode each segment and join with '~2F'
    // Firestore console uses '~2F' as an encoded '/' for the path part
    const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('~2F');

    return encodedPath ? `~2F${encodedPath}` : '';
  }

  return {
    baseConsoleUrl: `${firestoreUrl}/${firestoreProjectId}/${firestorePath}`,
    getConsoleUrl: (path: string) => `${baseConsoleUrl}${encodeFirestorePath(path)}`,
    encodeFirestorePath,
  };
}
