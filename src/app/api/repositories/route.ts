import { NextRequest, NextResponse } from "next/server";
import { RegisterRepositoryUseCase } from "@/application/use-cases/register-repository";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/repositories
 * リポジトリ一覧を取得
 */
export async function GET() {
  try {
    const repositoryRepository = new RepositoryRepository();
    const repositories = await repositoryRepository.findAll();

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "リポジトリの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repositories
 * リポジトリを登録
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerName, repoName, trackingStartDate, sprintDurationWeeks } = body;

    const useCase = new RegisterRepositoryUseCase();
    const result = await useCase.execute({
      ownerName,
      repoName,
      trackingStartDate,
      sprintDurationWeeks: sprintDurationWeeks ?? 1,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result.repository, { status: 201 });
  } catch (error) {
    console.error("Error creating repository:", error);
    return NextResponse.json(
      { error: "リポジトリの登録に失敗しました" },
      { status: 500 }
    );
  }
}
