// src/app/nocode/game/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User, CircleDollarSign, Ghost, Crown, XCircle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useVfsForPage } from '@/hooks/use-vfs-for-page';
import Image from 'next/image';

const TILE_SIZE = 32;

const TILE_TYPES = {
  EMPTY: 0,
  PLAYER: 1,
  WALL: 2,
  COIN: 3,
  ENEMY: 4,
} as const;

type TileTypeKey = keyof typeof TILE_TYPES;
type TileValue = (typeof TILE_TYPES)[TileTypeKey];

interface GameObject {
  id: string;
  type: TileTypeKey;
  x: number;
  y: number;
}

export interface LevelData {
  name: string;
  grid: TileValue[][];
  objects: GameObject[];
  textures: { [key in TileTypeKey]?: string };
}


const useGameLoop = (
  initialLevelData: LevelData,
  setGameState: (state: 'playing' | 'won' | 'lost') => void,
  setScore: (score: number) => void
) => {
  const [objects, setObjects] = useState(initialLevelData.objects);
  const playerRef = useRef(initialLevelData.objects.find(o => o.type === 'PLAYER'));

  const movePlayer = useCallback((dx: number, dy: number) => {
    if (!playerRef.current) return;
    
    const newX = playerRef.current.x + dx;
    const newY = playerRef.current.y + dy;

    // Boundary checks
    if (newX < 0 || newX >= initialLevelData.grid[0].length || newY < 0 || newY >= initialLevelData.grid.length) {
      return;
    }

    const collisionObject = objects.find(o => o.x === newX && o.y === newY);

    if (collisionObject) {
      if (collisionObject.type === 'WALL') return; // Can't move into walls
      if (collisionObject.type === 'ENEMY') {
        setGameState('lost');
        return;
      }
      if (collisionObject.type === 'COIN') {
        // Collect coin
        setObjects(prev => prev.filter(o => o.id !== collisionObject.id));
        setScore(prev => prev + 1);
      }
    }

    // Update player position
    const newPlayer = { ...playerRef.current, x: newX, y: newY };
    playerRef.current = newPlayer;
    setObjects(prev => prev.map(o => o.id === newPlayer.id ? newPlayer : o));
  }, [objects, initialLevelData.grid, setGameState, setScore]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer]);

  useEffect(() => {
    // Check for win condition
    const remainingCoins = objects.filter(o => o.type === 'COIN').length;
    if (remainingCoins === 0) {
      setGameState('won');
    }
  }, [objects, setGameState]);

  return objects;
};

export default function NoCodeGamePage() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [score, setScore] = useState(0);

  useEffect(() => {
    const data = localStorage.getItem('nocode_level_data');
    if (data) {
      const parsedData = JSON.parse(data) as LevelData;
      setLevelData(parsedData);
      setScore(0);
      setGameState('playing');
    }
  }, []);

  const objects = useGameLoop(levelData!, setGameState, setScore);

  const handleReset = () => {
    // Re-read from local storage to reset state
    const data = localStorage.getItem('nocode_level_data');
    if (data) {
      const parsedData = JSON.parse(data) as LevelData;
      setLevelData(parsedData);
      setScore(0);
      setGameState('playing');
    }
  };
  
  if (!levelData) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><p>Loading level...</p></div>;
  }
  
  const totalCoins = useMemo(() => levelData.objects.filter(o => o.type === 'COIN').length, [levelData]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-body">
        <h1 className="text-4xl font-bold font-headline mb-2 text-purple-400">{levelData.name}</h1>
        <p className="text-lg text-muted-foreground mb-4">Coins: {score} / {totalCoins}</p>
        
        <div className="relative border-4 border-purple-600 rounded-lg overflow-hidden shadow-2xl bg-black/50">
             <div className="grid" style={{ gridTemplateColumns: `repeat(${levelData.grid[0].length}, ${TILE_SIZE}px)`, gridTemplateRows: `repeat(${levelData.grid.length}, ${TILE_SIZE}px)` }}>
                {Array(levelData.grid.length).fill(0).map((_, rowIndex) => (
                    Array(levelData.grid[0].length).fill(0).map((_, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className="w-full h-full bg-black/30" style={{ width: TILE_SIZE, height: TILE_SIZE }} />
                    ))
                ))}

                {objects.map(obj => (
                   <div key={obj.id} className="absolute transition-all duration-200" style={{ left: obj.x * TILE_SIZE, top: obj.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
                     {levelData.textures[obj.type] && (
                       <Image src={levelData.textures[obj.type]!} alt={obj.type} width={TILE_SIZE} height={TILE_SIZE} objectFit="cover" />
                     )}
                   </div>
                ))}
             </div>

            {gameState !== 'playing' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center z-10 p-4 backdrop-blur-sm">
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
                    <div className="flex gap-4 mt-6">
                        <Button size="lg" onClick={handleReset}>Play Again</Button>
                        <Button size="lg" variant="outline" asChild><Link href="/nocode">Back to Editor</Link></Button>
                    </div>
                </div>
            )}
        </div>
        <div className="mt-6 text-center text-muted-foreground">
            <p>Use Arrow Keys to move.</p>
        </div>
    </div>
  );
}
