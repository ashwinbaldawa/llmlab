import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileZone from "./FileZone";

const baseTask = {
  accent: "#34d399",
  file: { acc: ".txt,.pdf,.csv", mx: 3, mb: 10, hint: "TXT, PDF, CSV" },
};

describe("FileZone", () => {
  it("renders mode toggle buttons", () => {
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="text" setMode={() => {}} />);
    expect(screen.getByText("Text Input")).toBeInTheDocument();
    expect(screen.getByText("File Upload")).toBeInTheDocument();
    expect(screen.getByText("Both")).toBeInTheDocument();
  });

  it("returns null when task has no file config", () => {
    const task = { accent: "#34d399" };
    const { container } = render(<FileZone task={task} files={[]} setFiles={() => {}} mode="text" setMode={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows drop zone in file mode", () => {
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="file" setMode={() => {}} />);
    expect(screen.getByText(/Drop files or/)).toBeInTheDocument();
  });

  it("shows drop zone in both mode", () => {
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="both" setMode={() => {}} />);
    expect(screen.getByText(/Drop files or/)).toBeInTheDocument();
  });

  it("does not show drop zone in text mode", () => {
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="text" setMode={() => {}} />);
    expect(screen.queryByText(/Drop files or/)).not.toBeInTheDocument();
  });

  it("shows file hints", () => {
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="file" setMode={() => {}} />);
    expect(screen.getByText(/TXT, PDF, CSV/)).toBeInTheDocument();
    expect(screen.getByText(/max 3 files/)).toBeInTheDocument();
  });

  it("shows uploaded files", () => {
    const files = [
      { name: "doc.txt", size: 1024 },
      { name: "data.csv", size: 2048 },
    ];
    render(<FileZone task={baseTask} files={files} setFiles={() => {}} mode="file" setMode={() => {}} />);
    expect(screen.getByText("doc.txt")).toBeInTheDocument();
    expect(screen.getByText("data.csv")).toBeInTheDocument();
  });

  it("shows add more text when under file limit", () => {
    const files = [{ name: "doc.txt", size: 1024 }];
    render(<FileZone task={baseTask} files={files} setFiles={() => {}} mode="file" setMode={() => {}} />);
    expect(screen.getByText(/\+ Add more/)).toBeInTheDocument();
  });

  it("calls setMode on mode button click", () => {
    const setMode = vi.fn();
    render(<FileZone task={baseTask} files={[]} setFiles={() => {}} mode="text" setMode={setMode} />);
    fireEvent.click(screen.getByText("File Upload"));
    expect(setMode).toHaveBeenCalledWith("file");
  });

  it("removes file on x click", () => {
    const setFiles = vi.fn();
    const files = [{ name: "doc.txt", size: 1024 }];
    render(<FileZone task={baseTask} files={files} setFiles={setFiles} mode="file" setMode={() => {}} />);
    fireEvent.click(screen.getByText("×"));
    expect(setFiles).toHaveBeenCalledWith([]);
  });
});
