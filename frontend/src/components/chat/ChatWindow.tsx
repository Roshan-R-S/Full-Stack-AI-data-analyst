import { useLayoutEffect, useRef } from "react";

import type { ChatEntry } from "../../types/chat";
import ChatMessage from "./ChatMessage";

interface Props {
  messages: ChatEntry[];
  loading: boolean;
}

export default function ChatWindow({
  messages,
  loading,
}: Props) {
  const viewportRef = useRef<HTMLElement | null>(null);
  const stickToBottom = useRef(true);
  const previousMessageId = useRef<string | undefined>(
    undefined,
  );

  function handleScroll() {
    const element = viewportRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    // Respect the user's position when reading older messages.
    stickToBottom.current = distanceFromBottom <= 80;
  }

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const lastMessage = messages[messages.length - 1];

    const isNewQuestion =
      lastMessage?.role === "user" &&
      lastMessage.id !== previousMessageId.current;

    // Follow new messages only when appropriate.
    if (stickToBottom.current || isNewQuestion) {
      element.scrollTop = element.scrollHeight;
      stickToBottom.current = true;
    }

    previousMessageId.current = lastMessage?.id;
  }, [messages, loading]);

  return (
    <section
      ref={viewportRef}
      className="chat-window"
      aria-label="AI analyst conversation"
      onScroll={handleScroll}
    >
      {messages.length === 0 && !loading ? (
        <div className="chat-empty">
          <p className="eyebrow">CONVERSATION / READY</p>
          <h2>ASK YOUR DATA.</h2>
          <p>
            Ask an analytical question. Gemini creates
            a plan and Pandas calculates the answer.
          </p>
        </div>
      ) : (
        <div className="chat-messages" role="log">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
            />
          ))}
        </div>
      )}

      {loading && (
        <div className="chat-processing" role="status">
          <div
            className="processing-segments"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className={index < 4 ? "active" : ""}
              />
            ))}
          </div>
          [ANALYZING DATA...]
        </div>
      )}
    </section>
  );
}