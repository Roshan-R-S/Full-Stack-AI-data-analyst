import type {
  AnalysisRequest,
  AnalysisResult,
} from "./analysis";

export interface AskResponse {
  question: string;
  model: string;
  answer: string;
  plan: AnalysisRequest;
  analysis: AnalysisResult;
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  analysis?: AnalysisResult;
  plan?: AnalysisRequest;
}