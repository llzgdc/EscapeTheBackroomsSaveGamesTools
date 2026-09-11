import { describe, expect, it } from "vitest";
import { formatFileSize } from "../formatFileSize";

describe("formatFileSize", () => {
  it("returns 0 KB for non-positive and non-finite input", () => {
    expect(formatFileSize(0)).toBe("0 KB");
    expect(formatFileSize(-10)).toBe("0 KB");
    expect(formatFileSize(Number.NaN)).toBe("0 KB");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("0 KB");
  });

  it("formats byte values without decimals", () => {
    expect(formatFileSize(1)).toBe("1 B");
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes with one decimal below 100", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes and collapses to integers past 100", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(150 * 1024 * 1024)).toBe("150 MB");
  });

  it("reaches gigabytes and beyond", () => {
    expect(formatFileSize(3 * 1024 ** 3)).toBe("3.0 GB");
    expect(formatFileSize(2 * 1024 ** 4)).toBe("2.0 TB");
  });
});
