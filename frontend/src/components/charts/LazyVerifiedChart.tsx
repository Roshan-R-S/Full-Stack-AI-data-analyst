import { lazy, Suspense } from "react";

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