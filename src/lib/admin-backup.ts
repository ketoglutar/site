import {
  VIDEO_LIMITS,
  VideoStoreError,
  type AllowedVideoMime,
  type StoredVideo,
  validateVideoCollection,
} from "./video-store";

export type BackupErrorCode =
  | "empty"
  | "too-large"
  | "invalid-format"
  | "unsupported-version"
  | "corrupted";

export class BackupError extends Error {
  constructor(
    public readonly code: BackupErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BackupError";
  }
}

type ManifestVideo = {
  id: string;
  name: string;
  fileName: string;
  mime: AllowedVideoMime;
  size: number;
  offset: number;
  createdAt: number;
  sha256: string;
};

type BackupManifest = {
  format: "matvix-portfolio-backup";
  schemaVersion: 1;
  exportedAt: string;
  videos: ManifestVideo[];
};

const FORMAT = "matvix-portfolio-backup";
const SCHEMA_VERSION = 1;
const HEADER_BYTES = 12;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_BACKUP_BYTES =
  HEADER_BYTES + MAX_MANIFEST_BYTES + VIDEO_LIMITS.maxTotalBytes;
const MAGIC = new Uint8Array([0x4d, 0x56, 0x58, 0x42, 0x41, 0x4b, 0x30, 0x31]);
const textEncoder = new TextEncoder();

function bytesEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function makeHeader(manifestLength: number) {
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(MAGIC.length, manifestLength, true);
  return header;
}

function invalidFormat(message: string, cause?: unknown): never {
  throw new BackupError("invalid-format", message, { cause });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseManifest(value: unknown): BackupManifest {
  if (!isPlainObject(value)) {
    return invalidFormat("The backup manifest must be an object.");
  }
  if (value.format !== FORMAT) {
    return invalidFormat("This is not a Matvix portfolio backup.");
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new BackupError(
      "unsupported-version",
      "This backup version is not supported.",
    );
  }
  if (
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt))
  ) {
    return invalidFormat("The backup export date is invalid.");
  }
  if (!Array.isArray(value.videos)) {
    return invalidFormat("The backup video list is invalid.");
  }

  const videos = value.videos.map((entry, index): ManifestVideo => {
    if (!isPlainObject(entry)) {
      return invalidFormat(`Video entry ${index + 1} is invalid.`);
    }

    const manifestVideo = {
      id: entry.id,
      name: entry.name,
      fileName: entry.fileName,
      mime: entry.mime,
      size: entry.size,
      offset: entry.offset,
      createdAt: entry.createdAt,
      sha256: entry.sha256,
    };

    if (
      typeof manifestVideo.id !== "string" ||
      typeof manifestVideo.name !== "string" ||
      typeof manifestVideo.fileName !== "string" ||
      typeof manifestVideo.mime !== "string" ||
      !Number.isSafeInteger(manifestVideo.size) ||
      !Number.isSafeInteger(manifestVideo.offset) ||
      !Number.isSafeInteger(manifestVideo.createdAt) ||
      typeof manifestVideo.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(manifestVideo.sha256)
    ) {
      return invalidFormat(`Video entry ${index + 1} has invalid metadata.`);
    }

    return manifestVideo as ManifestVideo;
  });

  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    videos,
  };
}

export async function createVideoBackup(records: StoredVideo[]) {
  if (!records.length) {
    throw new BackupError("empty", "There are no local videos to export.");
  }
  validateVideoCollection(records);

  let offset = 0;
  const videos: ManifestVideo[] = [];
  for (const record of records) {
    videos.push({
      id: record.id,
      name: record.name,
      fileName: record.fileName,
      mime: record.mime,
      size: record.size,
      offset,
      createdAt: record.createdAt,
      sha256: await sha256(record.blob),
    });
    offset += record.size;
  }

  const manifest: BackupManifest = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    videos,
  };
  const manifestBytes = textEncoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new BackupError("too-large", "The backup manifest is too large.");
  }

  const backup = new Blob(
    [makeHeader(manifestBytes.byteLength), manifestBytes, ...records.map(({ blob }) => blob)],
    { type: "application/x-matvix-backup" },
  );
  if (backup.size > MAX_BACKUP_BYTES) {
    throw new BackupError("too-large", "The backup is too large.");
  }
  return backup;
}

export async function readVideoBackup(file: File): Promise<StoredVideo[]> {
  if (!file.name.toLowerCase().endsWith(".matvix-backup")) {
    throw new BackupError(
      "invalid-format",
      "Select a file with the .matvix-backup extension.",
    );
  }
  if (file.size < HEADER_BYTES + 2) {
    throw new BackupError("invalid-format", "The backup file is incomplete.");
  }
  if (file.size > MAX_BACKUP_BYTES) {
    throw new BackupError("too-large", "The backup file is too large.");
  }

  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!bytesEqual(header.slice(0, MAGIC.length), MAGIC)) {
    throw new BackupError("invalid-format", "The backup signature is invalid.");
  }

  const manifestLength = new DataView(
    header.buffer,
    header.byteOffset,
    header.byteLength,
  ).getUint32(MAGIC.length, true);
  if (
    manifestLength < 2 ||
    manifestLength > MAX_MANIFEST_BYTES ||
    HEADER_BYTES + manifestLength > file.size
  ) {
    throw new BackupError("invalid-format", "The manifest length is invalid.");
  }

  let manifest: BackupManifest;
  try {
    const manifestText = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.slice(HEADER_BYTES, HEADER_BYTES + manifestLength).arrayBuffer(),
    );
    manifest = parseManifest(JSON.parse(manifestText));
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("invalid-format", "The manifest cannot be read.", {
      cause: error,
    });
  }

  if (manifest.videos.length > VIDEO_LIMITS.maxCount) {
    throw new BackupError("too-large", "The backup contains too many videos.");
  }

  const payloadStart = HEADER_BYTES + manifestLength;
  const payloadBytes = file.size - payloadStart;
  let expectedOffset = 0;
  for (const entry of manifest.videos) {
    if (
      entry.offset !== expectedOffset ||
      entry.size <= 0 ||
      entry.size > VIDEO_LIMITS.maxFileBytes
    ) {
      throw new BackupError(
        "invalid-format",
        "The backup video offsets or sizes are invalid.",
      );
    }
    expectedOffset += entry.size;
    if (!Number.isSafeInteger(expectedOffset) || expectedOffset > payloadBytes) {
      throw new BackupError("invalid-format", "The backup payload is invalid.");
    }
  }
  if (expectedOffset !== payloadBytes) {
    throw new BackupError(
      "invalid-format",
      "The backup contains unexpected or missing binary data.",
    );
  }

  const records: StoredVideo[] = [];
  for (const entry of manifest.videos) {
    const start = payloadStart + entry.offset;
    const blob = file.slice(start, start + entry.size, entry.mime);
    if ((await sha256(blob)) !== entry.sha256) {
      throw new BackupError(
        "corrupted",
        `The video "${entry.fileName}" failed its integrity check.`,
      );
    }
    records.push({
      id: entry.id,
      name: entry.name,
      fileName: entry.fileName,
      mime: entry.mime,
      size: entry.size,
      createdAt: entry.createdAt,
      blob,
    });
  }

  try {
    validateVideoCollection(records);
  } catch (error) {
    if (error instanceof VideoStoreError) {
      throw new BackupError("invalid-format", "The backup metadata is invalid.", {
        cause: error,
      });
    }
    throw error;
  }
  return records;
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `matvix-backup-${stamp}.matvix-backup`;
}
