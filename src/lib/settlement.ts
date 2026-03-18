import { prisma } from './prisma';
import { updateNovelHotScore } from './hotScore';

interface SettlementResult {
  novelId: string;
  novelTitle: string;
  settled: boolean;
  reason?: string;
  winningContinuationId?: string;
  newChapterNumber?: number;
  goldenThreeChapters?: boolean;
}

/**
 * 每日结算逻辑
 * 1. 遍历所有作品的最新章节
 * 2. 找到有效票数≥1的续写
 * 3. 最高票数者转为正文章节
 * 4. 检查黄金三章
 */
export async function runDailySettlement(): Promise<SettlementResult[]> {
  const results: SettlementResult[] = [];

  // 获取所有作品
  const novels = await prisma.novel.findMany({
    include: {
      chapters: {
        orderBy: { chapterNumber: 'desc' },
        take: 1,
      },
    },
  });

  for (const novel of novels) {
    const result = await settleNovel(novel.id, novel.title, novel.chapters[0]?.chapterNumber || 1);
    results.push(result);
  }

  return results;
}

/**
 * 结算单个作品
 */
async function settleNovel(
  novelId: string, 
  novelTitle: string, 
  latestChapterNumber: number
): Promise<SettlementResult> {
  // 获取最新章节的并列续写
  const continuations = await prisma.continuation.findMany({
    where: {
      novelId,
      afterChapterNumber: latestChapterNumber,
      isSettled: false,
      votes: { gte: 1 }, // 有效票数≥1
    },
    orderBy: [
      { votes: 'desc' },
      { createdAt: 'asc' }, // 票数相同取最早的
    ],
  });

  if (continuations.length === 0) {
    return {
      novelId,
      novelTitle,
      settled: false,
      reason: '没有符合条件的续写（需要≥1票）',
    };
  }

  const winner = continuations[0];

  // 使用事务处理结算
  const result = await prisma.$transaction(async (tx) => {
    // 将胜出续写转为正文章节
    await tx.chapter.create({
      data: {
        novelId,
        chapterNumber: latestChapterNumber + 1,
        title: `第${latestChapterNumber + 1}章`,
        content: winner.content,
        authorId: winner.authorId,
        author: winner.author,
        votes: winner.votes,
        likes: winner.likes,
        dislikes: winner.dislikes,
      },
    });

    // 标记续写已结算且为胜出者
    await tx.continuation.update({
      where: { id: winner.id },
      data: { 
        isSettled: true, 
        isWinner: true,
      },
    });

    // 标记其他续写为已结算
    await tx.continuation.updateMany({
      where: {
        novelId,
        afterChapterNumber: latestChapterNumber,
        isSettled: false,
        id: { not: winner.id },
      },
      data: { isSettled: true },
    });

    // 更新作品信息
    const newChapterCount = latestChapterNumber + 1;
    const isGoldenThree = newChapterCount >= 3;

    await tx.novel.update({
      where: { id: novelId },
      data: {
        chapterCount: newChapterCount,
        status: isGoldenThree ? 'serial' : 'new',
        lastUpdateAt: new Date(),
      },
    });

    return {
      newChapterNumber: newChapterCount,
      goldenThreeChapters: isGoldenThree,
    };
  });

  // 更新热度
  await updateNovelHotScore(novelId);

  return {
    novelId,
    novelTitle,
    settled: true,
    winningContinuationId: winner.id,
    newChapterNumber: result.newChapterNumber,
    goldenThreeChapters: result.goldenThreeChapters,
  };
}

/**
 * 获取结算状态报告
 */
export async function getSettlementReport() {
  const novels = await prisma.novel.findMany({
    include: {
      chapters: {
        orderBy: { chapterNumber: 'desc' },
        take: 1,
      },
      continuations: {
        where: { isSettled: false },
        select: { id: true },
      },
    },
  });

  return novels.map(novel => ({
    id: novel.id,
    title: novel.title,
    status: novel.status,
    chapterCount: novel.chapterCount,
    latestChapterNumber: novel.chapters[0]?.chapterNumber || 0,
    pendingContinuations: novel.continuations.length,
  }));
}
