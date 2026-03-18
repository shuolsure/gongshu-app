import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getValidToken } from '@/lib/auth';
import { calculateHotScore } from '@/lib/hotScore';

const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL || 'https://api.mindverse.com/gate/lab';

// GET: 获取作品列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all'; // all, new, serial
  const sortBy = searchParams.get('sortBy') || 'hot'; // hot, time
  const userId = request.cookies.get('user_id')?.value;

  const where = status !== 'all' ? { status } : {};

  // 排序规则
  const orderBy = sortBy === 'hot' 
    ? [{ hotScore: 'desc' as const }, { lastUpdateAt: 'desc' as const }]
    : [{ lastUpdateAt: 'desc' as const }, { hotScore: 'desc' as const }];

  const novels = await prisma.novel.findMany({
    where,
    include: {
      author: {
        select: { name: true, secondmeUserId: true },
      },
      chapters: {
        orderBy: { chapterNumber: 'asc' },
      },
      contributors: true,
    },
    orderBy,
  });

  // 检查用户是否点赞
  const userVotes = userId
    ? await prisma.voteRecord.findMany({
        where: { voterId: userId, targetType: 'novel' },
        select: { targetId: true, voteType: true },
      })
    : [];

  const voteMap = new Map(userVotes.map(v => [v.targetId, v.voteType]));

  const result = novels.map(novel => ({
    ...novel,
    userVote: voteMap.get(novel.id) || null,
    chapters: novel.chapters.length,
  }));

  return NextResponse.json({ code: 0, data: result });
}

// POST: 创建新作品
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ code: 1, message: '未登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ code: 1, message: '用户不存在' }, { status: 404 });
  }

  const body = await request.json();
  const { title, summary, content, coverImage } = body;

  // 字数校验
  if (!content || content.length < 1000) {
    return NextResponse.json({ code: 1, message: '正文内容至少需要1000字' }, { status: 400 });
  }

  if (!title || title.trim().length === 0) {
    return NextResponse.json({ code: 1, message: '标题不能为空' }, { status: 400 });
  }

  // 计算初始热度
  const initialHotScore = calculateHotScore(0, 1, 1, new Date());

  // 创建作品和第一章
  const novel = await prisma.novel.create({
    data: {
      title,
      summary: summary || '',
      coverImage,
      authorId: userId,
      chapterCount: 1,
      hotScore: initialHotScore,
      contributors: {
        create: {
          contributorId: userId,
          role: 'creator',
        },
      },
      chapters: {
        create: {
          chapterNumber: 1,
          title: `第1章：${title}`,
          content,
          authorId: userId,
          author: user.name || user.secondmeUserId,
        },
      },
    },
    include: {
      chapters: true,
    },
  });

  // 同步到 Second Me
  try {
    const accessToken = await getValidToken(user.secondmeUserId);
    if (accessToken) {
      await fetch(`${SECONDME_API_BASE_URL}/api/secondme/agent_memory/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `【新作品】${title}\n\n${summary || content.substring(0, 200)}...`,
          metadata: {
            type: 'novel',
            novelId: novel.id,
            chapterId: novel.chapters[0].id,
          },
        }),
      });
    }
  } catch (err) {
    console.error('Failed to sync to Second Me:', err);
  }

  return NextResponse.json({ code: 0, data: novel });
}
