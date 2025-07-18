// src/app/nocode/page.tsx
"use client";

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Gamepad2, User, CircleDollarSign, Ghost, Trash2, Upload, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';

const GRID_SIZE = 20;
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

const defaultTextures: { [key in TileTypeKey]?: string } = {
  PLAYER: '/player.png',
  WALL: '/wall.png',
  COIN: '/coin.png',
  ENEMY: '/enemy.png',
}

const PaletteItem = ({ icon, label, selected, onClick }: { icon: React.ReactNode, label: string, selected: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={cn("flex flex-col items-center justify-center gap-1 p-2 rounded-md border-2 transition-all", selected ? "bg-accent border-primary text-primary" : "bg-muted border-transparent hover:bg-accent/50")}>
    {icon}
    <span className="text-xs">{label}</span>
  </button>
);


export default function NoCodeEditorPage() {
  const [levelName, setLevelName] = useState("My Awesome Game");
  const [grid, setGrid] = useState<TileValue[][]>(() => Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(TILE_TYPES.EMPTY)));
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [selectedTool, setSelectedTool] = useState<TileTypeKey>('WALL');
  const [textures, setTextures] = useState<{ [key in TileTypeKey]?: string }>(defaultTextures);
  const { toast } = useToast();

  const handleTileClick = (row: number, col: number) => {
    const newGrid = grid.map(r => [...r]);
    const existingObject = objects.find(o => o.x === col && o.y === row);
    let newObjects = [...objects];

    if (existingObject) {
      if (selectedTool === 'EMPTY') {
        newObjects = newObjects.filter(o => o.id !== existingObject.id);
        newGrid[row][col] = TILE_TYPES.EMPTY;
      } else if (existingObject.type !== selectedTool) {
        // Replace existing object
        const updatedObject = { ...existingObject, type: selectedTool };
        newObjects = newObjects.map(o => o.id === existingObject.id ? updatedObject : o);
        newGrid[row][col] = TILE_TYPES[selectedTool];
      }
    } else if (selectedTool !== 'EMPTY') {
      if (selectedTool === 'PLAYER' && newObjects.some(o => o.type === 'PLAYER')) {
        toast({ variant: 'destructive', title: "Only one player allowed" });
        return;
      }
      const newObject: GameObject = {
        id: `${col}-${row}-${Date.now()}`,
        type: selectedTool,
        x: col,
        y: row
      };
      newObjects.push(newObject);
      newGrid[row][col] = TILE_TYPES[selectedTool];
    }
    setGrid(newGrid);
    setObjects(newObjects);
  };
  
  const handleTextureUpload = (type: TileTypeKey, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setTextures(prev => ({ ...prev, [type]: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const launchGame = () => {
    const levelData: LevelData = {
      name: levelName,
      grid: grid,
      objects: objects,
      textures: textures
    };
    localStorage.setItem('nocode_level_data', JSON.stringify(levelData));
    window.open('/nocode/game', '_blank');
  };

  const fileInputRefs: { [key: string]: React.RefObject<HTMLInputElement> } = {
    PLAYER: useRef<HTMLInputElement>(null),
    WALL: useRef<HTMLInputElement>(null),
    COIN: useRef<HTMLInputElement>(null),
    ENEMY: useRef<HTMLInputElement>(null),
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-80 border-r p-4 flex flex-col gap-4">
        <ScrollArea className="flex-grow">
          <div className="space-y-6">
            <h1 className="text-2xl font-bold font-headline">No-Code Game Editor</h1>
            
            <Card>
              <CardHeader>
                <CardTitle>Level Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="level-name">Level Name</Label>
                <Input id="level-name" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tools</CardTitle>
                <CardDescription>Select an object to place</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                  <PaletteItem icon={<User />} label="Player" selected={selectedTool === 'PLAYER'} onClick={() => setSelectedTool('PLAYER')} />
                  <PaletteItem icon={<div className="w-6 h-6 bg-gray-600 border border-gray-400" />} label="Wall" selected={selectedTool === 'WALL'} onClick={() => setSelectedTool('WALL')} />
                  <PaletteItem icon={<CircleDollarSign />} label="Coin" selected={selectedTool === 'COIN'} onClick={() => setSelectedTool('COIN')} />
                  <PaletteItem icon={<Ghost />} label="Enemy" selected={selectedTool === 'ENEMY'} onClick={() => setSelectedTool('ENEMY')} />
                  <PaletteItem icon={<Eraser />} label="Eraser" selected={selectedTool === 'EMPTY'} onClick={() => setSelectedTool('EMPTY')} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Textures</CardTitle>
                <CardDescription>Upload custom images</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['PLAYER', 'WALL', 'COIN', 'ENEMY'] as TileTypeKey[]).map(type => (
                  <div key={type}>
                    <Label className="capitalize">{type.toLowerCase()}</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 border rounded-md bg-muted flex items-center justify-center">
                        {textures[type] && <Image src={textures[type]!} alt={type} width={32} height={32} objectFit="contain" />}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => fileInputRefs[type].current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Upload
                      </Button>
                      <input type="file" ref={fileInputRefs[type]} onChange={(e) => handleTextureUpload(type, e)} accept="image/png, image/jpeg" className="hidden" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
          </div>
        </ScrollArea>
        <div className="mt-4 flex-shrink-0">
          <Button size="lg" className="w-full" onClick={launchGame}>
            <Gamepad2 className="mr-2" /> Launch Game
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-4 bg-muted/30">
        <div className="grid border-2 border-primary/20 bg-background" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`, gridTemplateRows: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)` }}>
          {grid.map((row, rowIndex) =>
            row.map((_, colIndex) => {
              const object = objects.find(o => o.x === colIndex && o.y === rowIndex);
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="w-full h-full border border-primary/10 hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                  }}
                >
                  {object && textures[object.type] && (
                     <Image src={textures[object.type]!} alt={object.type} width={TILE_SIZE} height={TILE_SIZE} objectFit="cover" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  );
}
