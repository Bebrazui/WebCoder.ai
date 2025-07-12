
'use server';
/**
 * @fileOverview A flow to generate SQL queries from natural language.
 *
 * - generateSql - A function that handles the SQL generation process.
 * - GenerateSqlInput - The input type for the generateSql function.
 * - GenerateSqlOutput - The return type for the generateSql function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSqlInputSchema = z.object({
  prompt: z.string().describe('The natural language prompt describing the desired SQL query.'),
  schema: z.string().optional().describe('An optional database schema (CREATE TABLE statements) to provide context.'),
});
export type GenerateSqlInput = z.infer<typeof GenerateSqlInputSchema>;

const GenerateSqlOutputSchema = z.object({
  sqlQuery: z.string().describe('The generated SQL query.'),
});
export type GenerateSqlOutput = z.infer<typeof GenerateSqlOutputSchema>;

export async function generateSql(input: GenerateSqlInput): Promise<GenerateSqlOutput> {
  return generateSqlFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSqlPrompt',
  input: {schema: GenerateSqlInputSchema},
  output: {schema: GenerateSqlOutputSchema},
  prompt: `You are an expert SQL developer. Your task is to write a high-quality SQL query based on the user's request.

{{#if schema}}
Use the following database schema for context:
\`\`\`sql
{{{schema}}}
\`\`\`
{{/if}}

User's request: "{{{prompt}}}"

Generate only the SQL query. Do not include any explanations or Markdown formatting.`,
});

const generateSqlFlow = ai.defineFlow(
  {
    name: 'generateSqlFlow',
    inputSchema: GenerateSqlInputSchema,
    outputSchema: GenerateSqlOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
