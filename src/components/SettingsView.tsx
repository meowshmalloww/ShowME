import {
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import { TEACHING_STYLE_LABELS, VOICES } from "../lib/defaults";
import { commandErrorMessage } from "../lib/errors";
import type { AppBootstrap, AppSettings, ProviderId } from "../lib/types";
import { Spinner, Toggle } from "./Chrome";

type SettingsTab = "providers" | "teaching" | "privacy" | "accessibility";

export function SettingsView({
  bootstrap,
  onSaved,
}: {
  bootstrap: AppBootstrap;
  onSaved: (bootstrap: AppBootstrap) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("providers");
  const [draft, setDraft] = useState<AppSettings>(bootstrap.settings);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(bootstrap.settings.provider);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const provider =
    bootstrap.providers.find((item) => item.id === selectedProvider) ?? bootstrap.providers[0];

  useEffect(() => setDraft(bootstrap.settings), [bootstrap.settings]);

  const refresh = async (fallback: AppBootstrap = bootstrap) => {
    if (isTauriRuntime()) onSaved(await desktop.bootstrap());
    else onSaved(fallback);
  };

  const saveSettings = async () => {
    setBusy("settings");
    setError(undefined);
    setNotice(undefined);
    try {
      const next = { ...draft, provider: selectedProvider };
      const saved = isTauriRuntime()
        ? await desktop.saveSettings(next)
        : { ...bootstrap, settings: next };
      onSaved(saved);
      setNotice("Settings saved.");
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy("key");
    setError(undefined);
    setNotice(undefined);
    try {
      if (isTauriRuntime()) {
        await desktop.setProviderKey(selectedProvider, key.trim());
        await desktop.saveSettings({ ...draft, provider: selectedProvider });
      }
      setKey("");
      await refresh();
      setNotice(`${provider?.name ?? "Provider"} key stored in the OS credential vault.`);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const deleteKey = async () => {
    setBusy("key-delete");
    setError(undefined);
    try {
      if (isTauriRuntime()) await desktop.deleteProviderKey(selectedProvider);
      await refresh();
      setNotice("Credential removed from the OS vault.");
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const testProvider = async () => {
    if (!provider) return;
    setBusy("test");
    setError(undefined);
    setNotice(undefined);
    try {
      const model = draft.models[selectedProvider];
      const result = isTauriRuntime()
        ? await desktop.testProvider(selectedProvider, model)
        : "Desktop connection checks run in the installed app.";
      setNotice(result);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const exportMemory = async () => {
    setBusy("export");
    setError(undefined);
    try {
      const data = isTauriRuntime()
        ? await desktop.exportMemory()
        : JSON.stringify({ exportedAt: new Date().toISOString(), lessons: [] }, null, 2);
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `showme-memory-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(
        "A privacy-safe JSON export was created. Screenshots are never part of lesson memory.",
      );
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const deleteMemory = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy("delete-memory");
    setError(undefined);
    try {
      if (isTauriRuntime()) await desktop.deleteAllMemory();
      setConfirmDelete(false);
      await refresh();
      setNotice("All local lesson memory was deleted.");
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(undefined);
    }
  };

  const capabilityOverride = (keyName: "vision" | "structuredOutput", value: boolean) => {
    setDraft((current) => ({
      ...current,
      providerCapabilityOverrides: {
        ...current.providerCapabilityOverrides,
        [selectedProvider]: {
          ...current.providerCapabilityOverrides[selectedProvider],
          [keyName]: value,
        },
      },
    }));
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "providers", label: "Providers", icon: <KeyRound size={17} /> },
    { id: "teaching", label: "Teaching", icon: <SlidersHorizontal size={17} /> },
    { id: "privacy", label: "Privacy & memory", icon: <Shield size={17} /> },
    { id: "accessibility", label: "Voice & accessibility", icon: <Volume2 size={17} /> },
  ];

  return (
    <div className="settings-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
          <p>Control providers, teaching behavior, local memory, and accessibility.</p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={saveSettings}
          disabled={Boolean(busy)}
        >
          {busy === "settings" ? (
            <Spinner label="Saving" />
          ) : (
            <>
              <Save size={17} /> Save changes
            </>
          )}
        </button>
      </header>
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={tab === item.id ? "active" : ""}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "providers" && provider && (
            <>
              <section className="settings-section">
                <div className="settings-section-title">
                  <div>
                    <h2>API connections</h2>
                    <p>Credentials stay in the operating system’s secure credential store.</p>
                  </div>
                  <span className="secure-label">
                    <LockKeyhole size={15} /> OS vault
                  </span>
                </div>
                <div className="provider-service-note">
                  <strong>Everything that can require an API key is here.</strong>
                  <span>
                    OpenAI powers GPT-5.6 vision, lesson planning, web research, microphone
                    transcription, and cloud narration. NVIDIA NIM, Groq, Cerebras, and OpenRouter
                    each use their own key for lesson generation. Wikimedia image search and system
                    speech need no key.
                  </span>
                </div>
                <div className="settings-provider-list">
                  {bootstrap.providers.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={selectedProvider === item.id ? "active" : ""}
                      onClick={() => setSelectedProvider(item.id)}
                    >
                      <span className="provider-monogram">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.model}</small>
                      </div>
                      <span className={`connection-state ${item.configured ? "ready" : ""}`}>
                        {item.configured ? "Connected" : "No key"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-section provider-detail">
                <div className="settings-section-title">
                  <div>
                    <h2>{provider.name}</h2>
                    <p>{provider.capabilityNote}</p>
                  </div>
                  {provider.configured && (
                    <span className="configured-badge">
                      <CheckCircle2 size={15} /> Configured
                    </span>
                  )}
                </div>
                <label className="settings-field">
                  <span>Model ID</span>
                  <input
                    value={draft.models[selectedProvider]}
                    maxLength={200}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        models: { ...current.models, [selectedProvider]: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>{provider.configured ? "Replace API key" : "API key"}</span>
                  <div className="inline-key-field">
                    <input
                      type={showKey ? "text" : "password"}
                      value={key}
                      autoComplete="off"
                      onChange={(event) => setKey(event.target.value)}
                      placeholder={
                        provider.configured ? "Enter a replacement key" : "Paste provider key"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((value) => !value)}
                      aria-label={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                    <button
                      type="button"
                      className="small-primary"
                      onClick={saveKey}
                      disabled={!key.trim() || Boolean(busy)}
                    >
                      {busy === "key" ? <Spinner label="Store" /> : "Store securely"}
                    </button>
                  </div>
                </label>
                <div className="provider-actions">
                  <button
                    type="button"
                    onClick={testProvider}
                    disabled={!provider.configured || Boolean(busy)}
                  >
                    {busy === "test" ? (
                      <Spinner label="Testing" />
                    ) : (
                      <>
                        <RefreshCw size={15} /> Test connection
                      </>
                    )}
                  </button>
                  {provider.configured && (
                    <button
                      type="button"
                      className="danger-link"
                      onClick={deleteKey}
                      disabled={Boolean(busy)}
                    >
                      <Trash2 size={15} /> Remove key
                    </button>
                  )}
                </div>
                <details className="provider-advanced">
                  <summary>Advanced model capabilities</summary>
                  <p>
                    Change these only for a custom model whose documented capabilities differ from
                    the provider default. Unsupported features fail closed.
                  </p>
                  <div className="capability-grid">
                    <Toggle
                      checked={
                        draft.providerCapabilityOverrides[selectedProvider]?.vision ??
                        provider.capabilities.vision
                      }
                      onChange={(value) => capabilityOverride("vision", value)}
                      label="Vision input"
                    />
                    <Toggle
                      checked={
                        draft.providerCapabilityOverrides[selectedProvider]?.structuredOutput ??
                        provider.capabilities.structuredOutput
                      }
                      onChange={(value) => capabilityOverride("structuredOutput", value)}
                      label="Structured output"
                    />
                    <Toggle
                      checked={provider.capabilities.webSearch}
                      onChange={() => undefined}
                      label="Grounded web research"
                      disabled
                    />
                    <Toggle
                      checked={provider.capabilities.textToSpeech}
                      onChange={() => undefined}
                      label="Cloud narration route"
                      disabled
                    />
                  </div>
                </details>
              </section>
            </>
          )}

          {tab === "teaching" && (
            <section className="settings-section form-section">
              <div className="settings-section-title">
                <div>
                  <h2>Teaching behavior</h2>
                  <p>Defaults can still be changed per lesson.</p>
                </div>
              </div>
              <div className="settings-two-column">
                <label className="settings-field">
                  <span>Teaching style</span>
                  <select
                    value={draft.teachingStyle}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        teachingStyle: event.target.value as AppSettings["teachingStyle"],
                      }))
                    }
                  >
                    {Object.entries(TEACHING_STYLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Pet name</span>
                  <input
                    value={draft.petName}
                    maxLength={32}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, petName: event.target.value }))
                    }
                  />
                </label>
                <label className="settings-field pet-size-field">
                  <span>Pet size: {Math.round(draft.petScale * 100)}%</span>
                  <input
                    type="range"
                    min="0.8"
                    max="1.45"
                    step="0.05"
                    value={draft.petScale}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        petScale: Number(event.target.value),
                      }))
                    }
                  />
                  <small>The floating pet resizes as soon as you save.</small>
                </label>
                <label className="settings-field">
                  <span>Global hotkey</span>
                  <input
                    value={draft.hotkey}
                    maxLength={80}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, hotkey: event.target.value }))
                    }
                  />
                  <small>Example: CommandOrControl+Shift+Space</small>
                </label>
                <label className="settings-field">
                  <span>Language</span>
                  <input
                    value={draft.language}
                    maxLength={32}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, language: event.target.value }))
                    }
                  />
                  <small>Language code or name, such as en, Spanish, or fr-CA.</small>
                </label>
              </div>
              <div className="preference-toggles">
                <Toggle
                  checked={draft.webResearchDefault}
                  onChange={(webResearchDefault) =>
                    setDraft((current) => ({ ...current, webResearchDefault }))
                  }
                  label="Web research by default"
                  description="Only runs on a provider with ShowME’s grounded research route"
                />
                <Toggle
                  checked={draft.imageAidsDefault}
                  onChange={(imageAidsDefault) =>
                    setDraft((current) => ({ ...current, imageAidsDefault }))
                  }
                  label="Offer Wikimedia image aids"
                  description="License and author are always shown"
                />
                <Toggle
                  checked={draft.nearbyContextDefault}
                  onChange={(nearbyContextDefault) =>
                    setDraft((current) => ({ ...current, nearbyContextDefault }))
                  }
                  label="Include nearby context by default"
                  description="Adds the invocation monitor to provider input"
                />
                <Toggle
                  checked={draft.activeWindowDefault}
                  onChange={(activeWindowDefault) =>
                    setDraft((current) => ({ ...current, activeWindowDefault }))
                  }
                  label="Include active window by default"
                  description="Adds the frontmost non-ShowME window"
                />
              </div>
            </section>
          )}

          {tab === "privacy" && (
            <>
              <section className="settings-section form-section">
                <div className="settings-section-title">
                  <div>
                    <h2>Capture boundary</h2>
                    <p>
                      ShowME has no background capture loop. Every capture begins with a click or
                      hotkey.
                    </p>
                  </div>
                  <span className="secure-label">
                    <Shield size={15} /> Invocation only
                  </span>
                </div>
                <div className="privacy-facts">
                  <div>
                    <Check size={16} />
                    <span>
                      <strong>Screenshots remain in volatile memory</strong>
                      <small>
                        They are cleared at the end of the lesson and never written to SQLite.
                      </small>
                    </span>
                  </div>
                  <div>
                    <Check size={16} />
                    <span>
                      <strong>Provider keys remain in the OS vault</strong>
                      <small>They are never returned to the interface after being stored.</small>
                    </span>
                  </div>
                  <div>
                    <Check size={16} />
                    <span>
                      <strong>Local memory is inspectable</strong>
                      <small>
                        Only lesson plans, questions, receipts, and feedback are retained.
                      </small>
                    </span>
                  </div>
                </div>
                <Toggle
                  checked={draft.memoryEnabled}
                  onChange={(memoryEnabled) =>
                    setDraft((current) => ({ ...current, memoryEnabled }))
                  }
                  label="Save local lesson memory"
                  description="Disable to keep future lesson plans out of SQLite"
                />
              </section>
              <section className="settings-section memory-actions">
                <div className="settings-section-title">
                  <div>
                    <h2>Inspect or erase memory</h2>
                    <p>
                      {bootstrap.recentLessons.length} recent lesson
                      {bootstrap.recentLessons.length === 1 ? "" : "s"} currently visible.
                    </p>
                  </div>
                  <Database size={22} />
                </div>
                <div>
                  <button type="button" onClick={exportMemory} disabled={Boolean(busy)}>
                    {busy === "export" ? (
                      <Spinner label="Exporting" />
                    ) : (
                      <>
                        <Download size={16} /> Export JSON
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={confirmDelete ? "confirm-danger" : "danger-link"}
                    onClick={deleteMemory}
                    disabled={Boolean(busy)}
                  >
                    {busy === "delete-memory" ? (
                      <Spinner label="Deleting" />
                    ) : (
                      <>
                        <Trash2 size={16} />{" "}
                        {confirmDelete
                          ? "Click again to delete everything"
                          : "Delete all lesson memory"}
                      </>
                    )}
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === "accessibility" && (
            <section className="settings-section form-section">
              <div className="settings-section-title">
                <div>
                  <h2>Voice & accessibility</h2>
                  <p>ShowME remains usable with narration and motion disabled.</p>
                </div>
              </div>
              <div className="settings-two-column">
                <label className="settings-field">
                  <span>Narration voice</span>
                  <select
                    value={draft.voice}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, voice: event.target.value }))
                    }
                  >
                    {VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Speech rate: {draft.speechRate.toFixed(1)}×</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={draft.speechRate}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        speechRate: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="preference-toggles">
                <Toggle
                  checked={draft.voiceEnabled}
                  onChange={(voiceEnabled) => setDraft((current) => ({ ...current, voiceEnabled }))}
                  label="Spoken narration"
                  description="Use cloud voice when supported, with system speech fallback"
                />
                <Toggle
                  checked={draft.reducedMotion}
                  onChange={(reducedMotion) =>
                    setDraft((current) => ({ ...current, reducedMotion }))
                  }
                  label="Reduce automatic motion"
                  description="Simulations remain adjustable and step navigation stays manual"
                />
              </div>
              <p className="accessibility-note">
                Keyboard: Tab moves through controls, Enter activates, Escape cancels capture, and
                Ctrl/Cmd+Z undoes the latest selection.
              </p>
            </section>
          )}

          {notice && (
            <div className="settings-notice">
              <CheckCircle2 size={17} /> {notice}
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
