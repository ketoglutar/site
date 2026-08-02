export type StoredVideo = {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
  fileName: string;
  mime: AllowedVideoMime;
  size: number;
};

export const VIDEO_LIMITS = {
  maxCount: 50,
  maxFileBytes: 250 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
} as const;

export const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type AllowedVideoMime = (typeof ALLOWED_VIDEO_MIMES)[number];

export type VideoStoreErrorCode =
  | "empty-file"
  | "invalid-name"
  | "unsupported-type"
  | "file-too-large"
  | "too-many-files"
  | "total-too-large"
  | "storage";

export class VideoStoreError extends Error {
  constructor(
    public readonly code: VideoStoreErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "VideoStoreError";
  }
}

const DATABASE = "matvix-studio";
const STORE = "portfolio-videos";
const VERSION = 2;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_TITLE_LENGTH = 200;

function isAllowedMime(value: string): value is AllowedVideoMime {
  return (ALLOWED_VIDEO_MIMES as readonly string[]).includes(value);
}

function extensionMatchesMime(fileName: string, mime: AllowedVideoMime) {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const allowedExtensions: Record<AllowedVideoMime, readonly string[]> = {
    "video/mp4": [".mp4", ".m4v"],
    "video/webm": [".webm"],
    "video/quicktime": [".mov", ".qt"],
  };
  return allowedExtensions[mime].includes(extension);
}

function validateFileName(fileName: string) {
  return (
    fileName.length > 0 &&
    fileName.length <= MAX_FILE_NAME_LENGTH &&
    !/[/\\\0-\x1f]/.test(fileName)
  );
}

export function validateVideoFile(file: File) {
  if (!file.size) {
    throw new VideoStoreError("empty-file", "The video file is empty.");
  }
  if (!validateFileName(file.name)) {
    throw new VideoStoreError("invalid-name", "The video filename is invalid.");
  }
  if (!isAllowedMime(file.type) || !extensionMatchesMime(file.name, file.type)) {
    throw new VideoStoreError(
      "unsupported-type",
      "Only MP4, WebM and QuickTime videos are supported.",
    );
  }
  if (file.size > VIDEO_LIMITS.maxFileBytes) {
    throw new VideoStoreError(
      "file-too-large",
      "The video exceeds the per-file size limit.",
    );
  }
}

function validateRecord(record: StoredVideo) {
  if (
    !record.id ||
    record.id.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(record.id)
  ) {
    throw new VideoStoreError("storage", "The stored video id is invalid.");
  }
  if (
    !record.name.trim() ||
    record.name.length > MAX_TITLE_LENGTH ||
    /[\0-\x1f]/.test(record.name)
  ) {
    throw new VideoStoreError("invalid-name", "The video title is invalid.");
  }
  if (!(record.blob instanceof Blob) || record.blob.size !== record.size) {
    throw new VideoStoreError("storage", "The stored video data is invalid.");
  }
  if (
    !isAllowedMime(record.mime) ||
    record.blob.type !== record.mime ||
    !extensionMatchesMime(record.fileName, record.mime)
  ) {
    throw new VideoStoreError("unsupported-type", "The video type is invalid.");
  }
  if (!validateFileName(record.fileName)) {
    throw new VideoStoreError("invalid-name", "The video filename is invalid.");
  }
  if (
    !Number.isSafeInteger(record.createdAt) ||
    record.createdAt <= 0 ||
    record.createdAt > Date.now() + 24 * 60 * 60 * 1000
  ) {
    throw new VideoStoreError("storage", "The video timestamp is invalid.");
  }
  if (record.size <= 0) {
    throw new VideoStoreError("empty-file", "The video file is empty.");
  }
  if (record.size > VIDEO_LIMITS.maxFileBytes) {
    throw new VideoStoreError(
      "file-too-large",
      "The video exceeds the per-file size limit.",
    );
  }
}

export function validateVideoCollection(records: StoredVideo[]) {
  if (records.length > VIDEO_LIMITS.maxCount) {
    throw new VideoStoreError(
      "too-many-files",
      "The video count exceeds the storage limit.",
    );
  }

  const ids = new Set<string>();
  let totalBytes = 0;
  for (const record of records) {
    validateRecord(record);
    if (ids.has(record.id)) {
      throw new VideoStoreError("storage", "Duplicate video ids are not allowed.");
    }
    ids.add(record.id);
    totalBytes += record.size;
  }

  if (!Number.isSafeInteger(totalBytes) || totalBytes > VIDEO_LIMITS.maxTotalBytes) {
    throw new VideoStoreError(
      "total-too-large",
      "The videos exceed the total storage limit.",
    );
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new VideoStoreError("storage", "Could not open browser storage.", {
          cause: request.error,
        }),
      );
  });
}

