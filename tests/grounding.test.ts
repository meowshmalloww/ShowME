import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildCoordinateScaffold, createGroundingImageDataUrl } from "../src/main/grounding";

describe("private vision coordinate scaffold", () => {
  it("labels exact normalized x/y anchors without changing capture dimensions", async () => {
    const input = await sharp({
      create: { width: 320, height: 180, channels: 4, background: "white" },
    })
      .png()
      .toBuffer();
    const dataUrl = await createGroundingImageDataUrl(input);
    const output = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
    const metadata = await sharp(output).metadata();

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(180);
    expect(buildCoordinateScaffold(320, 180)).toContain(">x500</text>");
    expect(buildCoordinateScaffold(320, 180)).toContain(">y500</text>");
  });
});
