import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { CHANNELS, type IpcResult, type ShowMEApi } from "../shared/ipc";

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (result.ok) return result.data;
  const error = new Error(result.error.message);
  Object.assign(error, result.error);
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
    openSaved: (id) => invoke(CHANNELS.lessonOpenSaved, id),
    setSurface: (surface) => invoke(CHANNELS.lessonSetSurface, surface),
    close: () => invoke(CHANNELS.lessonClose),
  },
  voice: {
    transcribe: (input) => invoke(CHANNELS.voiceTranscribe, input),
    synthesize: (text) => invoke(CHANNELS.voiceSynthesize, text),
    activity: (state) => invoke(CHANNELS.voiceActivity, state),
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
  },
};

contextBridge.exposeInMainWorld("showme", api);
