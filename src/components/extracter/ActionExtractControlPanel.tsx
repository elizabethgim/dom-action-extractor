type Props = {
  isRunning: boolean;
  onExtract: () => void;
};

export function ActionExtractControlPanel({ isRunning, onExtract }: Props) {
  return (
    <section className="extractPanel">
      <div className="extractControlRow">
        <button
          type="button"
          onClick={onExtract}
          disabled={isRunning}
          className="px-4 py-2 rounded-lg border"
        >
          {isRunning ? 'Extracting...' : 'Action Extract'}
        </button>
      </div>
    </section>
  );
}