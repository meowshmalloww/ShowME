import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { safeStorage } from "electron";
import { CommandError } from "../shared/errors";
import { type CredentialProtectionStatus, PROVIDER_IDS, type ProviderId } from "../shared/types";

type SecretMap = Partial<Record<ProviderId, string>>;

export class SecretStore {
  private readonly volatile: SecretMap = {};

  constructor(private readonly filePath: string) {}

  get(provider: ProviderId): string | undefined {
    return this.read()[provider] ?? this.volatile[provider];
  }

  has(provider: ProviderId): boolean {
    return Boolean(this.get(provider));
  }

  configured(): Partial<Record<ProviderId, boolean>> {
    const values = { ...this.read(), ...this.volatile };
    return Object.fromEntries(
      PROVIDER_IDS.map((provider) => [provider, Boolean(values[provider])]),
    );
  }

  protectionStatus(): CredentialProtectionStatus {
    if (!this.secureStorageAvailable()) {
      return {
        available: false,
        backend: process.platform === "linux" ? this.storageBackend() : "unavailable",
        description:
          "Encrypted operating-system credential storage is unavailable. Keys are never written in plaintext.",
      };
    }
    if (process.platform === "win32") {
      return {
        available: true,
        backend: "windows-dpapi",
        description: "Encrypted for your Windows account with Windows Data Protection API.",
      };
    }
    if (process.platform === "darwin") {
      return {
        available: true,
        backend: "macos-keychain",
        description: "Encrypted through the macOS Keychain.",
      };
    }
    const backend = this.storageBackend();
    return {
      available: true,
      backend,
      description: "Encrypted through the operating-system secret store (" + backend + ").",
    };
  }

  set(provider: ProviderId, key: string): void {
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
    const next = { ...this.read(), [provider]: trimmed };
    this.write(next);
  }

  delete(provider: ProviderId): void {
    delete this.volatile[provider];
    const next = this.read();
    delete next[provider];
    if (this.secureStorageAvailable()) this.write(next);
  }

  private read(): SecretMap {
    if (!existsSync(this.filePath) || !this.secureStorageAvailable()) return {};
    try {
      const encrypted = readFileSync(this.filePath);
      const decoded = safeStorage.decryptString(encrypted);
      const value = JSON.parse(decoded) as Record<string, unknown>;
      return Object.fromEntries(
        PROVIDER_IDS.flatMap((provider) =>
          typeof value[provider] === "string" ? [[provider, value[provider] as string]] : [],
        ),
      );
    } catch {
      return {};
    }
  }

  private write(value: SecretMap): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const encrypted = safeStorage.encryptString(JSON.stringify(value));
    const temporary = this.filePath + ".tmp";
    writeFileSync(temporary, encrypted, { mode: 0o600 });
    renameSync(temporary, this.filePath);
    if (process.platform !== "win32") chmodSync(this.filePath, 0o600);
  }

  private secureStorageAvailable(): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    return process.platform !== "linux" || this.storageBackend() !== "basic_text";
  }

  private storageBackend(): string {
    try {
      return safeStorage.getSelectedStorageBackend();
    } catch {
      return "unknown";
    }
  }
}
