// src/app/nocode/page.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User, BrickWall, CircleDollarSign, Ghost, Eraser, Play, HelpCircle, Trash2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

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
  [TILE_TYPES.PLAYER]: ({ className }) => <User className={cn("h-full w-full p-0.5 text-blue-500", className)} />,
  [TILE_TYPES.WALL]: ({ className }) => <BrickWall className={cn("h-full w-full text-gray-600", className)} />,
  [TILE_TYPES.COIN]: ({ className }) => <CircleDollarSign className={cn("h-full w-full p-1 text-yellow-500", className)} />,
  [TILE_TYPES.ENEMY]: ({ className }) => <Ghost className={cn("h-full w-full p-0.5 text-red-500", className)} />,
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
  const { toast } = useToast();

  const handleTileClick = useCallback((index: number) => {
    const newGrid = [...grid];
    const valueToSet = activeBrush === 'ERASER' ? TILE_TYPES.EMPTY : activeBrush;
    
    if (valueToSet === TILE_TYPES.PLAYER) {
      const playerIndex = newGrid.findIndex(tile => tile === TILE_TYPES.PLAYER);
      if (playerIndex !== -1) {
        newGrid[playerIndex] = TILE_TYPES.EMPTY;
      }
    }

    newGrid[index] = valueToSet;
    setGrid(newGrid);
  }, [activeBrush, grid]);

  const handleTileInteraction = useCallback((index: number, isClick: boolean) => {
    if (isClick || isPainting) {
      handleTileClick(index);
    }
  }, [isPainting, handleTileClick]);

  const handleLaunchGame = () => {
    const levelData = {
      grid,
      size: GRID_SIZE,
    };
    localStorage.setItem('nocodeh-level-data', JSON.stringify(levelData));
    window.open('/nocode/play', '_blank');
    toast({
        title: "Game Launched!",
        description: "Your game has been opened in a new tab.",
    })
  };

  const handleClearGrid = () => {
      setGrid(defaultGrid);
      toast({
          title: "Grid Cleared",
          description: "The level has been reset."
      })
  }

  const handleUploadTexture = (itemName: string) => {
      toast({
          title: "Feature Coming Soon!",
          description: `Texture upload for ${itemName} is not yet implemented.`,
      })
  }

  const Tile = useCallback(({ value, index }: { value: TileValue; index: number }) => {
    const TileIcon = TILE_COMPONENTS[value];
    return (
      <div
        onMouseDown={() => { setIsPainting(true); handleTileInteraction(index, true); }}
        onMouseEnter={() => handleTileInteraction(index, false)}
        className="aspect-square border border-muted-foreground/20 flex items-center justify-center cursor-pointer hover:bg-accent transition-colors"
      >
        <TileIcon />
      </div>
    );
  }, [handleTileInteraction]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background text-foreground p-4 gap-6" onMouseUp={() => setIsPainting(false)} onMouseLeave={() => setIsPainting(false)}>
      <Card className="w-full lg:w-96 flex-shrink-0">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-headline">NoCodeH Editor</CardTitle>
          <CardDescription>Design your game level visually.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>How to Use</AlertTitle>
            <AlertDescription>
              Select an item from the palette and click or drag on the grid to design your level. Click "Launch Game" to play!
            </AlertDescription>
          </Alert>
          <div>
            <h3 className="font-semibold mb-3 text-lg">Palette</h3>
            <div className="space-y-2">
              {PALETTE_ITEMS.map(item => (
                <div
                  key={item.name}
                  onClick={() => setActiveBrush(item.value)}
                  className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      activeBrush === item.value ? 'bg-primary/10 border-primary shadow-sm' : 'hover:bg-muted/50'
                  )}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 flex items-center justify-center rounded-md bg-muted text-muted-foreground",  activeBrush === item.value && "bg-primary text-primary-foreground")}>
                            {item.icon}
                        </div>
                        <span className="font-medium">{item.name}</span>
                    </div>
                    {item.name !== 'ERASER' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {e.stopPropagation(); handleUploadTexture(item.name)}}>
                            <Upload className="h-4 w-4"/>
                        </Button>
                    )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-4 border-t">
              <Button size="lg" className="w-full" onClick={handleLaunchGame}>
                <Play className="mr-2" />
                Launch Game
              </Button>
               <Button size="lg" variant="destructive" className="w-full" onClick={handleClearGrid}>
                <Trash2 className="mr-2" />
                Clear Grid
              </Button>
          </div>
        </CardContent>
      </Card>
      
      <main className="flex-grow flex items-center justify-center bg-muted/30 rounded-lg p-4 shadow-inner">
          <div 
            className="grid bg-background shadow-lg"
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: '100%',
              maxWidth: 'calc(100vh - 8rem)', // Prevent grid from becoming too large
              aspectRatio: '1 / 1',
              border: '2px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
              {grid.map((tile, index) => (
                  <Tile key={index} value={tile} index={index} />
              ))}
          </div>
      </main>
    </div>
  );
}
