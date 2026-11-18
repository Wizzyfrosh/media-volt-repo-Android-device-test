import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FileBrowser } from '@/components/library/FileBrowser';
import { createRepositories, type Repositories } from '@/db/repositories';
import { FileService } from '@/services/file-service';
import { useAppStore } from '@/stores/app-store';
import { createMemoryFs } from './helpers/memory-fs';
import { createMigratedDb } from './helpers/test-db';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockServices: Record<string, unknown>;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn() }),
}));
jest.mock('@/services/ServicesProvider', () => ({ useServices: () => mockServices }));

let repos: Repositories;
let svc: FileService;
let n = 0;

async function setup() {
  n = 0;
  const db = await createMigratedDb();
  repos = createRepositories(db);
  const fs = createMemoryFs();
  svc = new FileService({ repos, fs, newId: () => `id${++n}` });
  mockServices = { db, fs, fileService: svc, ...repos, files: repos.files, folders: repos.folders };
  mockPush.mockClear();
  mockNavigate.mockClear();
  useAppStore.setState({ libraryView: 'list', librarySort: 'name', libraryDirection: 'asc' });
  return fs;
}

async function addFile(
  fs: ReturnType<typeof createMemoryFs>,
  name: string,
  folderId: string | null = null,
) {
  fs.seed(`/tmp/${name}-${n}`, 2048);
  return svc.importFile({ sourcePath: `/tmp/${name}-${n}`, name, folderId });
}

const item = (name: RegExp) => screen.getByRole('button', { name });

