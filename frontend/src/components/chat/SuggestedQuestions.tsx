interface Props {
  suggestions: string[];
  onSelect: (question: string) => void;
  disabled: boolean;
}

export default function SuggestedQuestions({
  suggestions,
  onSelect,
  disabled,
}: Props) {
  if (suggestions.length === 0) return null;

  return (
    <section className="suggested-questions">
      <p className="eyebrow">SUGGESTED / QUERIES</p>

      <div className="suggestion-list">
        {suggestions.map((question, index) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
          >
            <span>
              {String(index + 1).padStart(2, "0")}
            </span>
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}