import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCommons } from "../src/main/media";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("licensed image aids", () => {
  it("keeps the Commons source and license while embedding only a trusted image", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "42": {
                  pageid: 42,
                  title: "File:Orbit diagram.png",
                  imageinfo: [
                    {
                      url: "https://upload.wikimedia.org/orbit.png",
                      thumburl: "https://upload.wikimedia.org/orbit-thumb.png",
                      descriptionurl: "https://commons.wikimedia.org/wiki/File:Orbit_diagram.png",
                      extmetadata: {
                        Artist: { value: "<b>Example Author</b>" },
                        LicenseShortName: { value: "CC BY-SA 4.0" },
                        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
                        ImageDescription: { value: "<p>An orbit diagram</p>" },
                      },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const assets = await searchCommons("orbital motion");
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      title: "Orbit diagram.png",
      artist: "Example Author",
      license: "CC BY-SA 4.0",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Orbit_diagram.png",
      description: "An orbit diagram",
    });
    expect(assets[0]?.thumbnailUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
