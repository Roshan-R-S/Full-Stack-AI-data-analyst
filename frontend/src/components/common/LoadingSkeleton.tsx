type Variant = "table" | "chart" | "list" | "conversation";

interface Props {
  variant: Variant;
  label: string;
}

const barHeights = [36, 62, 48, 80, 55, 90, 68, 43];

export default function LoadingSkeleton({
  variant,
  label,
}: Props) {
  const count =
    variant === "chart" ? 8 :
    variant === "table" ? 6 :
    variant === "conversation" ? 3 : 4;

  return (
    <section
      className={`loading-skeleton loading-skeleton--${variant}`}
      role="status"
      aria-label={label}
    >
      <p className="loading-skeleton-label">
        [ {label.toUpperCase()}... ]
      </p>
      <div className="loading-skeleton-body" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className="loading-skeleton-bar"
            style={
              variant === "chart"
                ? { height: `${barHeights[index]}%` }
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
