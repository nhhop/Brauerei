import { useEffect, useRef, useState } from 'preact/hooks';
import type { FileEntry } from '../types';
import { listFiles, fileDownloadUrl, deleteFile, renameFile, mkdirFile, uploadFileTo } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { SkeletonBar } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { Breadcrumb } from '../components/Breadcrumb';
import { SpeedDialFab } from '../components/Fab';
import { btnPrimary, btnSecondary, inp } from '../ui';
import { Folder, FileText, Download, Pencil, Trash2, ChevronRight, FolderPlus, Plus, Upload } from 'lucide-preact';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Mirrors the backend's protection rule in WebUI::validFilePath_ — /www and
// /www.new (the running UI's own files and the OTA-asset staging dir) are
// read-only here. This is UX only: the device has no auth, so the real gate
// is the backend 403, not this check.
function isProtected(path: string): boolean {
  return path === '/www' || path.startsWith('/www/') ||
    path === '/www.new' || path.startsWith('/www.new/');
}

function segments(path: string): { label: string; full: string }[] {
  if (path === '/') return [];
  const segs: { label: string; full: string }[] = [];
  let acc = '';
  for (const part of path.split('/').filter(Boolean)) {
    acc += `/${part}`;
    segs.push({ label: part, full: acc });
  }
  return segs;
}

