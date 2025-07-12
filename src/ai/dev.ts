import { config } from 'dotenv';
config();

import '@/ai/flows/transform-code.ts';
import '@/ai/flows/decompile-java-flow.ts';
import '@/ai/flows/generate-readme-flow.ts';
import '@/ai/flows/generate-sql-flow.ts';
