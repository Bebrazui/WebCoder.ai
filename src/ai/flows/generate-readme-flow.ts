
'use server';
/**
 * @fileOverview A flow to generate a README.md file for the project structure.
 *
 * - generateReadme - A function that handles the README generation process.
 * - GenerateReadmeInput - The input type for the generateReadme function.
 * - GenerateReadmeOutput - The return type for the generateReadme function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReadmeInputSchema = z.object({
  fileTree: z.string().describe('A string representing the file and folder structure of the project.'),
});
export type GenerateReadmeInput = z.infer<typeof GenerateReadmeInputSchema>;

const GenerateReadmeOutputSchema = z.object({
  readmeContent: z.string().describe('The generated content for the README.md file in Markdown format.'),
});
export type GenerateReadmeOutput = z.infer<typeof GenerateReadmeOutputSchema>;

export async function generateReadme(input: GenerateReadmeInput): Promise<GenerateReadmeOutput> {
  return generateReadmeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReadmePrompt',
  input: {schema: GenerateReadmeInputSchema},
  output: {schema: GenerateReadmeOutputSchema},
  prompt: `You are an expert technical writer. Your task is to generate a high-quality README.md file for a new project based on its file structure.

The user has provided the following file tree:
\`\`\`
{{{fileTree}}}
\`\`\`

Based on this file structure, generate a README.md file. The README should include:
- A plausible project title.
- A brief introduction explaining what the project might be about.
- A "Getting Started" section with instructions on how to install dependencies (\`npm install\`) and run the development server (\`npm run dev\").
- A "Project Structure" section that briefly explains the purpose of key files and directories.
- Use Markdown formatting.

Do not include any introductory phrases like "Here is the README.md content". Just provide the raw Markdown content.`,
});

const generateReadmeFlow = ai.defineFlow(
  {
    name: 'generateReadmeFlow',
    inputSchema: GenerateReadmeInputSchema,
    outputSchema: GenerateReadmeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
