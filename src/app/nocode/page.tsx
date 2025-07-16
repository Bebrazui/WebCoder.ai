import { Button } from '@/components/ui/button';
import { Gamepad2 } from 'lucide-react';
import Link from 'next/link';

export default function NoCodeHPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
      <div className="text-center">
        <Gamepad2 className="mx-auto h-24 w-24 mb-6 text-primary" />
        <h1 className="text-5xl font-extrabold font-headline tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-600">
          NoCodeH (By WebCoder)
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          The future of game development is here.
        </p>
        <div className="mt-8 p-6 border rounded-lg max-w-2xl mx-auto bg-card">
            <h2 className="text-2xl font-bold mb-4">Coming Soon!</h2>
            <p className="text-muted-foreground mb-6">
                We are hard at work building an intuitive, powerful no-code game editor that allows you to bring your ideas to life. Add textures, design levels, and most importantly, **instantly test and play your creations** right here in the browser.
            </p>
            <Link href="/" passHref>
                 <Button size="lg">Go Back to Editor</Button>
            </Link>
        </div>
      </div>
    </div>
  );
}
