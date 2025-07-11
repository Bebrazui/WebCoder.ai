// src/ai/flows/transform-code.ts
'use server';
/**
 * @fileOverview A flow to transform code using AI based on natural language instructions.
 *
 * - transformCode - A function that handles the code transformation process.
 * - TransformCodeInput - The input type for the transformCode function.
 * - TransformCodeOutput - The return type for the transformCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TransformCodeInputSchema = z.object({
  code: z.string().describe('The code to transform.'),
  instruction: z.string().describe('The natural language instruction for the transformation.'),
});
export type TransformCodeInput = z.infer<typeof TransformCodeInputSchema>;

const TransformCodeOutputSchema = z.object({
  transformedCode: z.string().describe('The transformed code.'),
});
export type TransformCodeOutput = z.infer<typeof TransformCodeOutputSchema>;

export async function transformCode(input: TransformCodeInput): Promise<TransformCodeOutput> {
  return transformCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'transformCodePrompt',
  input: {schema: TransformCodeInputSchema},
  output: {schema: TransformCodeOutputSchema},
  prompt: `You are a code transformation expert.  You will take the provided code and transform it according to the instruction provided.

Code:
{{code}}

Instruction: {{instruction}}

Transformed Code:`,
});

const transformCodeFlow = ai.defineFlow(
  {
    name: 'transformCodeFlow',
    inputSchema: TransformCodeInputSchema,
    outputSchema: TransformCodeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
