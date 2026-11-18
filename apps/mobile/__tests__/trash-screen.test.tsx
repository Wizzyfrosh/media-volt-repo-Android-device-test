import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { createRepositories, type Repositories } from '@/db/repositories';
import TrashScreen from '@/app/trash';
import { FileService } from '@/services/file-service';
import { createMemoryFs } from './helpers/memory-fs';
import { createMigratedDb } from './helpers/test-db';

let mockServices: Record<string, unknown>;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('@/services/ServicesProvider', () => ({ useServices: () => mockServices }));

let repos: Repositories;
let svc: FileService;
let fs: ReturnType<typeof createMemoryFs>;

async function setup(names: string[]) {
  let n = 0;
  const db = await createMigratedDb();
  repos = createRepositories(db);
  fs = createMemoryFs();
  svc = new FileService({ repos, fs, newId: () => `id${++n}` });
  mockServices = { db, fs, fileService: svc, files: repos.files, folders: repos.folders };
  const ids: string[] = [];
  for (const name of names) {
    fs.seed(`/t/${name}`, 100);
    ids.push((await svc.importFile({ sourcePath: `/t/${name}`, name })).id);
  }
  await svc.trashFiles(ids);
  return ids;
}

const confirmDestructive = () =>
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation(
      (_t, _m, buttons) => void buttons?.find((b) => b.style === 'destructive')?.onPress?.(),
    );

describe('Trash screen', () => {
  it('says so when the trash is empty', async () => {
    await setup([]);
    await render(<TrashScreen />);
    expect(await screen.findByText('Trash is empty')).toBeTruthy();
  });

  it('restores selected files', async () => {
    const [a] = await setup(['A.mp4', 'B.mp4']);
    await render(<TrashScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^A\.mp4/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore 1' }));
    await waitFor(() => expect(screen.queryByText('A.mp4')).toBeNull());
    expect((await repos.files.getById(a!))!.deletedAt).toBeNull();
    expect(screen.getByText('B.mp4')).toBeTruthy();
  });

  it('deletes selected files forever after a confirmation, including the bytes on disk', async () => {
    const [a] = await setup(['A.mp4']);
    const path = (await repos.files.getById(a!))!.path;
    const alert = confirmDestructive();
    await render(<TrashScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^A\.mp4/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete forever' }));
    await waitFor(async () => expect(await repos.files.getById(a!)).toBeNull());
    expect(fs.files.has(path)).toBe(false);
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('does nothing if the confirmation is cancelled', async () => {
    const [a] = await setup(['A.mp4']);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<TrashScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^A\.mp4/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete forever' }));
    expect(await repos.files.getById(a!)).not.toBeNull();
    alert.mockRestore();
  });

  it('empties the whole trash', async () => {
    await setup(['A.mp4', 'B.mp4']);
    const alert = confirmDestructive();
    await render(<TrashScreen />);
    await screen.findByText('A.mp4');
    await fireEvent.press(screen.getByRole('button', { name: 'Empty' }));
    await waitFor(async () => expect(await repos.files.count(true)).toBe(0));
    expect(await screen.findByText('Trash is empty')).toBeTruthy();
    alert.mockRestore();
  });
});
