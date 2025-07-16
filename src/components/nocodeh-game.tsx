// src/components/nocodeh-game.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { User, BrickWall, CircleDollarSign, Ghost, Crown, XCircle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const TILE_TYPES = {
  EMPTY: 0,
  PLAYER: 1,
  WALL: 2,
  COIN: 3,
  ENEMY: 4,
} as const;

type TileValue = (typeof TILE_TYPES)[keyof typeof TILE_TYPES];

const TILE_COMPONENTS: Record<TileValue, React.FC<{ className?: string }>> = {
  [TILE_TYPES.EMPTY]: () => null,
  [TILE_TYPES.PLAYER]: ({ className }) => <User className={cn("h-full w-full p-1 text-blue-400 transition-all duration-200", className)} />,
  [TILE_TYPES.WALL]: ({ className }) => <div className="h-full w-full bg-gray-700" />,
  [TILE_TYPES.COIN]: ({ className }) => <CircleDollarSign className={cn("h-full w-full p-1.5 text-yellow-400 animate-pulse", className)} />,
  [TILE_TYPES.ENEMY]: ({ className }) => <Ghost className={cn("h-full w-full p-1 text-red-500", className)} />,
};

export interface LevelData {
  grid: TileValue[];
  size: number;
}

interface NoCodeHGameProps {
  initialLevelData: LevelData;
}

export function NoCodeHGame({ initialLevelData }: NoCodeHGameProps) {
  const [grid, setGrid] = useState<TileValue[]>(initialLevelData.grid);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  // Game logic now validates the level data itself.
  const initialPlayerIndex = useMemo(() => initialLevelData.grid.findIndex(tile => tile === TILE_TYPES.PLAYER), [initialLevelData.grid]);

  const { size } = initialLevelData;
  const initialPlayerPos = useMemo(() => {
    if (initialPlayerIndex === -1) return null;
    return {
      x: initialPlayerIndex % size,
      y: Math.floor(initialPlayerIndex / size),
    };
  }, [initialPlayerIndex, size]);
  
  const [playerPos, setPlayerPos] = useState(initialPlayerPos);

  const totalCoins = useMemo(() => initialLevelData.grid.filter(tile => tile === TILE_TYPES.COIN).length, [initialLevelData.grid]);

  const movePlayer = useCallback((dx: number, dy: number) => {
    if (gameState !== 'playing' || !playerPos) return;

    setPlayerPos(prevPos => {
      if (!prevPos) return null;

      const newX = prevPos.x + dx;
      const newY = prevPos.y + dy;
      const newIndex = newY * size + newX;

      if (newX < 0 || newX >= size || newY < 0 || newY >= size) {
        return prevPos; // Out of bounds
      }

      const targetTile = grid[newIndex];
      if (targetTile === TILE_TYPES.WALL) {
        return prevPos; // Can't move into a wall
      }

      const newGrid = [...grid];
      newGrid[prevPos.y * size + prevPos.x] = TILE_TYPES.EMPTY; // Clear old position
      
      if (targetTile === TILE_TYPES.COIN) {
        setScore(s => s + 1);
      }
      
      if (targetTile === TILE_TYPES.ENEMY) {
          setGameState('lost');
          newGrid[newIndex] = TILE_TYPES.PLAYER; // Move player to enemy spot before game over
      } else {
          newGrid[newIndex] = TILE_TYPES.PLAYER; // Move player
      }

      setGrid(newGrid);
      return { x: newX, y: newY };
    });
  }, [grid, size, gameState, playerPos]);

  useEffect(() => {
    if (totalCoins > 0 && score === totalCoins) {
      setGameState('won');
    }
  }, [score, totalCoins]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer]);
  
  const resetGame = () => {
      setGrid(initialLevelData.grid);
      setScore(0);
      setPlayerPos(initialPlayerPos);
      setGameState('playing');
  }

  // If there's no player, the game is unplayable. Show an error screen.
  if (!playerPos) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8 text-center">
            <Alert variant="destructive" className="max-w-md">
                <Gamepad2 className="h-4 w-4" />
                <AlertTitle>Cannot Start Game</AlertTitle>
                <AlertDescription>
                    No player start position was found on the level grid. Please add a player in the editor.
                </AlertDescription>
            </Alert>
            <Link href="/nocode" passHref>
                <Button className="mt-6">Back to Editor</Button>
            </Link>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-body">
        <h1 className="text-4xl font-bold font-headline mb-2 text-purple-400">NoCodeH Game</h1>
        <p className="text-lg text-muted-foreground mb-4">Score: {score} / {totalCoins}</p>
        
        <div className="relative border-4 border-purple-600 rounded-lg overflow-hidden shadow-2xl bg-black">
             <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${size}, 1fr)`,
                  width: 'min(80vw, 80vh)',
                  height: 'min(80vw, 80vh)',
                }}
              >
                {grid.map((tile, index) => {
                  const TileIcon = TILE_COMPONENTS[tile];
                  return (
                    <div key={index} className="flex items-center justify-center bg-gray-800 border border-gray-700/50">
                        <TileIcon />
                    </div>
                  );
                })}
              </div>

              {gameState !== 'playing' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center z-10 p-4">
                      {gameState === 'won' ? (
                          <>
                            <Crown className="h-24 w-24 text-yellow-400 mb-4" />
                            <h2 className="text-5xl font-bold">You Win!</h2>
                          </>
                      ) : (
                          <>
                            <XCircle className="h-24 w-24 text-red-500 mb-4" />
                            <h2 className="text-5xl font-bold">Game Over</h2>
                          </>
                      )}
                      <p className="text-xl mt-2">Your final score: {score}</p>
                      <div className="flex gap-4 mt-6">
                        <Button size="lg" onClick={resetGame}>Play Again</Button>
                        <Link href="/nocode" passHref>
                            <Button size="lg" variant="secondary">Back to Editor</Button>
                        </Link>
                      </div>
                  </div>
              )}
        </div>
        <div className="mt-6 text-center text-muted-foreground">
            <p>Use Arrow Keys or WASD to move.</p>
        </div>
    </div>
  );
}
