import { firestore } from '@services/firebase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Distribution, FirestoreFormation, Formation, FormationTemplate, Song } from '@types';
import { ASSIGNMENT_CONFLICT_MESSAGE, hasAssignmentConflict } from '@utils/distribution-assignments';
import {
  buildFormationListingSnippet,
  dancerIds,
  deserializeFormation,
  formationErrors,
  readFormationTemplate,
} from '@utils/formation';
import { App } from 'antd';
import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore';

export function useDanceFormationQuery(formationId?: string, legacyDistributionId?: string) {
  const id = formationId || legacyDistributionId;
  return useQuery({
    queryKey: ['formation', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('Missing formation identifier.');
      const snapshot = await getDoc(doc(firestore, 'formations', id));
      if (!snapshot.exists()) {
        if (formationId) throw new Error('The saved formation could not be found.');
        return null;
      }
      return deserializeFormation(snapshot.data(), snapshot.id);
    },
  });
}

export function serializeFormation(formation: Formation): FirestoreFormation {
  return { ...formation, snapshots: JSON.stringify(formation.snapshots) };
}

export async function saveFormation(formation: Formation) {
  const id = formation.id === '$draft' ? formation.distributionId : formation.id;
  const saved = { ...formation, id, updatedAt: Date.now() };
  await runTransaction(firestore, async (transaction) => {
    const distributionRef = doc(firestore, 'distributions', formation.distributionId);
    const formationRef = doc(firestore, 'formations', id);
    const songRef = doc(firestore, 'songs', formation.songId);
    const [distributionDoc, formationDoc, songDoc] = await Promise.all([
      transaction.get(distributionRef),
      transaction.get(formationRef),
      transaction.get(songRef),
    ]);
    if (!distributionDoc.exists() || !songDoc.exists())
      throw new Error('Distribution or song no longer exists.');
    const distribution = distributionDoc.data();
    const song = songDoc.data();
    if (
      distribution.songId !== formation.songId ||
      distribution.groupId !== formation.groupId ||
      (distribution.formationId && distribution.formationId !== id)
    ) {
      throw new Error('The distribution changed. Reload before saving this formation.');
    }
    if (
      formationDoc.exists() &&
      (formation.id === '$draft' || formationDoc.data().distributionId !== formation.distributionId)
    ) {
      throw new Error('A formation already exists. Reload and edit the existing choreography.');
    }
    if (formationDoc.exists() && formationDoc.data().updatedAt !== formation.updatedAt) {
      throw new Error('This formation was edited elsewhere. Reload before saving.');
    }
    if (
      typeof song.startAt !== 'number' ||
      typeof song.endAt !== 'number' ||
      !distribution.assignees ||
      typeof distribution.assignees !== 'object'
    ) {
      throw new Error('Distribution cast or song bounds are invalid.');
    }
    const errors = formationErrors(
      saved,
      { id: songDoc.id, startAt: song.startAt, endAt: song.endAt },
      dancerIds({ assignees: distribution.assignees }),
    );
    if (errors.length) throw new Error(errors.join(' '));
    if (typeof song.content !== 'string' || typeof distribution.mapping !== 'string') {
      throw new Error('Song timings or distribution assignments are invalid.');
    }
    const content: Song['content'] = JSON.parse(song.content);
    const mapping: Distribution['mapping'] = JSON.parse(distribution.mapping);
    if (
      !content ||
      typeof content !== 'object' ||
      Array.isArray(content) ||
      !mapping ||
      typeof mapping !== 'object' ||
      Array.isArray(mapping)
    ) {
      throw new Error('Song timings or distribution assignments are invalid.');
    }
    if (hasAssignmentConflict(mapping)) throw new Error(ASSIGNMENT_CONFLICT_MESSAGE);
    const formationSnippet = buildFormationListingSnippet(
      saved,
      { id: songDoc.id, startAt: song.startAt, endAt: song.endAt, content },
      { assignees: distribution.assignees, mapping },
    );
    transaction.set(formationRef, serializeFormation(saved));
    transaction.update(distributionRef, { formationId: id });
    transaction.set(
      doc(firestore, 'listings', 'distributions'),
      {
        [formation.distributionId]: {
          data: { formationId: id, formationSnippet },
          updatedAt: saved.updatedAt,
        },
      },
      { merge: true },
    );
  });
  return saved;
}

export function useFormationMutation() {
  const { notification } = App.useApp();
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveFormation,
    onSuccess: async (saved) => {
      client.setQueryData(['formation', saved.id], saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['distribution', saved.distributionId] }),
        client.invalidateQueries({ queryKey: ['listings', 'distributions'] }),
      ]);
      notification.success({ title: 'Formation saved' });
    },
    onError: (error) => notification.error({ title: 'Could not save formation', description: error.message }),
  });
}

export function useFormationTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: ['formationTemplates'],
    enabled,
    queryFn: async () => {
      const snapshots = await getDocs(collection(firestore, 'formationTemplates'));
      return snapshots.docs
        .map((snapshot) => readFormationTemplate(snapshot.data(), snapshot.id))
        .sort(
          (a, b) => a.dancerCount - b.dancerCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        );
    },
  });
}

export function useSaveFormationTemplateMutation() {
  const { notification } = App.useApp();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (template: FormationTemplate) => {
      const ref =
        template.id === '$draft'
          ? doc(collection(firestore, 'formationTemplates'))
          : doc(firestore, 'formationTemplates', template.id);
      const saved = readFormationTemplate({ ...template, updatedAt: Date.now() }, ref.id);
      await setDoc(ref, saved);
      return saved;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['formationTemplates'] });
      notification.success({ title: 'Template saved' });
    },
    onError: (error) => notification.error({ title: 'Could not save template', description: error.message }),
  });
}

export function useDeleteFormationTemplateMutation() {
  const { notification } = App.useApp();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDoc(doc(firestore, 'formationTemplates', id)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['formationTemplates'] });
      notification.success({ title: 'Template deleted' });
    },
    onError: (error) =>
      notification.error({ title: 'Could not delete template', description: error.message }),
  });
}
