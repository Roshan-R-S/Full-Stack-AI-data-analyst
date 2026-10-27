import { lazy, Suspense } from "react";
import type { ChartMode } from "./VerifiedChart";

import type {
  Aggregation,
  AnalysisResult,
} from "../../types/analysis";

const VerifiedChart = lazy(
  () => import("./VerifiedChart"),
);

interface Props {
  result: AnalysisResult;
  groupBy?: string[];
  aggregation?: Aggregation;
  showDataTable?: boolean;
  onExportExcel?: (mode: ChartMode) => Promise<void>;
}

export default function LazyVerifiedChart(props: Props) {
  return (
    <Suspense
      fallback={
        <p className="meta-note">
          [LOADING VISUALIZATION...]
        </p>
      }
    >
      <VerifiedChart {...props} />
    </Suspense>
  );
}