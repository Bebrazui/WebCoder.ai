'use server';
/**
 * @fileOverview A flow to inspect and describe a snippet of binary data.
 *
 * - inspectBinaryData - A function that handles the data inspection process.
 * - InspectBinaryDataInput - The input type for the inspectBinaryData function.
 * - InspectBinaryDataOutput - The return type for the inspectBinaryData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InspectBinaryDataInputSchema = z.object({
  hexData: z.string().describe('A string of hexadecimal characters representing the binary data to inspect.'),
  context: z.string().describe('Optional context about the file or data source.'),
});
export type InspectBinaryDataInput = z.infer<typeof InspectBinaryDataInputSchema>;

const InspectBinaryDataOutputSchema = z.object({
  analysis: z.string().describe('A detailed analysis and explanation of the binary data.'),
});
export type InspectBinaryDataOutput = z.infer<typeof InspectBinaryDataOutputSchema>;

export async function inspectBinaryData(input: InspectBinaryDataInput): Promise<InspectBinaryDataOutput> {
  return inspectBinaryDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'inspectBinaryDataPrompt',
  input: {schema: InspectBinaryDataInputSchema},
  output: {schema: InspectBinaryDataOutputSchema},
  prompt: `You are an expert in binary data analysis and reverse engineering.
Your task is to analyze the provided snippet of hexadecimal data and provide a detailed explanation of what it represents.
Consider common file format headers, data structures, character encodings, and other patterns.

If context is provided, use it to enhance your analysis.

Hex Data Snippet:
{{hexData}}

Context:
{{{context}}}

Provide your analysis below. Be as specific as possible. If you recognize a known format, name it. If you see text, decode it. If you see numbers, explain their likely meaning (e.g., size, offset).
`,
});

const inspectBinaryDataFlow = ai.defineFlow(
  {
    name: 'inspectBinaryDataFlow',
    inputSchema: InspectBinaryDataInputSchema,
    outputSchema: InspectBinaryDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
