"use client";

import { Badge } from "@/components/ui/badge";
import type { Grade, EvaluationResult } from "@/types/evaluation";

interface EvaluationBadgeProps {
  evaluation: EvaluationResult | null;
  type?: "speed" | "quality" | "consistency";
  showScore?: boolean;
}

const gradeColors: Record<Grade, string> = {
  S: "bg-purple-500 hover:bg-purple-600 text-white",
  A: "bg-green-500 hover:bg-green-600 text-white",
  B: "bg-yellow-500 hover:bg-yellow-600 text-white",
  C: "bg-red-500 hover:bg-red-600 text-white",
};

const typeLabels: Record<string, string> = {
  speed: "速度",
  quality: "品質",
  consistency: "整合性",
};

export function EvaluationBadge({
  evaluation,
  type,
  showScore = false,
}: EvaluationBadgeProps) {
  if (!evaluation) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        未評価
      </Badge>
    );
  }

  const label = showScore
    ? `${evaluation.grade} (${evaluation.score})`
    : evaluation.grade;

  return (
    <Badge
      className={`${gradeColors[evaluation.grade]} cursor-default`}
      title={`${type ? typeLabels[type] + ": " : ""}${evaluation.message}`}
    >
      {type && <span className="mr-1 text-xs opacity-75">{typeLabels[type]}</span>}
      {label}
    </Badge>
  );
}

interface EvaluationSummaryProps {
  speedEvaluation: EvaluationResult | null;
  qualityEvaluation?: EvaluationResult | null;
  consistencyEvaluation?: EvaluationResult | null;
}

export function EvaluationSummary({
  speedEvaluation,
  qualityEvaluation,
  consistencyEvaluation,
}: EvaluationSummaryProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <EvaluationBadge evaluation={speedEvaluation} type="speed" />
      {qualityEvaluation !== undefined && (
        <EvaluationBadge evaluation={qualityEvaluation} type="quality" />
      )}
      {consistencyEvaluation !== undefined && (
        <EvaluationBadge evaluation={consistencyEvaluation} type="consistency" />
      )}
    </div>
  );
}
