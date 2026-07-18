import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mic,
  MonitorUp,
  MousePointer2,
  ScanSearch,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import { TEACHING_STYLE_LABELS, VOICES } from "../lib/defaults";
import { commandErrorMessage } from "../lib/errors";
import type { AppBootstrap, AppSettings, PermissionStatus, ProviderId } from "../lib/types";
import { Brand, BrandGlyph, Spinner, Toggle } from "./Chrome";

export function Onboarding({
  bootstrap,
  onComplete,
}: {
  bootstrap: AppBootstrap;
  onComplete: (bootstrap: AppBootstrap) => void;
}) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(bootstrap.settings);
  const [provider, setProvider] = useState<ProviderId>(bootstrap.settings.provider);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selectedProvider = bootstrap.providers.find((item) => item.id === provider);

  const checkPermission = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (isTauriRuntime()) setPermission(await desktop.checkCapturePermission());
      else
        setPermission({
          capture: "granted",
          microphone: "unknown",
          note: "Desktop permission checks run in the installed app.",
        });
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(false);
    }
  };

  const saveProvider = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (isTauriRuntime() && key.trim()) await desktop.setProviderKey(provider, key.trim());
      setSettings((current) => ({ ...current, provider }));
      setStep(3);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const completed = { ...settings, provider, onboardingComplete: true };
      if (isTauriRuntime()) onComplete(await desktop.saveSettings(completed));
      else onComplete({ ...bootstrap, settings: completed });
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="onboarding">
      <aside className="onboarding-aside">
        <Brand />
        <div className="onboarding-art" aria-hidden="true">
          <div className="onboarding-art-mark">
            <BrandGlyph />
          </div>
          <div className="onboarding-art-flow">
            <span>
              <b>01</b> Select
            </span>
            <i />
            <span>
              <b>02</b> Ask
            </span>
            <i />
            <span>
              <b>03</b> Explore
            </span>
          </div>
        </div>
        <blockquote>
          “Don’t explain it.
          <br />
          <strong>Make it visible.</strong>”
        </blockquote>
        <p>
          ShowME turns the thing on your screen into a visual you can inspect, replay, and control.
        </p>
        <div className="onboarding-promise">
          <ShieldCheck size={18} />
          <span>
            <strong>Your screen is never watched.</strong> Capture happens only when you invoke it.
          </span>
        </div>
      </aside>

      <section className="onboarding-content">
        <div
          className="onboarding-progress"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step + 1}
        >
          {[0, 1, 2, 3].map((item) => (
            <span key={item} className={item <= step ? "active" : ""} />
          ))}
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <span className="eyebrow">Welcome to ShowME</span>
            <h1>A visual tool for the thing in front of you.</h1>
            <p className="lead">
              Point at a confusing equation, diagram, passage, or code path. Ask your question by
              voice or text. ShowME compiles a focused visual lesson around it.
            </p>
            <div className="onboarding-feature-grid">
              <div>
                <MonitorUp size={21} />
                <strong>Select exactly what matters</strong>
                <span>Rectangle, lasso, point, and annotations.</span>
              </div>
              <div>
                <ScanSearch size={21} />
                <strong>Inspect an interactive model</strong>
                <span>Safe scene primitives and verified simulations.</span>
              </div>
              <div>
                <Volume2 size={21} />
                <strong>Hear it, replay it, control it</strong>
                <span>Voice narration and adjustable variables.</span>
              </div>
            </div>
            <button className="primary-action" type="button" onClick={() => setStep(1)}>
              Set up ShowME <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <span className="eyebrow">Privacy first</span>
            <h1>Nothing happens until you ask.</h1>
            <p className="lead">
              ShowME needs screen-capture permission to take an invocation-only snapshot. Microphone
              access is requested later, only when you press Push to talk.
            </p>
            <div className="permission-list">
              <div>
                <span className="permission-icon">
                  <MonitorUp size={22} />
                </span>
                <div>
                  <strong>Screen capture</strong>
                  <small>
                    One snapshot after a hotkey or launcher click; selected pixels only are sent.
                  </small>
                </div>
                <span className={`permission-state ${permission?.capture ?? "unknown"}`}>
                  {permission?.capture === "granted" ? (
                    <>
                      <Check size={15} /> Ready
                    </>
                  ) : (
                    "Not checked"
                  )}
                </span>
              </div>
              <div>
                <span className="permission-icon">
                  <Mic size={22} />
                </span>
                <div>
                  <strong>Microphone</strong>
                  <small>Push-to-talk only. Recording stops when you release or press Stop.</small>
                </div>
                <span className="permission-state unknown">On first use</span>
              </div>
            </div>
            {permission?.note && (
              <div className="permission-note">
                <ShieldCheck size={16} /> {permission.note}
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <div className="onboarding-actions">
              <button className="secondary-action" type="button" onClick={() => setStep(0)}>
                <ArrowLeft size={17} /> Back
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={checkPermission}
                disabled={busy}
              >
                {busy ? <Spinner label="Checking" /> : "Check screen access"}
              </button>
              <button className="primary-action" type="button" onClick={() => setStep(2)}>
                Continue <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <span className="eyebrow">Connect a model</span>
            <h1>Connect a model provider.</h1>
            <p className="lead">
              Choose who handles your lesson requests. OpenAI supports the complete workflow;
              Alibaba Cloud Qwen is available as a direct US-region vision route.
            </p>
            <div className="onboarding-providers">
              {bootstrap.providers.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={provider === item.id ? "active" : ""}
                  onClick={() => setProvider(item.id)}
                >
                  <span className="provider-monogram">{item.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.model}</small>
                  </div>
                  {provider === item.id && <Check size={18} />}
                </button>
              ))}
            </div>
            <label className="key-field">
              <span>API key for {selectedProvider?.name}</span>
              <div>
                <KeyRound size={17} />
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder={
                    selectedProvider?.configured
                      ? "A key is already stored"
                      : "Paste a key (optional for now)"
                  }
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <div className="vault-note">
              <LockKeyhole size={17} />
              <span>
                The key is written directly to your operating system’s credential vault. It is never
                placed in settings, logs, lesson memory, or the frontend bundle.
              </span>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="onboarding-actions">
              <button className="secondary-action" type="button" onClick={() => setStep(1)}>
                <ArrowLeft size={17} /> Back
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={saveProvider}
                disabled={busy}
              >
                {busy ? (
                  <Spinner label="Saving securely" />
                ) : (
                  <>
                    {key.trim() ? "Save and continue" : "Continue without a key"}{" "}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <span className="eyebrow">Make it yours</span>
            <h1>How do you like to learn?</h1>
            <div className="preference-section">
              <label>
                <span>Teaching style</span>
                <select
                  value={settings.teachingStyle}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      teachingStyle: event.target.value as AppSettings["teachingStyle"],
                    }))
                  }
                >
                  {Object.entries(TEACHING_STYLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Narration voice</span>
                <select
                  value={settings.voice}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, voice: event.target.value }))
                  }
                >
                  {VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="preference-toggles">
              <Toggle
                checked={settings.voiceEnabled}
                onChange={(voiceEnabled) =>
                  setSettings((current) => ({ ...current, voiceEnabled }))
                }
                label="Spoken narration"
                description="Each lesson can read the active step aloud"
              />
              <Toggle
                checked={settings.memoryEnabled}
                onChange={(memoryEnabled) =>
                  setSettings((current) => ({ ...current, memoryEnabled }))
                }
                label="Local lesson memory"
                description="Save plans and questions locally; screenshots are never saved"
              />
              <Toggle
                checked={settings.reducedMotion}
                onChange={(reducedMotion) =>
                  setSettings((current) => ({ ...current, reducedMotion }))
                }
                label="Reduced motion"
                description="Keep visuals interactive without automatic animation"
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="onboarding-actions">
              <button className="secondary-action" type="button" onClick={() => setStep(2)}>
                <ArrowLeft size={17} /> Back
              </button>
              <button className="primary-action" type="button" onClick={complete} disabled={busy}>
                {busy ? (
                  <Spinner label="Finishing" />
                ) : (
                  <>
                    Open ShowME <MousePointer2 size={17} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
