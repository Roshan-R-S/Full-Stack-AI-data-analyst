import type { FormEvent, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: (question: string) => void;
  disabled: boolean;
  loading: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  loading,
}: Props) {
  function send() {
    const question = value.trim();

    if (
      !disabled &&
      !loading &&
      question.length >= 5 &&
      question.length <= 500
    ) {
      onSend(question);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    // Ctrl+Enter or Cmd+Enter inserts a newline.
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const input = event.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;

      const updated =
        value.slice(0, start) +
        "\n" +
        value.slice(end);

      if (updated.length > 500) return;

      onChange(updated);

      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(start + 1, start + 1);
      });

      return;
    }

    // Shift+Enter inserts a newline naturally.
    if (event.shiftKey || event.altKey) return;

    // Plain Enter sends the message.
    event.preventDefault();
    send();
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <label htmlFor="ai-question">
        QUESTION / NATURAL LANGUAGE
      </label>

      <textarea
        id="ai-question"
        rows={3}
        minLength={5}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your dataset..."
        disabled={disabled}
        required
      />

      <div className="chat-composer-bottom">
        <span>{value.length} / 500 CHARACTERS</span>

        <button
          className="nd-btn"
          type="submit"
          disabled={
            disabled ||
            loading ||
            value.trim().length < 5
          }
        >
          {loading ? "[ ANALYZING... ]" : "[ ASK AI ]"}
        </button>
      </div>
    </form>
  );
}