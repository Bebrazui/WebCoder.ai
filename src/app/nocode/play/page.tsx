// src/app/nocode/play/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { User, CircleDollarSign, Ghost, Crown, XCircle, LoaderCircle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';

const TILE_TYPES = {
  EMPTY: 0,
  PLAYER: 1,
  WALL: 2,
  COIN: 3,
  ENEMY: 4,
} as const;

type TileTypeKey = keyof typeof TILE_TYPES;
type TileValue = (typeof TILE_TYPES)[TileTypeKey];

const TILE_COMPONENTS: Record<TileValue, React.FC<{ className?: string }>> = {
  [TILE_TYPES.EMPTY]: () => null,
  [TILE_TYPES.PLAYER]: ({ className }) => <User className={cn("h-full w-full p-0.5 text-blue-500", className)} />,
  [TILE_TYPES.WALL]: ({ className }) => null, // Walls are just background
  [TILE_TYPES.COIN]: ({ className }) => <CircleDollarSign className={cn("h-full w-full p-1 text-yellow-500", className)} />,
  [TILE_TYPES.ENEMY]: ({ className }) => <Ghost className={cn("h-full w-full p-0.5 text-red-500", className)} />,
};


interface LevelData {
    grid: TileValue[];
    size: number;
    textures: Record<string, string>;
}

const useGameLogic = (initialLevelData: LevelData | null) => {
    const [levelData, setLevelData] = useState(initialLevelData);
    const [playerPos, setPlayerPos] = useState(-1);
    const [coins, setCoins] = useState<number[]>([]);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

    useEffect(() => {
        if (!levelData) return;
        const pPos = levelData.grid.indexOf(TILE_TYPES.PLAYER);
        setPlayerPos(pPos);
        
        const coinIndices = levelData.grid.reduce((acc: number[], tile, index) => {
            if (tile === TILE_TYPES.COIN) acc.push(index);
            return acc;
        }, []);
        setCoins(coinIndices);
        setGameState('playing');
    }, [levelData]);

    const movePlayer = useCallback((dx: number, dy: number) => {
        if (gameState !== 'playing' || !levelData) return;

        const { size, grid } = levelData;
        const x = playerPos % size;
        const y = Math.floor(playerPos / size);

        const newX = x + dx;
        const newY = y + dy;

        if (newX < 0 || newX >= size || newY < 0 || newY >= size) return; // Out of bounds

        const newPos = newY * size + newX;
        const targetTile = grid[newPos];

        if (targetTile === TILE_TYPES.WALL) return; // Can't move into walls

        setPlayerPos(newPos);

        if (targetTile === TILE_TYPES.COIN) {
            const newCoins = coins.filter(c => c !== newPos);
            setCoins(newCoins);
            if (newCoins.length === 0) {
                setGameState('won');
            }
        } else if (targetTile === TILE_TYPES.ENEMY) {
            setGameState('lost');
        }
    }, [playerPos, coins, gameState, levelData]);
    
    const resetGame = useCallback(() => {
        setLevelData(initialLevelData);
    }, [initialLevelData]);

    return { playerPos, coins, gameState, movePlayer, resetGame };
}

export default function PlayPage() {
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = localStorage.getItem('nocodeh-level-data');
      if (!data) {
        throw new Error("No level data found in storage. Please create a level in the editor first.");
      }
      setLevelData(JSON.parse(data));
    } catch (e: any) {
      setError(`Failed to load level data: ${e.message}`);
    }
  }, []);

  const { playerPos, coins, gameState, movePlayer, resetGame } = useGameLogic(levelData);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState !== 'playing') return;
        switch (e.key) {
            case 'w': case 'ArrowUp': movePlayer(0, -1); break;
            case 's': case 'ArrowDown': movePlayer(0, 1); break;
            case 'a': case 'ArrowLeft': movePlayer(-1, 0); break;
            case 'd': case 'ArrowRight': movePlayer(1, 0); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer, gameState]);
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8 text-center">
        <Alert variant="destructive" className="max-w-md bg-red-900/50 border-red-500 text-white">
            <Gamepad2 className="h-4 w-4" />
            <AlertTitle>Error Loading Game</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
        <Button asChild className="mt-4"><Link href="/nocode">Back to Editor</Link></Button>
      </div>
    );
  }

  if (!levelData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8 text-center">
        <LoaderCircle className="mx-auto h-24 w-24 mb-6 text-purple-400 animate-spin" />
        <h1 className="text-3xl font-bold font-headline">Loading Level...</h1>
      </div>
    );
  }
  
  const Tile = ({ tileType, isPlayerHere, isCoinHere, textures }: { tileType: TileValue, isPlayerHere: boolean, isCoinHere: boolean, textures: Record<string, string>}) => {
    const tileTypeKey = Object.keys(TILE_TYPES).find(key => TILE_TYPES[key as TileTypeKey] === tileType) as TileTypeKey | undefined;
    const texture = tileTypeKey ? textures[tileTypeKey] : undefined;
    const WallIcon = TILE_COMPONENTS[TILE_TYPES.WALL];

    return (
        <div 
          className="aspect-square flex items-center justify-center relative bg-gray-800 bg-cover bg-center"
          style={{ backgroundImage: tileType === TILE_TYPES.WALL && texture ? `url(${texture})` : 'none' }}
        >
          {tileType === TILE_TYPES.WALL && !texture && <WallIcon />}
          {isPlayerHere && (
              textures.PLAYER ? <Image src={textures.PLAYER} layout="fill" objectFit="contain" alt="player"/> : <TILE_COMPONENTS[TILE_TYPES.PLAYER] />
          )}
          {isCoinHere && (
              textures.COIN ? <Image src={textures.COIN} layout="fill" objectFit="contain" alt="coin"/> : <TILE_COMPONENTS[TILE_TYPES.COIN] />
          )}
           {tileType === TILE_TYPES.ENEMY && (
              textures.ENEMY ? <Image src={textures.ENEMY} layout="fill" objectFit="contain" alt="enemy"/> : <TILE_COMPONENTS[TILE_TYPES.ENEMY] />
          )}
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-body">
        <h1 className="text-4xl font-bold font-headline mb-4 text-purple-400">No-Code Game</h1>
        <div 
          className="grid relative border-4 border-purple-600 rounded-lg overflow-hidden shadow-2xl"
          style={{ gridTemplateColumns: `repeat(${levelData.size}, 1fr)`, width: 'min(80vw, 80vh)', maxWidth: '800px'}}
        >
            {levelData.grid.map((tile, index) => (
                <Tile 
                    key={index} 
                    tileType={tile} 
                    isPlayerHere={index === playerPos}
                    isCoinHere={coins.includes(index)}
                    textures={levelData.textures}
                />
            ))}

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
                        <Button size="lg" onClick={resetGame}>Play Again</Button>
                        <Button size="lg" variant="secondary" asChild><Link href="/nocode">Back to Editor</Link></Button>
                    </div>
                </div>
            )}
        </div>
        <div className="mt-6 text-center text-muted-foreground">
            <p>Use Arrow Keys or WASD to move.</p>
            <p>Collect all the coins!</p>
        </div>
    </div>
  );
}
