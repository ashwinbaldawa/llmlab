import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Dropdown from "./Dropdown";

const options = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

const renderOpt = (o) => <span>{o.label}</span>;

describe("Dropdown", () => {
  it("renders trigger button", () => {
    const { container } = render(
      <Dropdown value="a" onChange={() => {}} options={options} renderOption={renderOpt} placeholder="Pick" />
    );
    expect(container.querySelector("button")).toBeInTheDocument();
  });

  it("shows selected option text", () => {
    render(
      <Dropdown value="a" onChange={() => {}} options={options} renderOption={renderOpt} placeholder="Pick" />
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("shows placeholder when no selection", () => {
    render(
      <Dropdown value={null} onChange={() => {}} options={options} renderOption={renderOpt} placeholder="Pick one" />
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("opens options on click", () => {
    render(
      <Dropdown value="a" onChange={() => {}} options={options} renderOption={renderOpt} placeholder="Pick" />
    );
    // Click the trigger (first button)
    fireEvent.click(screen.getAllByRole("button")[0]);
    // All options should now be visible
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("calls onChange when option is selected", () => {
    const onChange = vi.fn();
    render(
      <Dropdown value="a" onChange={onChange} options={options} renderOption={renderOpt} placeholder="Pick" />
    );
    // Open dropdown
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Click "Beta"
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes on outside click", () => {
    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <Dropdown value="a" onChange={() => {}} options={options} renderOption={renderOpt} placeholder="Pick" />
      </div>
    );
    // Open dropdown
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));
    // Options should be hidden (Beta is only shown in dropdown items, not trigger)
    // The trigger still shows "Alpha" since value="a"
    // After closing, only the trigger buttons remain
    const buttons = container.querySelectorAll("button");
    // Only the trigger button should remain (dropdown closed)
    expect(buttons).toHaveLength(1);
  });
});