export function FilesPage(_: { path?: string }) {
  const [dir, setDir] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dirLoading, setDirLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  function refresh() {
    return listFiles(dir)
      .then((l) => { setEntries(l.entries); setError(null); })
      .catch((e) => setError(String(e)));
  }

  // Only a directory switch blanks the table: while it is in flight the path
  // bar already names the new folder, so leaving the old folder's rows up
  // would contradict it. The in-place refreshes after delete/rename/upload
  // stay on screen — there the listing is still the right one.
  useEffect(() => {
    setRenameTarget(null);
    setCreatingFolder(false);
    setDirLoading(true);
    refresh().finally(() => setDirLoading(false));
  }, [dir]);

  const fullPath = (name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`);
  const dirProtected = isProtected(dir);
  const protectedTitle = 'Geschützt — UI-Dateien';

  const sorted = [...entries].sort((a, b) =>
    a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name));

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFile(fullPath(deleteTarget.name));
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function submitRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) { setRenameTarget(null); return; }
    try {
      await renameFile(fullPath(renameTarget.name), fullPath(name));
      setRenameTarget(null);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function submitNewFolder() {
    const name = folderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    try {
      await mkdirFile(fullPath(name));
      setCreatingFolder(false);
      setFolderName('');
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  function pickUpload(f: File) {
    setUploadPct(0);
    uploadFileTo(dir, f, setUploadPct)
      .then(() => { setUploadPct(null); refresh(); })
      .catch((e) => { setError(String(e)); setUploadPct(null); });
  }

  return (
    <PageShell>
      <header class="mb-4">
        <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Dateiverwaltung' }]} />
      </header>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <nav class="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => setDir('/')}
            class={dir === '/' ? 'font-medium text-fg' : 'text-muted hover:text-fg'}>
            SD-Karte
          </button>
          {segments(dir).map((s) => (
            <span key={s.full} class="flex items-center gap-1">
              <ChevronRight size={14} class="shrink-0 text-faint" />
              <button type="button" onClick={() => setDir(s.full)}
                class={s.full === dir ? 'font-medium text-fg' : 'text-muted hover:text-fg'}>
                {s.label}
              </button>
            </span>
          ))}
        </nav>
        {dirLoading && <Spinner size={14} class="text-muted" />}
        <div class="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => { setCreatingFolder(true); setFolderName(''); }}
            disabled={dirProtected} title={dirProtected ? protectedTitle : undefined}
            class={`${btnSecondary} hidden items-center md:inline-flex`}>
            <FolderPlus size={14} class="mr-1.5" /> Ordner
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}
            disabled={dirProtected || uploadPct !== null}
            title={dirProtected ? protectedTitle : undefined}
            class={`${btnPrimary} hidden items-center md:inline-flex`}>
            <Upload size={14} class="mr-1.5" /> Hochladen
          </button>
          <input ref={fileInput} type="file" class="hidden"
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              (e.target as HTMLInputElement).value = '';
              if (f) pickUpload(f);
            }} />
        </div>
      </div>
      <SpeedDialFab icon={Plus} actions={[
        {
          icon: FolderPlus, label: 'Ordner', disabled: dirProtected,
          onClick: () => { setCreatingFolder(true); setFolderName(''); },
        },
        {
          icon: Upload, label: 'Hochladen', disabled: dirProtected || uploadPct !== null,
          onClick: () => fileInput.current?.click(),
        },
      ]} />

      {uploadPct !== null && (
        <div class="mb-4 text-xs text-muted">
          Upload… {uploadPct}%
          <div class="mt-1 h-1.5 rounded bg-fg/10">
            <div class="h-1.5 rounded bg-fg" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {error && <div class="mb-4 text-sm text-critical">{error}</div>}

      <div class="overflow-hidden rounded-md border border-card-border bg-card shadow-elev-2">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-card-border text-left text-xs text-muted">
              <th class="px-4 py-2 font-medium">Name</th>
              <th class="px-4 py-2 font-medium">Größe</th>
              <th class="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {dirLoading && [0, 1, 2, 3].map((i) => (
              <tr key={`sk${i}`} class="border-b border-card-border last:border-0">
                <td class="px-4 py-2.5"><SkeletonBar class="w-1/3" /></td>
                <td class="px-4 py-2.5"><SkeletonBar class="w-12" /></td>
                <td class="px-4 py-2.5" />
              </tr>
            ))}
            {creatingFolder && (
              <tr class="border-b border-card-border last:border-0">
                <td class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <Folder size={16} class="shrink-0 text-muted" />
                    <input autoFocus value={folderName}
                      onInput={(e) => setFolderName((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitNewFolder();
                        if (e.key === 'Escape') setCreatingFolder(false);
                      }}
                      class={inp} placeholder="Ordnername" />
                  </div>
                </td>
                <td class="px-4 py-2 text-muted">—</td>
                <td class="px-4 py-2 text-right">
                  <button type="button" onClick={submitNewFolder} class={btnPrimary}>Anlegen</button>
                </td>
              </tr>
            )}
            {!dirLoading && sorted.length === 0 && !creatingFolder && (
              <tr><td colSpan={3} class="px-4 py-6 text-center text-sm text-muted">Leer</td></tr>
            )}
            {!dirLoading && sorted.map((entry) => {
              const full = fullPath(entry.name);
              const rowProtected = isProtected(full);
              const renamingThis = renameTarget?.name === entry.name;
              return (
                <tr key={entry.name} class="border-b border-card-border last:border-0 hover:bg-fg/5">
                  <td class="px-4 py-2">
                    {renamingThis ? (
                      <div class="flex items-center gap-2">
                        {entry.dir
                          ? <Folder size={16} class="shrink-0 text-muted" />
                          : <FileText size={16} class="shrink-0 text-muted" />}
                        <input autoFocus value={renameValue}
                          onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename();
                            if (e.key === 'Escape') setRenameTarget(null);
                          }}
                          class={inp} />
                      </div>
                    ) : entry.dir ? (
                      <button type="button" onClick={() => setDir(full)}
                        class="flex items-center gap-2 text-left text-fg hover:underline">
                        <Folder size={16} class="shrink-0 text-muted" /> {entry.name}
                      </button>
                    ) : (
                      <span class="flex items-center gap-2 text-left">
                        <FileText size={16} class="shrink-0 text-muted" /> {entry.name}
                      </span>
                    )}
                  </td>
                  <td class="px-4 py-2 text-muted">{entry.dir ? '—' : fmtSize(entry.size)}</td>
                  <td class="px-4 py-2">
                    <div class="flex items-center justify-end gap-2">
                      {!entry.dir && (
                        <a href={fileDownloadUrl(full)}
                          class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                          <Download size={14} />
                        </a>
                      )}
                      <button type="button" disabled={rowProtected}
                        title={rowProtected ? protectedTitle : undefined}
                        onClick={() => { setRenameTarget(entry); setRenameValue(entry.name); }}
                        class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-40">
                        <Pencil size={14} />
                      </button>
                      <button type="button" disabled={rowProtected}
                        title={rowProtected ? protectedTitle : undefined}
                        onClick={() => setDeleteTarget(entry)}
                        class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10 disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={!!deleteTarget} title={`${deleteTarget?.dir ? 'Ordner' : 'Datei'} löschen?`} destructive
        confirmLabel="Löschen" cancelLabel="Abbrechen" pending={deleting}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
        <p>
          „{deleteTarget?.name}" wird {deleteTarget?.dir ? 'inklusive Inhalt ' : ''}
          unwiderruflich von der SD-Karte gelöscht.
        </p>
      </ConfirmModal>
    </PageShell>
  );
}
