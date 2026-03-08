import { describe, it, expect } from "vitest";
import { fmtSz, isImg, isPdf, isTxt } from "./fileHelpers";

describe("fmtSz", () => {
  it("formats bytes", () => {
    expect(fmtSz(500)).toBe("500 B");
  });

  it("formats zero bytes", () => {
    expect(fmtSz(0)).toBe("0 B");
  });

  it("formats kilobytes", () => {
    expect(fmtSz(2048)).toBe("2.0 KB");
  });

  it("formats kilobytes with decimals", () => {
    expect(fmtSz(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(fmtSz(5242880)).toBe("5.0 MB");
  });

  it("formats megabytes boundary", () => {
    expect(fmtSz(1048576)).toBe("1.0 MB");
  });
});

describe("isImg", () => {
  it("returns true for .png", () => {
    expect(isImg({ name: "photo.png" })).toBe(true);
  });

  it("returns true for .jpg", () => {
    expect(isImg({ name: "photo.jpg" })).toBe(true);
  });

  it("returns true for .jpeg", () => {
    expect(isImg({ name: "photo.jpeg" })).toBe(true);
  });

  it("returns true for .webp", () => {
    expect(isImg({ name: "photo.webp" })).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isImg({ name: "photo.PNG" })).toBe(true);
  });

  it("returns false for .txt", () => {
    expect(isImg({ name: "doc.txt" })).toBe(false);
  });

  it("returns false for .pdf", () => {
    expect(isImg({ name: "doc.pdf" })).toBe(false);
  });
});

describe("isPdf", () => {
  it("returns true for .pdf", () => {
    expect(isPdf({ name: "doc.pdf" })).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isPdf({ name: "doc.PDF" })).toBe(true);
  });

  it("returns false for .txt", () => {
    expect(isPdf({ name: "doc.txt" })).toBe(false);
  });
});

describe("isTxt", () => {
  const textExts = [".txt", ".md", ".csv", ".json", ".tsv", ".html", ".srt", ".vtt"];

  textExts.forEach((ext) => {
    it(`returns true for ${ext}`, () => {
      expect(isTxt({ name: `file${ext}` })).toBe(true);
    });
  });

  it("returns false for .png", () => {
    expect(isTxt({ name: "file.png" })).toBe(false);
  });

  it("returns false for .pdf", () => {
    expect(isTxt({ name: "file.pdf" })).toBe(false);
  });
});