function inferExtension(mime: AllowedVideoMime) {
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  return ".mp4";
}

function normalizeRecord(value: unknown): StoredVideo {
  if (!value || typeof value !== "object") {
    throw new VideoStoreError("storage", "A stored video record is invalid.");
  }

  const raw = value as Partial<StoredVideo>;
  if (!(raw.blob instanceof Blob)) {
    throw new VideoStoreError("storage", "A stored video blob is missing.");
  }

  const file = typeof File !== "undefined" && raw.blob instanceof File ? raw.blob : null;
  const mime = raw.mime ?? raw.blob.type;
  if (!isAllowedMime(mime)) {
    throw new VideoStoreError("unsupported-type", "A stored video type is invalid.");
  }

  const name = typeof raw.name === "string" ? raw.name : "";
  const record: StoredVideo = {
    id: typeof raw.id === "string" ? raw.id : "",
    name,
    blob: raw.blob,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    fileName:
      typeof raw.fileName === "string"
        ? raw.fileName
        : file?.name || `${name}${inferExtension(mime)}`,
    mime,
    size: raw.blob.size,
  };
  validateRecord(record);
  return record;
}

function storageFailure(error: DOMException | null) {
  return new VideoStoreError("storage", "Browser storage operation failed.", {
    cause: error,
  });
}

export async function readVideos(): Promise<StoredVideo[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();

    request.onsuccess = () => {
      try {
        const records = (request.result as unknown[])
          .map(normalizeRecord)
          .sort((first, second) => second.createdAt - first.createdAt);
        validateVideoCollection(records);
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(storageFailure(request.error));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(storageFailure(transaction.error));
    };
  });
}

function recordFromFile(file: File, createdAt: number): StoredVideo {
  validateVideoFile(file);
  const name = file.name.replace(/\.[^/.]+$/, "").trim();
  const record: StoredVideo = {
    id: crypto.randomUUID(),
    name,
    blob: file,
    createdAt,
    fileName: file.name,
    mime: file.type as AllowedVideoMime,
    size: file.size,
  };
  validateRecord(record);
  return record;
}

export async function saveVideos(files: File[]): Promise<StoredVideo[]> {
  if (!files.length) return [];
  if (files.length > VIDEO_LIMITS.maxCount) {
    throw new VideoStoreError(
      "too-many-files",
      "The selected video count exceeds the storage limit.",
    );
  }

  const batchTime = Date.now();
  const records = files.map((file, index) => recordFromFile(file, batchTime + index));
  validateVideoCollection(records);

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const readRequest = store.getAll();
    let validationError: unknown = null;

    readRequest.onsuccess = () => {
      try {
        const existing = (readRequest.result as unknown[]).map(normalizeRecord);
        validateVideoCollection([...records, ...existing]);
        records.forEach((record) => store.put(record));
      } catch (error) {
        validationError = error;
        transaction.abort();
      }
    };

    transaction.oncomplete = () => {
      database.close();
      resolve(records);
    };
    transaction.onabort = () => {
      database.close();
      reject(validationError ?? storageFailure(transaction.error));
    };
    transaction.onerror = () => {
      // onabort reports one normalized, actionable error for the whole batch.
    };
  });
}

export async function saveVideo(file: File): Promise<StoredVideo> {
  const [record] = await saveVideos([file]);
  return record;
}

export async function replaceVideos(records: StoredVideo[]) {
  validateVideoCollection(records);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      store.clear();
      records.forEach((record) => store.put(record));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageFailure(transaction.error));
      transaction.onerror = () => {
        // onabort handles the atomic rollback and normalized error.
      };
    });
  } finally {
    database.close();
  }
}

export async function deleteVideo(id: string) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageFailure(transaction.error));
      transaction.onerror = () => {
        // onabort handles the error.
      };
    });
  } finally {
    database.close();
  }
}

export async function clearVideos() {
  await replaceVideos([]);
}
