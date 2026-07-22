import {
  type BrowserWindow,
  type Display,
  desktopCapturer,
  type NativeImage,
  nativeImage,
  screen,
  systemPreferences,
} from "electron";
import { CommandError } from "../shared/errors";
import { selectionRegionSchema } from "../shared/schema";
import type {
  CapturePayload,
  DisplayDescriptor,
  PreparedContext,
  SelectionRegion,
} from "../shared/types";
import { createGroundingImageDataUrl, createScreenContrastMap } from "./grounding";
import type { WorkerService } from "./workers";

interface CaptureRecord {
  payload: CapturePayload;
  image: NativeImage;
  prepared?: PreparedContext;
  expiresAt: number;
}

export class CaptureService {
  private readonly captures = new Map<string, CaptureRecord>();
  private activeId: string | null = null;

  constructor(
    private readonly workers: WorkerService,
    private readonly launcherWindow: () => BrowserWindow | null,
  ) {}

  async begin(targetDisplay?: Display): Promise<CapturePayload> {
    this.cleanup();
    const display = targetDisplay ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const launcher = this.launcherWindow();
    launcher?.hide();
    await new Promise((resolve) => setTimeout(resolve, 90));
    try {
      const requestedWidth = Math.max(1, Math.round(display.size.width * display.scaleFactor));
      const requestedHeight = Math.max(1, Math.round(display.size.height * display.scaleFactor));
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: requestedWidth, height: requestedHeight },
        fetchWindowIcons: false,
      });
      const source =
        sources.find((candidate) => candidate.display_id === String(display.id)) ??
        (sources.length === 1 ? sources[0] : undefined);
      if (!source || source.thumbnail.isEmpty()) {
        throw new CommandError(
          "CAPTURE_UNAVAILABLE",
          "ShowME could not read this display.",
          process.platform === "darwin"
            ? "Enable Screen Recording for ShowME in System Settings, then try again."
            : "Check screen-capture privacy settings and try again.",
        );
      }
      const captureId = crypto.randomUUID();
      const payload: CapturePayload = {
        captureId,
        imageDataUrl: source.thumbnail.toDataURL(),
        display: describeDisplay(display),
        capturedAt: new Date().toISOString(),
      };
      this.captures.set(captureId, {
        payload,
        image: source.thumbnail,
        expiresAt: Date.now() + 15 * 60_000,
      });
      this.activeId = captureId;
      return payload;
    } catch (error) {
      launcher?.showInactive();
      throw error;
    }
  }

  async captureVoiceContext(): Promise<PreparedContext> {
    const payload = await this.begin();
    return this.commit(payload.captureId, []);
  }

  pending(): CapturePayload {
    const record = this.activeId ? this.captures.get(this.activeId) : undefined;
    if (!record) throw new CommandError("NO_CAPTURE", "There is no active screen capture.");
    return record.payload;
  }

  async commit(captureId: string, regions: SelectionRegion[]): Promise<PreparedContext> {
    const record = this.captures.get(captureId);
    if (!record) {
      throw new CommandError(
        "CAPTURE_EXPIRED",
        "That screen capture expired.",
        "Capture the area again.",
      );
    }
    const validated = regions.map((region) =>
      selectionRegionSchema.parse(region),
    ) as SelectionRegion[];
    const size = record.image.getSize();
    const cropBounds = await this.workers.cropBounds(validated, size.width, size.height);
    const safeBounds = {
      x: Math.max(0, Math.min(size.width - 1, Math.round(cropBounds.x))),
      y: Math.max(0, Math.min(size.height - 1, Math.round(cropBounds.y))),
      width: Math.max(
        1,
        Math.min(size.width - Math.round(cropBounds.x), Math.round(cropBounds.width)),
      ),
      height: Math.max(
        1,
        Math.min(size.height - Math.round(cropBounds.y), Math.round(cropBounds.height)),
      ),
    };
    const cropped = record.image.crop(safeBounds);
    const croppedSize = cropped.getSize();
    const croppedPng = cropped.toPNG();
    let analysisDataUrl: string | undefined;
    let contrastMap: Awaited<ReturnType<typeof createScreenContrastMap>> | undefined;
    const [groundingResult, contrastResult] = await Promise.allSettled([
      createGroundingImageDataUrl(croppedPng),
      createScreenContrastMap(croppedPng),
    ]);
    if (groundingResult.status === "fulfilled") analysisDataUrl = groundingResult.value;
    else {
      // Grounding marks improve localization, but a capture must remain usable if
      // native image processing is unavailable on an unusual platform.
      console.warn("Could not add the private vision coordinate scaffold.", groundingResult.reason);
    }
    if (contrastResult.status === "fulfilled") contrastMap = contrastResult.value;
    else
      console.warn("Could not sample screen contrast for whiteboard text.", contrastResult.reason);
    const prepared: PreparedContext = {
      captureId,
      previewDataUrl: cropped.toDataURL(),
      ...(analysisDataUrl ? { analysisDataUrl } : {}),
      ...(contrastMap ? { contrastMap } : {}),
      regions: validated,
      pixelWidth: croppedSize.width,
      pixelHeight: croppedSize.height,
      capturePixelWidth: size.width,
      capturePixelHeight: size.height,
      display: record.payload.display,
      cropBounds: safeBounds,
      containsAnnotations: validated.some((region) =>
        ["arrow", "circle", "line", "label"].includes(region.kind),
      ),
      scope: validated.length > 0 ? "selection" : "display",
    };
    record.prepared = prepared;
    record.image = nativeImage.createEmpty();
    record.payload = { ...record.payload, imageDataUrl: "" };
    return prepared;
  }

  prepared(): PreparedContext | null {
    if (!this.activeId) return null;
    return this.captures.get(this.activeId)?.prepared ?? null;
  }

  getPrepared(captureId: string): PreparedContext {
    const prepared = this.captures.get(captureId)?.prepared;
    if (!prepared) {
      throw new CommandError(
        "CONTEXT_NOT_READY",
        "The selected screen context is not ready.",
        "Select the area again.",
      );
    }
    return prepared;
  }

  clear(): void {
    if (this.activeId) this.captures.delete(this.activeId);
    this.activeId = null;
  }

  cancel(): void {
    this.clear();
  }

  permissionStatus(): "unknown" | "granted" | "denied" | "unsupported" {
    if (process.platform !== "darwin") return "unknown";
    const status = systemPreferences.getMediaAccessStatus("screen");
    if (status === "granted") return "granted";
    if (status === "denied" || status === "restricted") return "denied";
    return "unknown";
  }

  private cleanup(): void {
    for (const [id, record] of this.captures) {
      if (record.expiresAt < Date.now()) this.captures.delete(id);
    }
    if (this.captures.size > 3) {
      const ids = [...this.captures.keys()];
      for (const id of ids.slice(0, ids.length - 3)) this.captures.delete(id);
    }
  }
}

function describeDisplay(display: Display): DisplayDescriptor {
  return {
    id: display.id,
    label: display.label || "Display " + String(display.id),
    bounds: display.bounds,
    workArea: display.workArea,
    size: display.size,
    scaleFactor: display.scaleFactor,
  };
}
