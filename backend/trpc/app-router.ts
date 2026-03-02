import { createTRPCRouter } from "./create-context";
import { validationRouter } from "./routes/validation";
import { aiAnalysisRouter } from "./routes/ai-analysis";

export const appRouter = createTRPCRouter({
  validation: validationRouter,
  aiAnalysis: aiAnalysisRouter,
});

export type AppRouter = typeof appRouter;
