import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ModelPicker from "./ModelPicker";

const providers = [
  { id: "anthropic", name: "Anthropic", color: "#d4a27f" },
  { id: "openai", name: "OpenAI", color: "#10a37f" },
];

const providerModels = {
  anthropic: [
    { id: "claude-3-opus", name: "claude-3-opus", category: "Flagship", ctx: "200K" },
    { id: "claude-3-haiku", name: "claude-3-haiku", category: "Fast", ctx: "200K" },
  ],
  openai: [
    { id: "gpt-4o", name: "gpt-4o", category: "Flagship", ctx: "128K" },
  ],
};

describe("ModelPicker", () => {
  it("renders trigger button with provider and model", () => {
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={() => {}}
      />
    );
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("claude-3-opus")).toBeInTheDocument();
  });

  it("shows category badge on trigger", () => {
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={() => {}}
      />
    );
    expect(screen.getByText("Flagship")).toBeInTheDocument();
  });

  it("opens provider list on click", () => {
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={() => {}}
      />
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Provider list header
    expect(screen.getByText("Provider")).toBeInTheDocument();
    // Both providers visible
    expect(screen.getAllByText("Anthropic").length).toBeGreaterThanOrEqual(2); // trigger + list
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("shows models when provider is clicked in dropdown", () => {
    const fetchModels = vi.fn();
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={fetchModels}
      />
    );
    // Open picker
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Click Anthropic in the provider list (the one in the dropdown, not trigger)
    const anthropicButtons = screen.getAllByText("Anthropic");
    fireEvent.click(anthropicButtons[anthropicButtons.length - 1]);
    // Should show models header
    expect(screen.getByText("Anthropic Models")).toBeInTheDocument();
    // Models should be visible
    expect(screen.getAllByText("claude-3-opus").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("claude-3-haiku")).toBeInTheDocument();
  });

  it("calls onSelect when model is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={onSelect}
        providers={providers}
        providerModels={providerModels}
        fetchModels={() => {}}
      />
    );
    // Open picker
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Click on Anthropic provider
    const anthropicButtons = screen.getAllByText("Anthropic");
    fireEvent.click(anthropicButtons[anthropicButtons.length - 1]);
    // Click on haiku model
    fireEvent.click(screen.getByText("claude-3-haiku"));
    expect(onSelect).toHaveBeenCalledWith("anthropic", "claude-3-haiku");
  });

  it("calls fetchModels when expanding a provider", () => {
    const fetchModels = vi.fn();
    render(
      <ModelPicker
        provId="anthropic"
        modId="claude-3-opus"
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={fetchModels}
      />
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Click on OpenAI
    fireEvent.click(screen.getByText("OpenAI"));
    expect(fetchModels).toHaveBeenCalledWith("openai");
  });

  it("shows 'Select model' when no model selected", () => {
    render(
      <ModelPicker
        provId="anthropic"
        modId=""
        onSelect={() => {}}
        providers={providers}
        providerModels={providerModels}
        fetchModels={() => {}}
      />
    );
    expect(screen.getByText("Select model")).toBeInTheDocument();
  });
});
