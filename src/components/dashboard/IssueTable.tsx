"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EvaluationBadge } from "./EvaluationBadge";
import { QualityFeedbackModal } from "./QualityFeedbackModal";
import type { Issue } from "@/types/issue";
import type { IssueQualityEvaluation } from "@/types/evaluation";

interface IssueTableProps {
  issues: Issue[];
  showSpeedEvaluation?: boolean;
  showQualityEvaluation?: boolean;
  onIssueClick?: (issue: Issue) => void;
}

export function IssueTable({
  issues,
  showSpeedEvaluation = true,
  showQualityEvaluation = false,
  onIssueClick,
}: IssueTableProps) {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleQualityBadgeClick = (
    e: React.MouseEvent,
    issue: Issue
  ) => {
    e.stopPropagation();
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const getQualityEvaluation = (issue: Issue): IssueQualityEvaluation | null => {
    const evaluation = issue.qualityEvaluation;
    if (!evaluation?.details) return null;

    const details = evaluation.details as {
      categories?: IssueQualityEvaluation["categories"];
      overallFeedback?: string;
      improvementSuggestions?: string[];
    };

    if (!details.categories) return null;

    return {
      totalScore: evaluation.score,
      grade: evaluation.grade as IssueQualityEvaluation["grade"],
      categories: details.categories,
      overallFeedback: details.overallFeedback || evaluation.message,
      improvementSuggestions: details.improvementSuggestions || [],
      evaluatedAt:
        typeof evaluation.evaluatedAt === "string"
          ? evaluation.evaluatedAt
          : evaluation.evaluatedAt.toISOString(),
    };
  };
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP");
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Issueがありません</p>
      </div>
    );
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>タイトル</TableHead>
          <TableHead className="w-24">状態</TableHead>
          <TableHead className="w-32">担当者</TableHead>
          {showSpeedEvaluation && <TableHead className="w-24">速度</TableHead>}
          {showQualityEvaluation && <TableHead className="w-24">品質</TableHead>}
          <TableHead className="w-28">作成日</TableHead>
          <TableHead className="w-28">クローズ日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow
            key={issue.id}
            className={onIssueClick ? "cursor-pointer hover:bg-muted/50" : ""}
            onClick={() => onIssueClick?.(issue)}
          >
            <TableCell className="font-mono">{issue.number}</TableCell>
            <TableCell>
              <div>
                <span className="font-medium">{issue.title}</span>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {issue.labels.slice(0, 3).map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                    {issue.labels.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{issue.labels.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={issue.state === "open" ? "default" : "secondary"}
              >
                {issue.state === "open" ? "オープン" : "クローズ"}
              </Badge>
            </TableCell>
            <TableCell>{issue.assignee || "-"}</TableCell>
            {showSpeedEvaluation && (
              <TableCell>
                <EvaluationBadge evaluation={issue.speedEvaluation} />
              </TableCell>
            )}
            {showQualityEvaluation && (
              <TableCell>
                <button
                  type="button"
                  onClick={(e) => handleQualityBadgeClick(e, issue)}
                  className="hover:opacity-80 transition-opacity"
                  title="クリックして詳細を表示"
                >
                  <EvaluationBadge evaluation={issue.qualityEvaluation} />
                </button>
              </TableCell>
            )}
            <TableCell>{formatDate(issue.createdAt)}</TableCell>
            <TableCell>{formatDate(issue.closedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <QualityFeedbackModal
      open={isModalOpen}
      onOpenChange={setIsModalOpen}
      issue={selectedIssue}
      evaluation={selectedIssue ? getQualityEvaluation(selectedIssue) : null}
    />
  </>
  );
}
