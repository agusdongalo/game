import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Board = boolean[];

type Position = { row: number; col: number };

type Difficulty = {
  id: string;
  label: string;
  size: number;
  steps: number;
};

const DIFFICULTIES: Difficulty[] = [
  { id: "easy", label: "Easy 4x4", size: 4, steps: 8 },
  { id: "normal", label: "Normal 5x5", size: 5, steps: 14 },
  { id: "hard", label: "Hard 6x6", size: 6, steps: 22 }
];

const BEST_MOVES_KEY = "gearbox-best-moves";

const toIndex = (size: number, row: number, col: number) => row * size + col;

const inBounds = (size: number, row: number, col: number) =>
  row >= 0 && row < size && col >= 0 && col < size;

const togglePositions = (size: number, row: number, col: number): Position[] => [
  { row, col },
  { row: row - 1, col },
  { row: row + 1, col },
  { row, col: col - 1 },
  { row, col: col + 1 }
].filter((pos) => inBounds(size, pos.row, pos.col));

const applyToggle = (board: Board, size: number, row: number, col: number): Board => {
  const next = [...board];
  for (const pos of togglePositions(size, row, col)) {
    const idx = toIndex(size, pos.row, pos.col);
    next[idx] = !next[idx];
  }
  return next;
};

const makeScrambledBoard = (size: number, steps: number): Board => {
  let board = Array.from({ length: size * size }, () => false);
  for (let i = 0; i < steps; i += 1) {
    const row = Math.floor(Math.random() * size);
    const col = Math.floor(Math.random() * size);
    board = applyToggle(board, size, row, col);
  }
  return board;
};

const getDifficulty = (id: string) =>
  DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1];

const solveBoard = (board: Board, size: number): Board | null => {
  const total = size * size;
  const matrix: number[][] = Array.from({ length: total }, (_, rowIndex) => {
    const row = Math.floor(rowIndex / size);
    const col = rowIndex % size;
    const rowData = Array.from({ length: total + 1 }, () => 0);

    for (const pos of togglePositions(size, row, col)) {
      const idx = toIndex(size, pos.row, pos.col);
      rowData[idx] = 1;
    }

    rowData[total] = board[rowIndex] ? 1 : 0;
    return rowData;
  });

  let lead = 0;
  for (let r = 0; r < total; r += 1) {
    if (lead >= total) break;
    let i = r;
    while (i < total && matrix[i][lead] === 0) {
      i += 1;
    }
    if (i === total) {
      lead += 1;
      r -= 1;
      continue;
    }

    [matrix[i], matrix[r]] = [matrix[r], matrix[i]];

    for (let j = 0; j < total; j += 1) {
      if (j !== r && matrix[j][lead] === 1) {
        for (let k = lead; k <= total; k += 1) {
          matrix[j][k] ^= matrix[r][k];
        }
      }
    }

    lead += 1;
  }

  for (let r = 0; r < total; r += 1) {
    const allZero = matrix[r].slice(0, total).every((value) => value === 0);
    if (allZero && matrix[r][total] === 1) {
      return null;
    }
  }

  const solution = Array.from({ length: total }, () => false);
  for (let r = 0; r < total; r += 1) {
    const pivotIndex = matrix[r].findIndex((value, idx) => idx < total && value === 1);
    if (pivotIndex >= 0) {
      solution[pivotIndex] = matrix[r][total] === 1;
    }
  }

  return solution;
};

