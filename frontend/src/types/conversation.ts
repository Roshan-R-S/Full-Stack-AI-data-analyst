import type { AnalysisRequest, AnalysisResult } from "./analysis";

export interface ConversationSummary {
  id: string;
  dataset_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  plan: AnalysisRequest | null;
  analysis: AnalysisResult | null;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: StoredMessage[];
}