// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import ChatWindow from "../components/chat/ChatWindow";
import type { ChatEntry } from "../types/chat";

afterEach(cleanup);

describe("ChatWindow", () => {
  it("shows the empty conversation state accessibly", () => {
    render(<ChatWindow messages={[]} loading={false} />);

    expect(
      screen.getByRole("region", {
        name: "AI analyst conversation",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: "ASK YOUR DATA.",
      }),
    ).toBeTruthy();

    expect(screen.queryByRole("log")).toBeNull();
  });

  it("renders user questions and assistant answers in a log", () => {
    const messages: ChatEntry[] = [
      {
        id: "user-1",
        role: "user",
        content: "How many rows are in this dataset?",
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "**There are 50 rows.**",
        model: "test-model",
      },
    ];

    render(
      <ChatWindow messages={messages} loading={false} />,
    );

    const log = screen.getByRole("log");

    expect(log.textContent).toContain(
      "How many rows are in this dataset?",
    );

    expect(log.textContent).toContain(
      "There are 50 rows.",
    );

    expect(log.textContent).toContain("AI / ANALYST");

    expect(
      log.querySelectorAll("article.chat-entry").length,
    ).toBe(2);
  });

  it("announces the active analysis state", () => {
    render(<ChatWindow messages={[]} loading={true} />);

    const status = screen.getByRole("status");

    expect(status.textContent).toContain(
      "[ANALYZING DATA...]",
    );

    expect(screen.getByRole("log")).toBeTruthy();

    expect(
      screen.queryByRole("heading", {
        name: "ASK YOUR DATA.",
      }),
    ).toBeNull();
  });
});
