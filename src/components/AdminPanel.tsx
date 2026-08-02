import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SiteCopy } from "@/lib/copy";
import {
  BackupError,
  backupFileName,
  createVideoBackup,
  readVideoBackup,
} from "@/lib/admin-backup";
import {
  clearVideos,
  deleteVideo,
  replaceVideos,
  saveVideos,
  VideoStoreError,
  type StoredVideo,
} from "@/lib/video-store";
import { StarMark } from "./StarMark";

type AdminPanelProps = {
  copy: SiteCopy["admin"];
  isOpen: boolean;
  onClose: () => void;
  records: StoredVideo[];
  videoUrls: Record<string, string>;
  setRecords: Dispatch<SetStateAction<StoredVideo[]>>;
  onReplayIntro: () => void;
};

type BusyAction = "upload" | "export" | "import" | "delete" | "clear" | null;
type Status = { kind: "success" | "error"; text: string } | null;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "a[href]",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function localizedError(error: unknown, copy: SiteCopy["admin"]) {
  if (error instanceof VideoStoreError) {
    if (error.code === "unsupported-type") return copy.errorUnsupportedVideo;
    if (error.code === "file-too-large") return copy.errorVideoTooLarge;
    if (error.code === "too-many-files") return copy.errorTooManyVideos;
    if (error.code === "total-too-large") return copy.errorTotalTooLarge;
    if (error.code === "empty-file" || error.code === "invalid-name") {
      return copy.errorInvalidVideo;
    }
    return copy.errorStorage;
  }
  if (error instanceof BackupError) {
    if (error.code === "empty") return copy.errorNothingToExport;
    if (error.code === "too-large") return copy.errorBackupTooLarge;
    if (error.code === "unsupported-version") return copy.errorBackupVersion;
    if (error.code === "corrupted") return copy.errorBackupCorrupted;
    return copy.errorInvalidBackup;
  }
  return copy.errorGeneric;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminPanel({
  copy,
  isOpen,
  onClose,
  records,
  videoUrls,
  setRecords,
  onReplayIntro,
}: AdminPanelProps) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeButton.current?.focus());

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !drawer.current) return;

      const focusable = Array.from(
        drawer.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        drawer.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", keydown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keydown);
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [isOpen]);

  const run = async (
    action: Exclude<BusyAction, null>,
    task: () => Promise<void>,
  ) => {
    setBusy(action);
    setStatus(null);
    try {
      await task();
    } catch (error) {
      setStatus({ kind: "error", text: localizedError(error, copy) });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    await run("upload", async () => {
      await navigator.storage?.persist?.().catch(() => false);
      const next = await saveVideos(files);
      setRecords((current) =>
        [...next, ...current].sort(
          (first, second) => second.createdAt - first.createdAt,
        ),
      );
      setStatus({ kind: "success", text: copy.uploadSuccess });
    });
  };

  const exportBackup = async () => {
    await run("export", async () => {
      const backup = await createVideoBackup(records);
      downloadBlob(backup, backupFileName());
      setStatus({ kind: "success", text: copy.exportSuccess });
    });
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !window.confirm(copy.confirmImport)) return;

    await run("import", async () => {
      const imported = await readVideoBackup(file);
      await replaceVideos(imported);
      setRecords(
        [...imported].sort((first, second) => second.createdAt - first.createdAt),
      );
      setStatus({ kind: "success", text: copy.importSuccess });
    });
  };

  const remove = async (record: StoredVideo) => {
    const question = copy.confirmRemove.replace("{name}", record.name);
    if (!window.confirm(question)) return;

    await run("delete", async () => {
      await deleteVideo(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setStatus({ kind: "success", text: copy.removeSuccess });
    });
  };

  const clear = async () => {
    if (!window.confirm(copy.confirmClear)) return;

    await run("clear", async () => {
      await clearVideos();
      setRecords([]);
      setStatus({ kind: "success", text: copy.clearSuccess });
    });
  };

  const isBusy = busy !== null;

  return (
    <aside
      aria-hidden={!isOpen}
      className={`admin-panel${isOpen ? " admin-panel--open" : ""}`}
      inert={!isOpen}
    >
      <button
        aria-label={copy.close}
        className="admin-panel__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-busy={isBusy}
        aria-labelledby="admin-panel-title"
        aria-modal="true"
        className="admin-panel__drawer"
        ref={drawer}
        role="dialog"
        tabIndex={-1}
      >
        <div className="admin-panel__head">
          <div>
            <span className="section-label">
              <StarMark />
              {copy.eyebrow}
            </span>
            <h2 id="admin-panel-title">{copy.title}</h2>
          </div>
          <button
            aria-label={copy.close}
            className="round-button"
            onClick={onClose}
            ref={closeButton}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="admin-panel__note">{copy.note}</p>

        <section
          aria-labelledby="admin-upload-title"
          className="admin-panel__action-section"
        >
          <h3 id="admin-upload-title">{copy.libraryTitle}</h3>
          <input
            accept="video/mp4,video/webm,video/quicktime"
            hidden
            multiple
            onChange={upload}
            ref={uploadInput}
            type="file"
          />
          <button
            className="primary-button"
            disabled={isBusy}
            onClick={() => uploadInput.current?.click()}
            type="button"
          >
            <span>{busy === "upload" ? copy.uploading : copy.upload}</span>
            <span aria-hidden="true">＋</span>
          </button>
        </section>

        <section
          aria-labelledby="admin-transfer-title"
          className="admin-panel__action-section admin-panel__transfer"
        >
          <div>
            <h3 id="admin-transfer-title">{copy.transferTitle}</h3>
            <p>{copy.transferNote}</p>
          </div>
          <input
            accept=".matvix-backup,application/x-matvix-backup,application/octet-stream"
            hidden
            onChange={importBackup}
            ref={importInput}
            type="file"
          />
          <div className="admin-panel__transfer-actions">
            <button
              disabled={isBusy || !records.length}
              onClick={exportBackup}
              type="button"
            >
              {busy === "export" ? copy.exporting : copy.exportBackup}
            </button>
            <button
              disabled={isBusy}
              onClick={() => importInput.current?.click()}
              type="button"
            >
              {busy === "import" ? copy.importing : copy.importBackup}
            </button>
          </div>
        </section>

        {status ? (
          <p
            aria-live="polite"
            className={`admin-panel__status admin-panel__status--${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.text}
          </p>
        ) : null}

        <button
          className="text-button admin-panel__replay"
          disabled={isBusy}
          onClick={onReplayIntro}
          type="button"
        >
          {copy.replay}
        </button>

        <div className="admin-panel__list">
          {records.length ? (
            records.map((record) => (
              <article className="admin-video" key={record.id}>
                <video
                  aria-hidden="true"
                  muted
                  playsInline
                  preload="metadata"
                  src={videoUrls[record.id]}
                />
                <div>
                  <strong>{record.name}</strong>
                  <span>{copy.stored}</span>
                </div>
                <button
                  disabled={isBusy}
                  onClick={() => remove(record)}
                  type="button"
                >
                  {copy.remove}
                </button>
              </article>
            ))
          ) : (
            <div className="admin-panel__empty">
              <span>00</span>
              <p>{copy.empty}</p>
            </div>
          )}
        </div>

        {records.length ? (
          <button
            className="admin-panel__clear"
            disabled={isBusy}
            onClick={clear}
            type="button"
          >
            {copy.clear}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
