import { useEffect, useMemo, useRef, useState } from "react";
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
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const [showWinModal, setShowWinModal] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);

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
    const audio = new Audio("/bg.wav");
    audio.loop = true;
    audio.volume = 1.0;
    bgAudioRef.current = audio;

    const startMusic = () => {
      if (!bgAudioRef.current) return;
      bgAudioRef.current.play().catch(() => undefined);
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
    };

    window.addEventListener("pointerdown", startMusic);
    window.addEventListener("keydown", startMusic);

    return () => {
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
      bgAudioRef.current?.pause();
      bgAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    setBoard(makeScrambledBoard(difficulty.size, difficulty.steps));
    setMoves(0);
    setScrambleCount(1);
    setShowSolution(false);
    setSolution(null);
    setSolutionMessage("");
    setShowWinModal(false);
    setHasCelebrated(false);
  }, [difficulty.id, difficulty.size, difficulty.steps]);

  const litCount = useMemo(() => board.filter(Boolean).length, [board]);
  const solved = litCount === 0;
  const bestForDifficulty = bestMoves[difficulty.id];

  useEffect(() => {
    if (solved && !hasCelebrated) {
      setShowWinModal(true);
      setHasCelebrated(true);
      const audio = new Audio("/win.wav");
      audio.volume = 0.6;
      audio.play().catch(() => undefined);
    }
  }, [hasCelebrated, solved]);

  useEffect(() => {
    if (!showDifficultyPicker) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDifficultyPicker(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDifficultyPicker]);

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
    setShowWinModal(false);
    setHasCelebrated(false);
  };

  const handleReset = () => {
    setBoard(makeScrambledBoard(difficulty.size, difficulty.steps));
    setMoves(0);
    setShowSolution(false);
    setSolution(null);
    setSolutionMessage("");
    setShowWinModal(false);
    setHasCelebrated(false);
  };

  const handleSolution = () => {
    if (showSolution) {
      setShowSolution(false);
      return;
    }

    const solvedPattern = solveBoard(board, difficulty.size);
    if (solvedPattern) {
      setSolution(solvedPattern);
      setSolutionMessage("Press the highlighted switches");
    } else {
      setSolution(null);
      setSolutionMessage("No solution for this scramble. Try New Puzzle.");
    }
    setShowSolution(true);
  };

  const cellMin = difficulty.size <= 5 ? 52 : 44;

  return (
    <div className="workshop">
      {showWinModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="fireworks" aria-hidden="true">
            <span className="firework f1 cyan" />
            <span className="firework f2 gold" />
            <span className="firework f3 violet" />
            <span className="firework f4 cyan" />
            <span className="firework f5 gold" />
            <span className="firework f6 violet" />
            <span className="firework f7 cyan" />
            <span className="firework f8 gold" />
            <span className="firework f9 violet" />
            <span className="firework f10 cyan" />
            <span className="firework f11 gold" />
            <span className="firework f12 violet" />
            <span className="firework f13 cyan" />
            <span className="firework f14 gold" />
            <span className="firework f15 violet" />
            <span className="firework f16 cyan" />
            <span className="firework f17 gold" />
            <span className="firework f18 violet" />
            <span className="firework f19 cyan" />
            <span className="firework f20 gold" />
            <span className="firework f21 violet" />
            <span className="firework f22 cyan" />
            <span className="firework f23 gold" />
            <span className="firework f24 violet" />
            <span className="spark s1 cyan" />
            <span className="spark s2 gold" />
            <span className="spark s3 violet" />
            <span className="spark s4 cyan" />
            <span className="spark s5 gold" />
            <span className="spark s6 violet" />
            <span className="spark s7 cyan" />
            <span className="spark s8 gold" />
            <span className="spark s9 violet" />
            <span className="spark s10 cyan" />
            <span className="spark s11 gold" />
            <span className="spark s12 violet" />
            <span className="spark s13 cyan" />
            <span className="spark s14 gold" />
            <span className="spark s15 violet" />
            <span className="spark s16 cyan" />
            <span className="spark s17 gold" />
            <span className="spark s18 violet" />
            <span className="spark s19 cyan" />
            <span className="spark s20 gold" />
            <span className="spark s21 violet" />
            <span className="spark s22 cyan" />
            <span className="spark s23 gold" />
            <span className="spark s24 violet" />
            <span className="spark s25 cyan" />
            <span className="spark s26 gold" />
            <span className="spark s27 violet" />
            <span className="spark s28 cyan" />
            <span className="spark s29 gold" />
            <span className="spark s30 violet" />
          </div>
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 32 }).map((_, index) => (
              <span key={`confetti-${index}`} className={`confetto c${(index % 6) + 1}`} />
            ))}
          </div>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Puzzle complete"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content">
              <p className="modal-eyebrow">System Status</p>
              <h2>Panel Stabilized</h2>
              <p className="modal-message">
                Congratulations! You killed every light and brought the grid back under control.
              </p>
              <div className="modal-actions">
                <button type="button" className="action" onClick={() => setShowWinModal(false)}>
                  Close
                </button>
                <button type="button" className="action primary" onClick={handleNewPuzzle}>
                  New Puzzle
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <main className="console">
        <header className="header">
          <div className="header-left">
            <p className="eyebrow">Puzzle Console</p>
            <h1>Gearbox Grid</h1>
            <p className="subtitle">
              Toggle switches to kill every light. Pressing a switch flips itself and its
              neighbors.
            </p>
            <div className="header-controls">
              <div className="control-row">
                <label className="control">
                  <span>Difficulty</span>
                  <button
                    type="button"
                    className="difficulty-trigger"
                    onClick={() => setShowDifficultyPicker(true)}
                    aria-haspopup="dialog"
                    aria-expanded={showDifficultyPicker}
                  >
                    {difficulty.label}
                  </button>
                </label>
                <button type="button" className="action solve-button" onClick={handleSolution}>
                  {showSolution ? "Hide Solution" : "Show Solution"}
                </button>
                {solutionMessage ? <p className="hint inline">{solutionMessage}</p> : null}
              </div>
            </div>
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
      {showDifficultyPicker ? (
        <div
          className="picker-backdrop"
          role="presentation"
          onClick={() => setShowDifficultyPicker(false)}
        >
          <div
            className="picker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select difficulty"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="picker-eyebrow">Select Difficulty</p>
            <div className="picker-options" role="listbox" aria-label="Difficulty options">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === difficulty.id}
                  className={`picker-option ${
                    option.id === difficulty.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setDifficultyId(option.id);
                    setShowDifficultyPicker(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="picker-close"
              onClick={() => setShowDifficultyPicker(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      <p className="credit">Built by Don Galo Agus.</p>
    </div>
  );
}
