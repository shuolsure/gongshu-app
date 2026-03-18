import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 获取用户的喜欢/共书列表
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('user_id')?.value;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'liked'; // liked | coauthored

  if (!userId) {
    return NextResponse.json({ code: 1, message: '未登录' }, { status: 401 });
  }

  if (type === 'liked') {
    // 获取用户点赞的作品
    const votes = await prisma.voteRecord.findMany({
      where: {
        voterId: userId,
        targetType: 'novel',
        voteType: 'like',
      },
      select: { targetId: true },
    });

    const novelIds = votes.map(v => v.targetId);

    const novels = await prisma.novel.findMany({
      where: { id: { in: novelIds } },
      include: {
        author: {
          select: { name: true, secondmeUserId: true },
        },
        chapters: {
          orderBy: { chapterNumber: 'asc' },
        },
      },
      orderBy: { lastUpdateAt: 'desc' },
    });

    const result = novels.map(novel => ({
      ...novel,
      chapters: novel.chapters.length,
      userVote: 'like',
    }));

    return NextResponse.json({ code: 0, data: result });
  }

  if (type === 'coauthored') {
    // 获取用户参与创作的作品
    const contributions = await prisma.novelContributor.findMany({
      where: { contributorId: userId },
      select: { novelId: true, role: true },
    });

    const novelIds = contributions.map(c => c.novelId);
    const roleMap = new Map(contributions.map(c => [c.novelId, c.role]));

    const novels = await prisma.novel.findMany({
      where: { id: { in: novelIds } },
      include: {
        author: {
          select: { name: true, secondmeUserId: true },
        },
        chapters: {
          orderBy: { chapterNumber: 'asc' },
        },
        contributors: {
          include: {
            novel: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { lastUpdateAt: 'desc' },
    });

    // 检查用户是否点赞了这些作品
    const userVotes = await prisma.voteRecord.findMany({
      where: {
        voterId: userId,
        targetType: 'novel',
        targetId: { in: novelIds },
      },
      select: { targetId: true, voteType: true },
    });
    const voteMap = new Map(userVotes.map(v => [v.targetId, v.voteType]));

    const result = novels.map(novel => ({
      ...novel,
      chapters: novel.chapters.length,
      userVote: voteMap.get(novel.id) || null,
      userRole: roleMap.get(novel.id),
    }));

    return NextResponse.json({ code: 0, data: result });
  }

  return NextResponse.json({ code: 1, message: '无效的类型参数' }, { status: 400 });
}
