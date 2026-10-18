interface Props {
  value: number;
  min: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
}

export default function Stepper({ value, min, max, decreaseLabel, increaseLabel, onChange }: Props) {
  return (
    <div className="stepper">
      <button
        className="stepper-btn"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
      <span className="stepper-value" aria-live="polite">
        {value}
      </span>
      <button
        className="stepper-btn"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
    </div>
  );
}