describe('FileBrowser', () => {
  it('shows an empty library with a way to start', async () => {
    await setup();
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    expect(await screen.findByText('Your library is empty')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Paste a link' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('lists folders first, then files, and opens them', async () => {
    const fs = await setup();
    const folder = await svc.createFolder('Trips');
    await addFile(fs, 'Clip.mp4');
    await addFile(fs, 'Notes.pdf');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);

    expect(await screen.findByText('Clip.mp4')).toBeTruthy();
    expect(screen.getByText('1 folder · 2 files')).toBeTruthy();

    await fireEvent.press(item(/^Trips, Folder/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/folder/[folderId]',
      params: { folderId: folder.id },
    });

    await fireEvent.press(item(/^Clip\.mp4/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/player/[fileId]',
      params: { fileId: expect.any(String) },
    });
    await fireEvent.press(item(/^Notes\.pdf/));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/viewer/[fileId]',
      params: { fileId: expect.any(String) },
    });
  });

  it('filters by category and reports no matches with a way back', async () => {
    const fs = await setup();
    await addFile(fs, 'Clip.mp4');
    await addFile(fs, 'Notes.pdf');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Clip.mp4');

    await fireEvent.press(screen.getByRole('button', { name: 'Documents' }));
    await waitFor(() => expect(screen.queryByText('Clip.mp4')).toBeNull());
    expect(screen.getByText('Notes.pdf')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Audio' }));
    expect(await screen.findByText('No matches')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Clip.mp4')).toBeTruthy();
  });

  it('searches across all folders', async () => {
    const fs = await setup();
    const folder = await svc.createFolder('Deep');
    await addFile(fs, 'Holiday.mp4', folder.id);
    await addFile(fs, 'Other.mp4');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Other.mp4');

    await fireEvent.press(screen.getByRole('button', { name: 'Search files' }));
    await fireEvent.changeText(screen.getByLabelText('Search all files'), 'holiday');
    await waitFor(() => expect(screen.queryByText('Other.mp4')).toBeNull(), { timeout: 2000 });
    expect(screen.getByText('Holiday.mp4')).toBeTruthy();
  });

  it('selects with a long press, deletes to the trash, and can undo', async () => {
    const fs = await setup();
    await addFile(fs, 'A.mp4');
    await addFile(fs, 'B.mp4');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('A.mp4');

    await fireEvent(item(/^A\.mp4/), 'longPress');
    expect(await screen.findByText('1 selected')).toBeTruthy();
    await fireEvent.press(item(/^B\.mp4/)); // taps now toggle
    expect(await screen.findByText('2 selected')).toBeTruthy();
    await fireEvent.press(item(/^B\.mp4/));
    expect(await screen.findByText('1 selected')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Moved 1 file to Trash')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('A.mp4')).toBeNull());
    expect(await repos.files.count(true)).toBe(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('A.mp4')).toBeTruthy();
    expect(await repos.files.count(true)).toBe(0);
  });

  it('marks and unmarks favorites for the selection', async () => {
    const fs = await setup();
    const a = await addFile(fs, 'A.mp4');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('A.mp4');
    await fireEvent(item(/^A\.mp4/), 'longPress');
    await fireEvent.press(screen.getByRole('button', { name: 'Favorite' }));
    await waitFor(async () => expect((await repos.files.getById(a.id))!.isFavorite).toBe(true));
    expect(await screen.findByRole('button', { name: 'Unfavorite' })).toBeTruthy();
  });

  it('renames the selected file through a dialog and refuses an empty name', async () => {
    const fs = await setup();
    await addFile(fs, 'Old.mp4');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Old.mp4');
    await fireEvent(item(/^Old\.mp4/), 'longPress');
    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));

    const input = await screen.findByLabelText('Name');
    await fireEvent.changeText(input, '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a name.')).toBeTruthy();

    await fireEvent.changeText(input, 'New name.mp4');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('New name.mp4')).toBeTruthy();
    expect(screen.queryByText('Old.mp4')).toBeNull();
  });

  it('creates a folder from the header', async () => {
    await setup();
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Your library is empty');
    await fireEvent.press(screen.getByRole('button', { name: 'New folder' }));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Receipts');
    await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Receipts')).toBeTruthy();
    expect(await repos.folders.count()).toBe(1);
  });

  it('moves selected files into a folder, and never offers a folder as its own destination', async () => {
    const fs = await setup();
    const keep = await svc.createFolder('Keep');
    await svc.createFolder('Other');
    await addFile(fs, 'A.mp4');
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('A.mp4');

    await fireEvent(item(/^A\.mp4/), 'longPress');
    await fireEvent.press(screen.getByRole('button', { name: 'Move' }));
    const picker = await screen.findByLabelText('Library, top level');
    expect(picker).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Keep' }));

    await waitFor(() => expect(screen.queryByText('A.mp4')).toBeNull());
    expect((await repos.files.list({ folderId: keep.id })).map((f) => f.name)).toEqual(['A.mp4']);
  });

  it('asks before deleting a folder and sends its files to the trash', async () => {
    const fs = await setup();
    const folder = await svc.createFolder('Gone');
    await addFile(fs, 'Inside.mp4', folder.id);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Gone');
    await fireEvent(item(/^Gone, Folder/), 'longPress');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Gone')).toBeNull());
    expect(alert).toHaveBeenCalled();
    expect(await repos.files.count(true)).toBe(1);
    alert.mockRestore();
  });

  it('shows the contents of a single folder without filters', async () => {
    const fs = await setup();
    const folder = await svc.createFolder('Only');
    await addFile(fs, 'Inside.mp4', folder.id);
    await addFile(fs, 'Outside.mp4');
    await render(<FileBrowser folderId={folder.id} title="Only" />);
    expect(await screen.findByText('Inside.mp4')).toBeTruthy();
    expect(screen.queryByText('Outside.mp4')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Videos' })).toBeNull();
  });

  it('reloads by itself when a download finishes and adds a file', async () => {
    const fs = await setup();
    await render(<FileBrowser folderId={null} title="Library" showFilters />);
    await screen.findByText('Your library is empty');
    await addFile(fs, 'Fresh.mp4');
    expect(await screen.findByText('Fresh.mp4')).toBeTruthy();
    expect(
      within(screen.getByRole('button', { name: /^Fresh\.mp4/ })).getByText(/Video/),
    ).toBeTruthy();
  });
});
