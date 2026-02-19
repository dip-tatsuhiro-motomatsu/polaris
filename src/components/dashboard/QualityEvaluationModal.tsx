"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { IssueQualityEvaluation, QualityGrade } from "@/types/evaluation";

interface QualityEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueNumber: number;
  issueTitle: string;
  evaluation: IssueQualityEvaluation | null;
}

const gradeColors: Record<QualityGrade, string> = {
  A: "bg-green-500 text-white",
  B: "bg-blue-500 text-white",
  C: "bg-yellow-500 text-white",
  D: "bg-orange-500 text-white",
  E: "bg-red-500 text-white",
};

const gradeLabels: Record<QualityGrade, string> = {
  A: "優秀",
  B: "良好",
  C: "普通",
  D: "要改善",
  E: "不十分",
};

export function QualityEvaluationModal({
  isOpen,
  onClose,
  issueNumber,
  issueTitle,
  evaluation,
}: QualityEvaluationModalProps) {
  if (!evaluation) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>品質評価 - #{issueNumber}</DialogTitle>
            <DialogDescription>{issueTitle}</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            このIssueはまだ評価されていません
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>品質評価 - #{issueNumber}</span>
            <Badge className={gradeColors[evaluation.grade]}>
              {evaluation.grade} ({evaluation.totalScore}点)
            </Badge>
          </DialogTitle>
          <DialogDescription className="truncate">{issueTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 総合評価 */}
          <div className="space-y-2">
            <h3 className="font-semibold">総合評価</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={evaluation.totalScore} className="h-3" />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {evaluation.totalScore}/100
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {gradeLabels[evaluation.grade]}: {evaluation.overallFeedback}
            </p>
          </div>

          {/* カテゴリ別評価 */}
          <div className="space-y-4">
            <h3 className="font-semibold">カテゴリ別評価</h3>
            {evaluation.categories.map((category) => (
              <div key={category.categoryId} className="space-y-2 border-l-2 border-muted pl-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{category.categoryName}</span>
                  <span className="text-sm text-muted-foreground">
                    {category.score}/{category.maxScore}点
                  </span>
                </div>
                <Progress
                  value={(category.score / category.maxScore) * 100}
                  className="h-2"
                />
                <p className="text-sm text-muted-foreground">{category.feedback}</p>
              </div>
            ))}
          </div>

          {/* 改善提案 */}
          {evaluation.improvementSuggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">改善提案</h3>
              <ul className="space-y-2">
                {evaluation.improvementSuggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm bg-muted p-3 rounded-md"
                  >
                    <span className="text-primary font-bold">{index + 1}.</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 評価日時 */}
          <div className="text-xs text-muted-foreground text-right">
            評価日時: {new Date(evaluation.evaluatedAt).toLocaleString("ja-JP")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
