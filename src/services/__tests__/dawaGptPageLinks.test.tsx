import { describe, it, expect } from "vitest";
import { generateDawaGPTResponse } from "../aiAssistantService";
import { UserProfile } from "@/contexts/AppContext";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MessageRenderer from "@/components/MessageRenderer";

describe("DawaGPT Context-Aware Page Link Intelligence", () => {
  const dummyProfile: UserProfile = {
    id: "user-test-1",
    name: "Mukasa",
    dateOfBirth: "1990-01-01",
    gender: "male",
  };

  it("returns natural tone mid-sentence link for interactions without cross-contaminating", async () => {
    const queries = [
      "Can you give me a link to the interactions page?",
      "Where do I check drug interactions?",
      "Show me the food safety guard page",
      "Link to interactions",
    ];

    for (const query of queries) {
      const response = await generateDawaGPTResponse(
        query,
        null,
        dummyProfile,
        [],
        [],
        [],
        [],
        null,
        "/dashboard"
      );

      expect(response.text).toContain("[check your drug & food interactions](/interactions)");
      expect(response.text).not.toContain("/family");
      expect(response.text).not.toContain("/family-hub");
      expect(response.text).not.toContain("/medvault");
    }
  });

  it("returns natural tone link for Med Vault", async () => {
    const response = await generateDawaGPTResponse(
      "Where is the Med Vault page?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[check your pill stock in Med Vault](/medvault)");
    expect(response.text).not.toContain("/family");
  });

  it("returns natural tone links for reminders", async () => {
    const response = await generateDawaGPTResponse(
      "Give me a link to my reminders page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[manage your active alarms in Medication Reminders](/reminders)");
    expect(response.text).toContain("[set up a new reminder](/reminders/new)");
  });

  it("returns natural tone link for medications directory", async () => {
    const response = await generateDawaGPTResponse(
      "Show me the medications list page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[view your active prescriptions in My Medications](/medications)");
  });

  it("returns natural tone link for dose history", async () => {
    const response = await generateDawaGPTResponse(
      "Where can I see my dose history logs?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[review your past logs in Dose History](/history)");
  });

  it("returns natural tone link for wellness hub", async () => {
    const response = await generateDawaGPTResponse(
      "Take me to the wellness page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[log your symptoms and daily vibe in Wellness Hub](/wellness)");
  });

  it("returns natural tone link for travel companion", async () => {
    const response = await generateDawaGPTResponse(
      "Give me a link to the travel companion page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[calculate your travel medicine supply in Travel Companion](/travel)");
  });

  it("returns natural tone link for doctor report", async () => {
    const response = await generateDawaGPTResponse(
      "How do I open the doctor report export page?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[export an adherence report for your doctor](/report)");
  });

  it("returns natural tone link for scanner", async () => {
    const response = await generateDawaGPTResponse(
      "Open the camera scanner page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[take a photo to scan your medicine in Visual Scanner](/scan)");
  });

  it("returns natural tone link for drug search", async () => {
    const response = await generateDawaGPTResponse(
      "Where is the medication search page?",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[look up clinical drug facts in Search Medications](/search)");
  });

  it("returns natural tone link for settings", async () => {
    const response = await generateDawaGPTResponse(
      "Link to my account settings page",
      null,
      dummyProfile,
      [],
      [],
      [],
      [],
      null,
      "/dashboard"
    );

    expect(response.text).toContain("[manage your profile and preferences in Settings](/settings)");
  });
});

describe("MessageRenderer — Natural Mid-Sentence Links & Route Resolution", () => {
  it("resolves exact and alias routes to correct internal links", () => {
    const testMarkdown = `
      Check [Interactions](/interactions) or [Safety Guard](/safety-guard).
      Manage in [Med Vault](/medvault) or [Pill Tracker](/pill-tracker).
      View [My Medications](/medications).
      Generate [Doctor Report](/doctor-report).
      Family in [Family Hub](/family-hub).
    `;

    render(
      <MemoryRouter>
        <MessageRenderer text={testMarkdown} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Interactions/i })).toHaveAttribute("href", "/interactions");
    expect(screen.getByRole("link", { name: /Safety Guard/i })).toHaveAttribute("href", "/interactions");
    expect(screen.getByRole("link", { name: /Med Vault/i })).toHaveAttribute("href", "/medvault");
    expect(screen.getByRole("link", { name: /Pill Tracker/i })).toHaveAttribute("href", "/medvault");
    expect(screen.getByRole("link", { name: /My Medications/i })).toHaveAttribute("href", "/medications");
    expect(screen.getByRole("link", { name: /Doctor Report/i })).toHaveAttribute("href", "/report");
    expect(screen.getByRole("link", { name: /Family Hub/i })).toHaveAttribute("href", "/family");
  });

  it("renders natural language conversational phrases mid-sentence seamlessly", () => {
    const naturalMarkdown = `
      You have 3 prescriptions active today—let's [check your meds](/medications) before taking dinner.
      Also, would you like to [add a family member](/family) so we can monitor their blood pressure?
      Before taking Waragi or herbal tea, remember to [check drug & food interactions](/interactions) for safety warnings.
      You're almost out of Metformin, so make sure to [review your pill stock](/medvault) soon!
    `;

    render(
      <MemoryRouter>
        <MessageRenderer text={naturalMarkdown} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /check your meds/i })).toHaveAttribute("href", "/medications");
    expect(screen.getByRole("link", { name: /add a family member/i })).toHaveAttribute("href", "/family");
    expect(screen.getByRole("link", { name: /check drug & food interactions/i })).toHaveAttribute("href", "/interactions");
    expect(screen.getByRole("link", { name: /review your pill stock/i })).toHaveAttribute("href", "/medvault");
  });
});
