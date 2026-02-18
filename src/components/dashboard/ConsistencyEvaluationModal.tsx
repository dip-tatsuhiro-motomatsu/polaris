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
import type { PRConsistencyEvaluation, ConsistencyGrade } from "@/types/evaluation";

interface ConsistencyEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueNumber: number;
  issueTitle: string;
  evaluation: PRConsistencyEvaluation | null;
}

const gradeColors: Record<ConsistencyGrade, string> = {
  A: "bg-green-500 text-white",
  B: "bg-blue-500 text-white",
  C: "bg-yellow-500 text-white",
  D: "bg-orange-500 text-white",
  E: "bg-red-500 text-white",
};

const gradeLabels: Record<ConsistencyGrade, string> = {
  A: "優秀",
  B: "良好",
  C: "普通",
  D: "要改善",
  E: "不十分",
};

export function ConsistencyEvaluationModal({
  isOpen,
  onClose,
  issueNumber,
  issueTitle,
  evaluation,
}: ConsistencyEvaluationModalProps) {
  if (!evaluation) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>整合性評価 - #{issueNumber}</DialogTitle>
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
            <span>整合性評価 - #{issueNumber}</span>
            <Badge className={gradeColors[evaluation.grade]}>
              {evaluation.grade} ({evaluation.totalScore}点)
            </Badge>
          </DialogTitle>
          <DialogDescription className="truncate">{issueTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* リンクされたPR */}
          <div className="space-y-2">
            <h3 className="font-semibold">リンクされたPR</h3>
            <div className="flex flex-wrap gap-2">
              {evaluation.linkedPRs.map((pr) => (
                <a
                  key={pr.number}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm bg-muted px-3 py-1 rounded-full hover:bg-muted/80 transition-colors"
                >
                  <span className="text-primary font-medium">#{pr.number}</span>
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    {pr.title}
                  </span>
                </a>
              ))}
            </div>
          </div>

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

          {/* Issue改善提案 */}
          {evaluation.issueImprovementSuggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Issue記述の改善提案</h3>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  以下の点を改善すると、次回からより正確な整合性評価が可能になります：
                </p>
                <ul className="space-y-2">
                  {evaluation.issueImprovementSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"
                    >
                      <span className="font-bold">{index + 1}.</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