export default function App() {
  const [difficultyId, setDifficultyId] = useState("normal");
  const difficulty = getDifficulty(difficultyId);
  const [board, setBoard] = useState<Board>(() =>
    makeScrambledBoard(difficulty.size, difficulty.steps)
  );
  const [moves, setMoves] = useState(0);
  const [scrambleCount, setScrambleCount] = useState(1);
  const [bestMoves, setBestMoves] = useState<Record<string, number>>({});
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState<Board | null>(null);
  const [solutionMessage, setSolutionMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(BEST_MOVES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setBestMoves(parsed);
        }
      } catch {
        setBestMoves({});
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BEST_MOVES_KEY, JSON.stringify(bestMoves));
  }, [bestMoves]);

  useEffect(() => {
    setBoard(makeScrambledBoard(difficulty.size, difficulty.steps));
    setMoves(0);
    setScrambleCount(1);
    setShowSolution(false);
    setSolution(null);
    setSolutionMessage("");
  }, [difficulty.id, difficulty.size, difficulty.steps]);

  const litCount = useMemo(() => board.filter(Boolean).length, [board]);
  const solved = litCount === 0;
  const bestForDifficulty = bestMoves[difficulty.id];

  const handleToggle = (row: number, col: number) => {
    if (solved) return;
    const nextBoard = applyToggle(board, difficulty.size, row, col);
    const nextMoves = moves + 1;
    setBoard(nextBoard);
    setMoves(nextMoves);
    setShowSolution(false);

    if (nextBoard.every((cell) => !cell)) {
      setBestMoves((prev) => {
        const currentBest = prev[difficulty.id];
        if (!currentBest || nextMoves < currentBest) {
          return { ...prev, [difficulty.id]: nextMoves };
        }
        return prev;
      });
    }
  };

  const handleNewPuzzle = () => {
    setBoard(makeScrambledBoard(difficulty.size, difficulty.steps));
    setMoves(0);
    setScrambleCount((prev) => prev + 1);
    setShowSolution(false);
    setSolution(null);
    setSolutionMessage("");
  };

  const handleReset = () => {
    setBoard(makeScrambledBoard(difficulty.size, difficulty.steps));
    setMoves(0);
    setShowSolution(false);
    setSolution(null);
    setSolutionMessage("");
  };

  const handleSolution = () => {
    if (showSolution) {
      setShowSolution(false);
      return;
    }

    const solvedPattern = solveBoard(board, difficulty.size);
    if (solvedPattern) {
      setSolution(solvedPattern);
      setSolutionMessage("Press the highlighted switches to clear the panel.");
    } else {
      setSolution(null);
      setSolutionMessage("No solution for this scramble. Try New Puzzle.");
    }
    setShowSolution(true);
  };

  const cellMin = difficulty.size <= 5 ? 52 : 44;

  return (
    <div className="workshop">
      <main className="console">
        <header className="header">
          <div>
            <p className="eyebrow">Puzzle Console</p>
            <h1>Gearbox Grid</h1>
            <p className="subtitle">
              Toggle switches to kill every light. Pressing a switch flips itself and its
              neighbors.
            </p>
          </div>
          <div className="stats">
            <div>
              <span className="label">Panel</span>
              <span className="value">#{scrambleCount}</span>
            </div>
            <div>
              <span className="label">Moves</span>
              <span className="value">{moves}</span>
            </div>
            <div>
              <span className="label">Best</span>
              <span className="value">{bestForDifficulty ?? "--"}</span>
            </div>
            <div>
              <span className="label">Lit</span>
              <span className="value">{litCount}</span>
            </div>
          </div>
        </header>

        <section className="controls">
          <label className="control">
            <span>Difficulty</span>
            <select
              value={difficulty.id}
              onChange={(event) => setDifficultyId(event.target.value)}
            >
              {DIFFICULTIES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="action" onClick={handleSolution}>
            {showSolution ? "Hide Solution" : "Show Solution"}
          </button>
          {solutionMessage ? <p className="hint">{solutionMessage}</p> : null}
        </section>

        <section className="board" role="grid" aria-label="Gearbox grid">
          {Array.from({ length: difficulty.size }).map((_, row) => (
            <div
              className="row"
              role="row"
              key={`row-${row}`}
              style={{
                gridTemplateColumns: `repeat(${difficulty.size}, minmax(${cellMin}px, 1fr))`
              }}
            >
              {Array.from({ length: difficulty.size }).map((__, col) => {
                const idx = toIndex(difficulty.size, row, col);
                const active = board[idx];
                const highlight = showSolution && solution?.[idx];
                return (
                  <button
                    key={`cell-${row}-${col}`}
                    type="button"
                    role="gridcell"
                    aria-pressed={active}
                    className={`cell ${active ? "on" : "off"} ${highlight ? "solution" : ""}`}
                    onClick={() => handleToggle(row, col)}
                  >
                    <span className="dial" />
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        <footer className="footer">
          <div className="status">
            {solved ? "Panel stabilized. All lights are down." : "Power is unstable."}
          </div>
          <div className="actions">
            <button type="button" className="action" onClick={handleReset}>
              Reset
            </button>
            <button type="button" className="action primary" onClick={handleNewPuzzle}>
              New Puzzle
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
