import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { formatCommandError } from "../shared/errors";
import { CHANNELS, type IpcResult, type ShowMEApi } from "../shared/ipc";

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (result.ok) return result.data;
  // Electron's context bridge reliably carries Error.message but may omit custom fields.
  // Include remediation in that message before crossing into the sandboxed renderer.
  const error = new Error(formatCommandError(result.error));
  Object.assign(error, result.error);
  error.message = formatCommandError(result.error);
  throw error;
}

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: ShowMEApi = {
  app: {
    bootstrap: () => invoke(CHANNELS.appBootstrap),
    openMain: (section) => invoke(CHANNELS.appOpenMain, section),
    hideWindow: () => invoke(CHANNELS.appHideWindow),
    windowAction: (action) => invoke(CHANNELS.appWindowAction, action),
    openExternal: (url) => invoke(CHANNELS.appOpenExternal, url),
  },
  settings: { save: (settings) => invoke(CHANNELS.settingsSave, settings) },
  capture: {
    begin: () => invoke(CHANNELS.captureBegin),
    voiceContext: () => invoke(CHANNELS.captureVoiceContext),
    pending: () => invoke(CHANNELS.capturePending),
    commit: (input) => invoke(CHANNELS.captureCommit, input),
    cancel: () => invoke(CHANNELS.captureCancel),
    prepared: () => invoke(CHANNELS.capturePrepared),
    clear: () => invoke(CHANNELS.captureClear),
  },
  launcher: { setMode: (mode) => invoke(CHANNELS.launcherSetMode, mode) },
  providers: {
    saveKey: (provider, key) => invoke(CHANNELS.providerSaveKey, provider, key),
    deleteKey: (provider) => invoke(CHANNELS.providerDeleteKey, provider),
    test: (provider, model) => invoke(CHANNELS.providerTest, provider, model),
    models: (provider) => invoke(CHANNELS.providerModels, provider),
  },
  lesson: {
    generate: (request) => invoke(CHANNELS.lessonGenerate, request),
    adapt: (input) => invoke(CHANNELS.lessonAdapt, input),
    cancel: (requestId) => invoke(CHANNELS.lessonCancel, requestId),
    submitCheck: (input) => invoke(CHANNELS.lessonSubmitCheck, input),
    openSaved: (id) => invoke(CHANNELS.lessonOpenSaved, id),
    setSurface: (surface) => invoke(CHANNELS.lessonSetSurface, surface),
    setInteractive: (interactive) => invoke(CHANNELS.lessonSetInteractive, interactive),
    close: () => invoke(CHANNELS.lessonClose),
  },
  voice: {
    transcribe: (input) => invoke(CHANNELS.voiceTranscribe, input),
    synthesize: (text) => invoke(CHANNELS.voiceSynthesize, text),
    testProvider: (provider) => invoke(CHANNELS.voiceTestProvider, provider),
    activity: (state) => invoke(CHANNELS.voiceActivity, state),
    command: (phrase) => invoke(CHANNELS.voiceCommand, phrase),
    reportPlaybackError: (message) => invoke(CHANNELS.voicePlaybackError, message),
  },
  wake: {
    pushAudio: (bytes) => ipcRenderer.send(CHANNELS.wakeAudio, bytes),
    inputState: (state) => ipcRenderer.send(CHANNELS.wakeInputState, state),
  },
  memory: {
    listLessons: (query) => invoke(CHANNELS.memoryListLessons, query),
    getLesson: (id) => invoke(CHANNELS.memoryGetLesson, id),
    deleteLesson: (id) => invoke(CHANNELS.memoryDeleteLesson, id),
    deleteAll: () => invoke(CHANNELS.memoryDeleteAll),
    export: () => invoke(CHANNELS.memoryExport),
    feedback: (id, helpful) => invoke(CHANNELS.memoryFeedback, id, helpful),
    list: (query) => invoke(CHANNELS.memoryList, query),
    delete: (id) => invoke(CHANNELS.memoryDelete, id),
    summary: () => invoke(CHANNELS.memorySummary),
  },
  media: { search: (query) => invoke(CHANNELS.mediaSearch, query) },
  permissions: {
    status: () => invoke(CHANNELS.permissionsStatus),
    requestMicrophone: () => invoke(CHANNELS.permissionsRequestMicrophone),
  },
  events: {
    onNavigate: (callback) => subscribe(CHANNELS.eventNavigate, callback),
    onContextReady: (callback) => subscribe(CHANNELS.eventContextReady, callback),
    onLessonProgress: (callback) => subscribe(CHANNELS.eventLessonProgress, callback),
    onLessonReady: (callback) => subscribe(CHANNELS.eventLessonReady, callback),
    onLauncherMode: (callback) => subscribe(CHANNELS.eventLauncherMode, callback),
    onVoiceLevel: (callback) => subscribe(CHANNELS.eventVoiceLevel, callback),
    onWakeDetected: (callback) => subscribe(CHANNELS.eventWakeDetected, callback),
    onWakeStatus: (callback) => subscribe(CHANNELS.eventWakeStatus, callback),
    onSettingsChanged: (callback) => subscribe(CHANNELS.eventSettingsChanged, callback),
    onVoiceCommand: (callback) => subscribe(CHANNELS.eventVoiceCommand, callback),
    onVoiceCommandCapture: (callback) => subscribe(CHANNELS.eventVoiceCommandCapture, callback),
    onVoicePlaybackError: (callback) => subscribe(CHANNELS.eventVoicePlaybackError, callback),
  },
};

contextBridge.exposeInMainWorld("showme", api);
