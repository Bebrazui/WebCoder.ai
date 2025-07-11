
'use server';
/**
 * @fileOverview A flow to simulate decompiling a Java class file using AI.
 *
 * - decompileJavaClass - A function that handles the Java class decompilation simulation.
 * - DecompileJavaClassInput - The input type for the decompileJavaClass function.
 * - DecompileJavaClassOutput - The return type for the decompileJavaClass function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DecompileJavaClassInputSchema = z.object({
  fileName: z.string().describe('The name of the .class file.'),
  fileContent: z.string().describe("The content of the .class file, as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type DecompileJavaClassInput = z.infer<typeof DecompileJavaClassInputSchema>;

const DecompileJavaClassOutputSchema = z.object({
  decompiledCode: z.string().describe('The AI-generated decompiled Java source code.'),
});
export type DecompileJavaClassOutput = z.infer<typeof DecompileJavaClassOutputSchema>;

export async function decompileJavaClass(input: DecompileJavaClassInput): Promise<DecompileJavaClassOutput> {
  return decompileJavaClassFlow(input);
}

const prompt = ai.definePrompt({
  name: 'decompileJavaPrompt',
  input: {schema: DecompileJavaClassInputSchema},
  output: {schema: DecompileJavaClassOutputSchema},
  prompt: `You are a simulated Java decompiler. Your task is to take the name of a Java .class file and generate plausible, well-formatted Java source code that would compile into a class with that name.

The user has provided a file named '{{{fileName}}}'.

Based on this file name, generate a Java class. For example, if the file name is "HelloWorld.class", you should generate a "public class HelloWorld { ... }".

Make the generated code non-trivial. It should include:
- A main method if it seems appropriate (e.g., for a class named "Application" or "Main").
- A few private fields.
- A constructor.
- At least two public methods with some logic (e.g., loops, conditionals).
- Add Javadoc comments to the class and public methods.

Do not mention that you are an AI or that this is a simulation. Just provide the decompiled code directly.`,
});

const decompileJavaClassFlow = ai.defineFlow(
  {
    name: 'decompileJavaClassFlow',
    inputSchema: DecompileJavaClassInputSchema,
    outputSchema: DecompileJavaClassOutputSchema,
  },
  async input => {
    // We don't need to pass the fileContent to the model, as it's binary.
    // The prompt only uses the fileName to generate plausible code.
    const {output} = await prompt(input);
    return output!;
  }
);
