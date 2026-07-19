import { CommandError } from "../shared/errors";
import type { ImageAsset } from "../shared/types";

export async function searchCommons(query: string): Promise<ImageAsset[]> {
  const trimmed = query.trim().slice(0, 180);
  if (!trimmed) return [];
  const parameters = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: trimmed,
    gsrnamespace: "6",
    gsrlimit: "6",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "640",
    format: "json",
    origin: "*",
  });
  const response = await fetch("https://commons.wikimedia.org/w/api.php?" + parameters, {
    headers: { "User-Agent": "ShowME/1.0 visual-learning-desktop" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new CommandError(
      "MEDIA_SEARCH_FAILED",
      "Wikimedia Commons image search is unavailable right now.",
    );
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const pages = asRecord(asRecord(payload.query).pages);
  const assets = Object.values(pages).flatMap((value): ImageAsset[] => {
    const page = asRecord(value);
    const info = Array.isArray(page.imageinfo) ? asRecord(page.imageinfo[0]) : {};
    const metadata = asRecord(info.extmetadata);
    const originalUrl = typeof info.url === "string" ? info.url : "";
    const pageUrl = typeof info.descriptionurl === "string" ? info.descriptionurl : "";
    if (!originalUrl || !pageUrl) return [];
    const license = metadataValue(metadata.LicenseShortName) || "See source";
    const artist = stripHtml(metadataValue(metadata.Artist) || "Wikimedia Commons contributor");
    return [
      {
        id: String(page.pageid ?? crypto.randomUUID()),
        title: String(page.title ?? "Reference image").replace(/^File:/, ""),
        thumbnailUrl: typeof info.thumburl === "string" ? info.thumburl : originalUrl,
        originalUrl,
        pageUrl,
        artist,
        license,
        licenseUrl: metadataValue(metadata.LicenseUrl) || pageUrl,
        description: stripHtml(
          metadataValue(metadata.ImageDescription) || "Reference image from Wikimedia Commons",
        ),
      },
    ];
  });
  return Promise.all(assets.slice(0, 4).map(embedTrustedThumbnail));
}

async function embedTrustedThumbnail(asset: ImageAsset): Promise<ImageAsset> {
  try {
    const url = new URL(asset.thumbnailUrl);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "wikimedia.org" && !url.hostname.endsWith(".wikimedia.org"))
    )
      return { ...asset, thumbnailUrl: "" };
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (
      !response.ok ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType)
    )
      return { ...asset, thumbnailUrl: "" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000) return { ...asset, thumbnailUrl: "" };
    return {
      ...asset,
      thumbnailUrl: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`,
    };
  } catch {
    return { ...asset, thumbnailUrl: "" };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function metadataValue(value: unknown): string {
  const record = asRecord(value);
  return typeof record.value === "string" ? record.value : "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
