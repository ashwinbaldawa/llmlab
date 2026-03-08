import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OptControl from "./OptControl";

describe("OptControl", () => {
  const accent = "#34d399";

  describe("type=sel (select)", () => {
    const opt = { t: "sel", d: "Option A", ch: ["Option A", "Option B", "Option C"] };

    it("renders a select element", () => {
      const { container } = render(<OptControl opt={opt} value="Option A" onChange={() => {}} accent={accent} />);
      expect(container.querySelector("select")).toBeInTheDocument();
    });

    it("renders all choices as options", () => {
      render(<OptControl opt={opt} value="Option A" onChange={() => {}} accent={accent} />);
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
    });

    it("calls onChange on selection", () => {
      const onChange = vi.fn();
      const { container } = render(<OptControl opt={opt} value="Option A" onChange={onChange} accent={accent} />);
      fireEvent.change(container.querySelector("select"), { target: { value: "Option B" } });
      expect(onChange).toHaveBeenCalledWith("Option B");
    });

    it("uses default value when value is falsy", () => {
      const { container } = render(<OptControl opt={opt} value={null} onChange={() => {}} accent={accent} />);
      expect(container.querySelector("select").value).toBe("Option A");
    });
  });

  describe("type=multi (multi-select)", () => {
    const opt = { t: "multi", d: ["A"], ch: ["A", "B", "C"] };

    it("renders buttons for each choice", () => {
      const { container } = render(<OptControl opt={opt} value={["A"]} onChange={() => {}} accent={accent} />);
      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(3);
    });

    it("adds item on click when not selected", () => {
      const onChange = vi.fn();
      render(<OptControl opt={opt} value={["A"]} onChange={onChange} accent={accent} />);
      fireEvent.click(screen.getByText("B"));
      expect(onChange).toHaveBeenCalledWith(["A", "B"]);
    });

    it("removes item on click when already selected", () => {
      const onChange = vi.fn();
      render(<OptControl opt={opt} value={["A", "B"]} onChange={onChange} accent={accent} />);
      fireEvent.click(screen.getByText("A"));
      expect(onChange).toHaveBeenCalledWith(["B"]);
    });

    it("handles non-array value gracefully", () => {
      const onChange = vi.fn();
      render(<OptControl opt={opt} value={null} onChange={onChange} accent={accent} />);
      fireEvent.click(screen.getByText("A"));
      expect(onChange).toHaveBeenCalledWith(["A"]);
    });
  });

  describe("type=tog (toggle)", () => {
    const opt = { t: "tog", d: false };

    it("renders a toggle button", () => {
      const { container } = render(<OptControl opt={opt} value={false} onChange={() => {}} accent={accent} />);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("toggles from false to true", () => {
      const onChange = vi.fn();
      const { container } = render(<OptControl opt={opt} value={false} onChange={onChange} accent={accent} />);
      fireEvent.click(container.querySelector("button"));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("toggles from true to false", () => {
      const onChange = vi.fn();
      const { container } = render(<OptControl opt={opt} value={true} onChange={onChange} accent={accent} />);
      fireEvent.click(container.querySelector("button"));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe("type=sli (slider)", () => {
    const opt = { t: "sli", min: 0, max: 10, d: 5 };

    it("renders a range input", () => {
      const { container } = render(<OptControl opt={opt} value={5} onChange={() => {}} accent={accent} />);
      expect(container.querySelector('input[type="range"]')).toBeInTheDocument();
    });

    it("shows the current value", () => {
      render(<OptControl opt={opt} value={7} onChange={() => {}} accent={accent} />);
      expect(screen.getByText("7")).toBeInTheDocument();
    });

    it("calls onChange with numeric value", () => {
      const onChange = vi.fn();
      const { container } = render(<OptControl opt={opt} value={5} onChange={onChange} accent={accent} />);
      fireEvent.change(container.querySelector('input[type="range"]'), { target: { value: "8" } });
      expect(onChange).toHaveBeenCalledWith(8);
    });

    it("uses default when value is nullish", () => {
      render(<OptControl opt={opt} value={null} onChange={() => {}} accent={accent} />);
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  describe("type=txt (text input)", () => {
    const opt = { t: "txt", d: "", placeholder: "Enter text..." };

    it("renders a text input", () => {
      const { container } = render(<OptControl opt={opt} value="" onChange={() => {}} accent={accent} />);
      expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
    });

    it("shows placeholder", () => {
      render(<OptControl opt={opt} value="" onChange={() => {}} accent={accent} />);
      expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
    });

    it("calls onChange on input", () => {
      const onChange = vi.fn();
      const { container } = render(<OptControl opt={opt} value="" onChange={onChange} accent={accent} />);
      fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: "hello" } });
      expect(onChange).toHaveBeenCalledWith("hello");
    });
  });

  describe("unknown type", () => {
    it("returns null", () => {
      const opt = { t: "unknown", d: "" };
      const { container } = render(<OptControl opt={opt} value="" onChange={() => {}} accent={accent} />);
      expect(container.innerHTML).toBe("");
    });
  });
});
