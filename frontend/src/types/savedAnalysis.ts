import type {
  AnalysisRequest,
  AnalysisResult,
} from "./analysis";

export interface SavedAnalysisSummary {
  id: string;
  dataset_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface SavedAnalysisDetail
  extends SavedAnalysisSummary {
  plan: AnalysisRequest;
}

export interface SavedAnalysisRun {
  saved_analysis_id: string;
  plan: AnalysisRequest;
  analysis: AnalysisResult;
}