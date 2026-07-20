import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { safeStorage } from "electron";
import { CommandError } from "../shared/errors";
import {
  CREDENTIAL_IDS,
  type CredentialId,
  type CredentialProtectionStatus,
} from "../shared/types";

type SecretMap = Partial<Record<CredentialId, string>>;
const NATIVE_STORE_HEADER = Buffer.from("SMC2", "ascii");

export class SecretStore {
  private readonly volatile: SecretMap = {};
  private cached: SecretMap | null = null;
  private lastReadError: string | null = null;

  constructor(
    private readonly filePath: string,
    private readonly nativeExecutable?: string,
  ) {}

  get(provider: CredentialId): string | undefined {
    return this.read()[provider] ?? this.volatile[provider];
  }

  has(provider: CredentialId): boolean {
    return Boolean(this.get(provider));
  }

  configured(): Partial<Record<CredentialId, boolean>> {
    const values = { ...this.read(), ...this.volatile };
    return Object.fromEntries(
      CREDENTIAL_IDS.map((provider) => [provider, Boolean(values[provider])]),
    );
  }

  protectionStatus(): CredentialProtectionStatus {
    if (!this.secureStorageAvailable()) {
      return {
        available: false,
        backend: process.platform === "linux" ? this.storageBackend() : "unavailable",
        requiresReentry: false,
        description:
          "Encrypted operating-system credential storage is unavailable. Keys are never written in plaintext.",
      };
    }
    if (this.lastReadError) {
      return {
        available: true,
        backend: process.platform === "win32" ? "windows-dpapi" : this.storageBackend(),
        requiresReentry: true,
        description:
          "The saved credential file could not be decrypted. Re-enter a provider key to create a new protected store; the old file will be preserved.",
      };
    }
    if (process.platform === "win32") {
      return {
        available: true,
        backend: "windows-dpapi",
        requiresReentry: false,
        description: "Encrypted for your Windows account with Windows Data Protection API.",
      };
    }
    if (process.platform === "darwin") {
      return {
        available: true,
        backend: "macos-keychain",
        requiresReentry: false,
        description: "Encrypted through the macOS Keychain.",
      };
    }
    const backend = this.storageBackend();
    return {
      available: true,
      backend,
      requiresReentry: false,
      description: "Encrypted through the operating-system secret store (" + backend + ").",
    };
  }

  set(provider: CredentialId, key: string): void {
    const trimmed = key.trim();
    if (trimmed.length < 8 || trimmed.length > 1000) {
      throw new CommandError(
        "INVALID_API_KEY",
        "That API key does not look valid.",
        "Paste the complete provider key.",
      );
    }
    if (!this.secureStorageAvailable()) {
      this.volatile[provider] = trimmed;
      throw new CommandError(
        "SECURE_STORAGE_UNAVAILABLE",
        "Your operating system did not make encrypted credential storage available. The key is held only for this session.",
        "Unlock the system keychain and save the key again.",
      );
    }
    const existing = this.read();
    if (this.lastReadError) this.preserveUnreadableStore();
    const next = { ...(this.lastReadError ? {} : existing), [provider]: trimmed };
    this.write(next);
  }

  delete(provider: CredentialId): void {
    delete this.volatile[provider];
    const next = this.read();
    if (this.lastReadError) this.preserveUnreadableStore();
    delete next[provider];
    if (this.secureStorageAvailable()) this.write(next);
  }

  private read(): SecretMap {
    if (this.cached) return { ...this.cached };
    if (!existsSync(this.filePath) || !this.secureStorageAvailable()) return {};
    try {
      const encrypted = readFileSync(this.filePath);
      const nativeFormat = encrypted
        .subarray(0, NATIVE_STORE_HEADER.length)
        .equals(NATIVE_STORE_HEADER);
      const decoded = nativeFormat
        ? this.decryptWithNativeWorker(encrypted.subarray(NATIVE_STORE_HEADER.length))
        : safeStorage.decryptString(encrypted);
      const value = JSON.parse(decoded) as Record<string, unknown>;
      const secrets = Object.fromEntries(
        CREDENTIAL_IDS.flatMap((provider) =>
          typeof value[provider] === "string" ? [[provider, value[provider] as string]] : [],
        ),
      );
      this.cached = secrets;
      this.lastReadError = null;
      if (process.platform === "win32" && this.nativeProtectionAvailable() && !nativeFormat) {
        this.write(secrets);
      }
      return { ...secrets };
    } catch (error) {
      this.lastReadError = error instanceof Error ? error.message : "Credential decryption failed";
      return {};
    }
  }

  private write(value: SecretMap): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const encoded = JSON.stringify(value);
    const encrypted =
      process.platform === "win32" && this.nativeProtectionAvailable()
        ? Buffer.concat([NATIVE_STORE_HEADER, this.encryptWithNativeWorker(encoded)])
        : safeStorage.encryptString(encoded);
    const temporary = this.filePath + ".tmp";
    writeFileSync(temporary, encrypted, { mode: 0o600 });
    renameSync(temporary, this.filePath);
    if (process.platform !== "win32") chmodSync(this.filePath, 0o600);
    this.cached = { ...value };
    this.lastReadError = null;
  }

  private secureStorageAvailable(): boolean {
    if (this.nativeProtectionAvailable()) return true;
    if (!safeStorage.isEncryptionAvailable()) return false;
    return process.platform !== "linux" || this.storageBackend() !== "basic_text";
  }

  private nativeProtectionAvailable(): boolean {
    return (
      process.platform === "win32" &&
      typeof this.nativeExecutable === "string" &&
      existsSync(this.nativeExecutable)
    );
  }

  private encryptWithNativeWorker(plaintext: string): Buffer {
    const result = runNativeCredentialCommand<{ ciphertext: string }>(this.nativeExecutable, {
      command: "protect_secret",
      plaintext,
    });
    return Buffer.from(result.ciphertext, "base64");
  }

  private decryptWithNativeWorker(ciphertext: Buffer): string {
    const result = runNativeCredentialCommand<{ plaintext: string }>(this.nativeExecutable, {
      command: "unprotect_secret",
      ciphertext: ciphertext.toString("base64"),
    });
    return result.plaintext;
  }

  private preserveUnreadableStore(): void {
    if (existsSync(this.filePath)) {
      const backup =
        this.filePath + ".unreadable-" + new Date().toISOString().replace(/[:.]/g, "-");
      renameSync(this.filePath, backup);
    }
    this.cached = {};
    this.lastReadError = null;
  }

  private storageBackend(): string {
    try {
      return safeStorage.getSelectedStorageBackend();
    } catch {
      return "unknown";
    }
  }
}

function runNativeCredentialCommand<T>(
  executable: string | undefined,
  input: Record<string, unknown>,
): T {
  if (!executable) throw new Error("The native credential worker is unavailable");
  const result = spawnSync(executable, [], {
    input: JSON.stringify(input),
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000,
    maxBuffer: 2_000_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "The native credential worker failed");
  }
  const envelope = JSON.parse(result.stdout.trim()) as { ok: boolean; result?: T; error?: string };
  if (!envelope.ok || envelope.result === undefined) {
    throw new Error(envelope.error || "The native credential worker rejected the request");
  }
  return envelope.result;
}
