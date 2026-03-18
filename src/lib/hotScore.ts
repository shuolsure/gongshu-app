import { prisma } from './prisma';

/**
 * 热度算法（根据 PRD）
 * 热度 = (累计有效票数 × 0.5) + (章节数 × 20) + (创作者数 × 10) + 时间衰减因子
 * 时间衰减因子 = 1 / (1 + ln(距今天数 + 1)) × 30
 */
export function calculateHotScore(
  totalVotes: number,
  chapterCount: number,
  contributorCount: number,
  lastUpdateAt: Date
): number {
  // 时间衰减因子
  const daysSinceUpdate = Math.floor(
    (Date.now() - lastUpdateAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeDecay = (1 / (1 + Math.log(daysSinceUpdate + 1))) * 30;

  // 计算热度
  const hotScore = 
    totalVotes * 0.5 + 
    chapterCount * 20 + 
    contributorCount * 10 + 
    timeDecay;

  return Math.round(hotScore * 100) / 100; // 保留两位小数
}

/**
 * 更新单个作品的热度分数
 */
export async function updateNovelHotScore(novelId: string): Promise<number> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: {
      chapters: { select: { votes: true } },
      continuations: { select: { votes: true } },
    },
  });

  if (!novel) return 0;

  // 计算累计有效票数（作品 + 章节 + 续写）
  const chaptersVotes = novel.chapters.reduce((sum, c) => sum + c.votes, 0);
  const continuationsVotes = novel.continuations.reduce((sum, c) => sum + c.votes, 0);
  const totalVotes = novel.totalVotes + chaptersVotes + continuationsVotes;

  const hotScore = calculateHotScore(
    totalVotes,
    novel.chapterCount,
    novel.contributorCount,
    novel.lastUpdateAt
  );

  await prisma.novel.update({
    where: { id: novelId },
    data: { 
      hotScore,
      totalVotes, // 同时更新总票数
    },
  });

  return hotScore;
}

/**
 * 更新所有作品的热度分数
 */
export async function updateAllNovelHotScores(): Promise<void> {
  const novels = await prisma.novel.findMany({
    select: { id: true },
  });

  for (const novel of novels) {
    await updateNovelHotScore(novel.id);
  }
}
