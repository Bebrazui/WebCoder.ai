// src/app/nocode/page.tsx
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User, BrickWall, CircleDollarSign, Ghost, Eraser, Play, HelpCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const TILE_TYPES = {
  EMPTY: 0,
  PLAYER: 1,
  WALL: 2,
  COIN: 3,
  ENEMY: 4,
} as const;

type TileType = keyof typeof TILE_TYPES;
type TileValue = (typeof TILE_TYPES)[TileType];

const TILE_COMPONENTS: Record<TileValue, React.FC<{ className?: string }>> = {
  [TILE_TYPES.EMPTY]: () => null,
  [TILE_TYPES.PLAYER]: ({ className }) => <User className={cn("h-6 w-6 text-blue-500", className)} />,
  [TILE_TYPES.WALL]: ({ className }) => <BrickWall className={cn("h-6 w-6 text-gray-600", className)} />,
  [TILE_TYPES.COIN]: ({ className }) => <CircleDollarSign className={cn("h-6 w-6 text-yellow-500", className)} />,
  [TILE_TYPES.ENEMY]: ({ className }) => <Ghost className={cn("h-6 w-6 text-red-500", className)} />,
};

const PALETTE_ITEMS: { name: Exclude<TileType, 'EMPTY'> | 'ERASER'; icon: React.ReactNode; value: TileValue | 'ERASER' }[] = [
  { name: 'PLAYER', icon: <User />, value: TILE_TYPES.PLAYER },
  { name: 'WALL', icon: <BrickWall />, value: TILE_TYPES.WALL },
  { name: 'COIN', icon: <CircleDollarSign />, value: TILE_TYPES.COIN },
  { name: 'ENEMY', icon: <Ghost />, value: TILE_TYPES.ENEMY },
  { name: 'ERASER', icon: <Eraser />, value: 'ERASER' },
];

const GRID_SIZE = 16;
const defaultGrid = Array(GRID_SIZE * GRID_SIZE).fill(TILE_TYPES.EMPTY);

export default function NoCodeHPage() {
  const [grid, setGrid] = useState<TileValue[]>(defaultGrid);
  const [activeBrush, setActiveBrush] = useState<TileValue | 'ERASER'>(TILE_TYPES.WALL);
  const [isPainting, setIsPainting] = useState(false);

  const handleTileClick = (index: number) => {
    const newGrid = [...grid];
    const valueToSet = activeBrush === 'ERASER' ? TILE_TYPES.EMPTY : activeBrush;
    
    // Ensure only one player
    if (valueToSet === TILE_TYPES.PLAYER) {
      const playerIndex = newGrid.findIndex(tile => tile === TILE_TYPES.PLAYER);
      if (playerIndex !== -1) {
        newGrid[playerIndex] = TILE_TYPES.EMPTY;
      }
    }

    newGrid[index] = valueToSet;
    setGrid(newGrid);
  };

  const handleTileInteraction = (index: number, isClick: boolean) => {
    if (isClick || isPainting) {
      handleTileClick(index);
    }
  };

  const handleLaunchGame = () => {
    const hasPlayer = grid.some(tile => tile === TILE_TYPES.PLAYER);
    if (!hasPlayer) {
      alert("Please place a player on the grid before launching the game.");
      return;
    }
    const levelData = {
      grid,
      size: GRID_SIZE,
    };
    localStorage.setItem('nocodeh-level-data', JSON.stringify(levelData));
    window.open('/nocode/play', '_blank');
  };

  const Tile = useMemo(() => ({ value, index }: { value: TileValue; index: number }) => {
    const TileIcon = TILE_COMPONENTS[value];
    return (
      <div
        onMouseDown={() => { setIsPainting(true); handleTileInteraction(index, true); }}
        onMouseEnter={() => handleTileInteraction(index, false)}
        className="aspect-square border border-muted-foreground/20 flex items-center justify-center cursor-pointer hover:bg-accent"
      >
        <TileIcon />
      </div>
    );
  }, [isPainting]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background text-foreground p-4 gap-4" onMouseUp={() => setIsPainting(false)}>
      <Card className="w-full lg:w-72 flex-shrink-0">
        <CardHeader>
          <CardTitle>NoCodeH Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>How to Use</AlertTitle>
            <AlertDescription>
              Select a tool from the palette and click or drag on the grid to design your level. Click "Launch Game" to play!
            </AlertDescription>
          </Alert>
          <div>
            <h3 className="font-semibold mb-2">Palette</h3>
            <div className="grid grid-cols-3 gap-2">
              {PALETTE_ITEMS.map(item => (
                <Button
                  key={item.name}
                  variant={activeBrush === item.value ? 'secondary' : 'outline'}
                  onClick={() => setActiveBrush(item.value)}
                  className="flex flex-col h-20"
                >
                  {item.icon}
                  <span className="text-xs mt-1">{item.name}</span>
                </Button>
              ))}
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={handleLaunchGame}>
            <Play className="mr-2" />
            Launch Game
          </Button>
           <Button size="lg" variant="destructive" className="w-full" onClick={() => setGrid(defaultGrid)}>
            Clear Grid
          </Button>
        </CardContent>
      </Card>
      
      <div className="flex-grow flex items-center justify-center bg-muted/30 rounded-lg p-4">
          <div 
            className="grid"
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: '100%',
              maxWidth: 'calc(90vh - 8rem)', // Prevent grid from becoming too large
              aspectRatio: '1 / 1'
            }}
            onMouseLeave={() => setIsPainting(false)}
          >
              {grid.map((tile, index) => (
                  <Tile key={index} value={tile} index={index} />
              ))}
          </div>
      </div>
    </div>
  );
}
