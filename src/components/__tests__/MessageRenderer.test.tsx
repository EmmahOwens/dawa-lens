import * as React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import MessageRenderer, { normalizeMarkdown } from "../MessageRenderer";

describe("normalizeMarkdown", () => {
  it("converts literal escaped newlines (\\n) into real line breaks", () => {
    const raw = "Timezone Shift\\n- Nairobi (UTC+3) to Philippines (UTC+8) is a +5 hour shift.\\n- If you normally take your medication at 8am";
    const normalized = normalizeMarkdown(raw);

    expect(normalized).toContain("Timezone Shift");
    expect(normalized).toContain("- Nairobi (UTC+3)");
    expect(normalized).not.toContain("\\n");
  });

  it("inserts a blank line between a paragraph and an immediately following list item", () => {
    const raw = "Timezone Shift\n- Nairobi (UTC+3) to Philippines (UTC+8) is a +5 hour shift.\n- If you normally take your medication";
    const normalized = normalizeMarkdown(raw);

    // Paragraph followed by list should have blank line separator
    expect(normalized).toContain("Timezone Shift\n\n- Nairobi");
    // Consecutive list items should remain tightly grouped
    expect(normalized).toContain("- Nairobi (UTC+3) to Philippines (UTC+8) is a +5 hour shift.\n- If you normally");
  });

  it("converts unicode bullet characters (•) into markdown list dashes (-)", () => {
    const raw = "Customs Notes:\n• Prescription required\n• Declare at customs";
    const normalized = normalizeMarkdown(raw);

    expect(normalized).toContain("- Prescription required");
    expect(normalized).toContain("- Declare at customs");
    expect(normalized).not.toContain("•");
  });

  it("unescapes escaped quotes and tabs", () => {
    const raw = 'Please bring \\"official\\" documents and prescription.';
    const normalized = normalizeMarkdown(raw);

    expect(normalized).toBe('Please bring "official" documents and prescription.');
  });

  it("strips internal metadata blocks and action tags", () => {
    const raw = "Here is your advice.\n### METADATA ###\n{\"source\":\"AI\"}";
    const normalized = normalizeMarkdown(raw);

    expect(normalized).toBe("Here is your advice.");
    expect(normalized).not.toContain("METADATA");
  });
});

describe("MessageRenderer Component", () => {
  it("renders true markdown bullet lists from AI string with escaped newlines", () => {
    const raw = "Timezone Shift\\n- Nairobi (UTC+3) to Philippines (UTC+8) is a +5 hour shift.\\n- Take at 1pm local time.";

    const { container } = render(
      <MemoryRouter>
        <MessageRenderer text={raw} />
      </MemoryRouter>
    );

    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain("Nairobi (UTC+3) to Philippines (UTC+8) is a +5 hour shift.");
    expect(listItems[1].textContent).toContain("Take at 1pm local time.");

    // Does not show raw \n in text content
    expect(container.textContent).not.toContain("\\n");
  });

  it("renders bold markdown text with strong elements", () => {
    const text = "Customs Restrictions:\n- **Prescription-required medicines** (e.g. Coartem) are allowed.\n- **Over-the-counter drugs** can be brought.";

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    expect(screen.getByText("Prescription-required medicines")).toBeInTheDocument();
    expect(screen.getByText("Over-the-counter drugs")).toBeInTheDocument();
  });

  it("renders headings properly", () => {
    const text = "### Timezone Dosing Strategy\n\nTake your dose with morning tea.";

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Timezone Dosing Strategy");
  });

  it("renders internal route links as interactive chips", () => {
    const text = "Check your [Cabinet](/medications) or set a [Reminder](/reminders).";

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    const cabinetLink = screen.getByRole("link", { name: /Cabinet/i });
    expect(cabinetLink).toHaveAttribute("href", "/medications");

    const reminderLink = screen.getByRole("link", { name: /Reminder/i });
    expect(reminderLink).toHaveAttribute("href", "/reminders");
  });

  it("safely handles empty, null, or undefined strings without crashing", () => {
    const { container: c1 } = render(<MemoryRouter><MessageRenderer text="" /></MemoryRouter>);
    expect(c1).toBeInTheDocument();

    const { container: c2 } = render(<MemoryRouter><MessageRenderer text={null as any} /></MemoryRouter>);
    expect(c2).toBeInTheDocument();

    const { container: c3 } = render(<MemoryRouter><MessageRenderer text={undefined as any} /></MemoryRouter>);
    expect(c3).toBeInTheDocument();
  });

  it("resolves links without leading slash to valid in-app routes", () => {
    const text = "Go to [Meds](medications) or [Add Reminder](reminders/new) or [Vault](medvault).";

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Meds/i })).toHaveAttribute("href", "/medications");
    expect(screen.getByRole("link", { name: /Add Reminder/i })).toHaveAttribute("href", "/reminders/new");
    expect(screen.getByRole("link", { name: /Vault/i })).toHaveAttribute("href", "/medvault");
  });

  it("resolves action aliases and semantic screenshot links into in-app page routes", () => {
    const text = `
      Action:
      [Add his medication here](add-his-medication-here)
      [Create Owen's first reminder here](create-owens-first-reminder-here)
    `;

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    const medLink = screen.getByRole("link", { name: /Add his medication here/i });
    expect(medLink).toHaveAttribute("href", "/medications");

    const reminderLink = screen.getByRole("link", { name: /Create Owen's first reminder here/i });
    expect(reminderLink).toHaveAttribute("href", "/reminders/new");
  });

  it("resolves full URLs and dawalens.ug URLs to internal app routes", () => {
    const text = `
      Check [Active Meds](https://dawalens.ug/medications) and
      [Set Reminder](https://dawalens.app/reminders/new).
    `;

    render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Active Meds/i })).toHaveAttribute("href", "/medications");
    expect(screen.getByRole("link", { name: /Set Reminder/i })).toHaveAttribute("href", "/reminders/new");
  });

  it("never renders external links to non-existent URLs and safely renders unmapped links as formatted text", () => {
    const text = "Here is [Completely Unrelated Information](https://nonexistent-random-domain.xyz/random-path).";

    const { container } = render(
      <MemoryRouter>
        <MessageRenderer text={text} />
      </MemoryRouter>
    );

    // Should NOT have an <a> tag linking to nonexistent URL
    const links = screen.queryAllByRole("link");
    expect(links.length).toBe(0);
    // Should render the text safely
    expect(container.textContent).toContain("Completely Unrelated Information");
  });
});

