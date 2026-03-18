import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getValidToken } from '@/lib/auth';

const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL || 'https://api.mindverse.com/gate/lab';

// GET: 获取作品的并列续写列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: novelId } = await params;
  const userId = request.cookies.get('user_id')?.value;

  // 获取作品最新章节
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!novel) {
    return NextResponse.json({ code: 1, message: '作品不存在' }, { status: 404 });
  }

  const latestChapter = novel.chapters[0];
  if (!latestChapter) {
    return NextResponse.json({ code: 1, message: '作品没有章节' }, { status: 400 });
  }

  // 获取该章节的并列续写
  const continuations = await prisma.continuation.findMany({
    where: {
      novelId,
      afterChapterNumber: latestChapter.chapterNumber,
      isSettled: false,
    },
    orderBy: [
      { votes: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  // 获取用户投票记录
  const userVotes = userId
    ? await prisma.voteRecord.findMany({
        where: {
          voterId: userId,
          targetType: 'continuation',
          targetId: { in: continuations.map(c => c.id) },
        },
        select: { targetId: true, voteType: true },
      })
    : [];

  const voteMap = new Map(userVotes.map(v => [v.targetId, v.voteType]));

  const result = continuations.map(c => ({
    id: c.id,
    author: c.author,
    authorId: c.authorId,
    content: c.content,
    wordCount: c.wordCount,
    votes: c.votes,
    likes: c.likes,
    dislikes: c.dislikes,
    createdAt: c.createdAt,
    userVote: voteMap.get(c.id) || null,
  }));

  return NextResponse.json({
    code: 0,
    data: {
      latestChapterNumber: latestChapter.chapterNumber,
      continuations: result,
    },
  });
}

// POST: 提交续写
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: novelId } = await params;
  const userId = request.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ code: 1, message: '未登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ code: 1, message: '用户不存在' }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body;

  // 字数校验
  if (!content || content.length < 1000) {
    return NextResponse.json({ code: 1, message: '正文内容至少需要1000字' }, { status: 400 });
  }

  // 获取作品最新章节
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!novel) {
    return NextResponse.json({ code: 1, message: '作品不存在' }, { status: 404 });
  }

  const latestChapter = novel.chapters[0];
  if (!latestChapter) {
    return NextResponse.json({ code: 1, message: '作品没有章节' }, { status: 400 });
  }

  // 检查是否已有续写（同一用户对同一章节只保留最后一个）
  const existingContinuation = await prisma.continuation.findFirst({
    where: {
      novelId,
      afterChapterNumber: latestChapter.chapterNumber,
      authorId: userId,
      isSettled: false,
    },
  });

  let continuation;

  if (existingContinuation) {
    // 覆盖已有续写
    continuation = await prisma.continuation.update({
      where: { id: existingContinuation.id },
      data: {
        content,
        wordCount: content.length,
        createdAt: new Date(),
      },
    });
  } else {
    // 创建新续写
    continuation = await prisma.continuation.create({
      data: {
        novelId,
        afterChapterNumber: latestChapter.chapterNumber,
        content,
        wordCount: content.length,
        authorId: userId,
        author: user.name || user.secondmeUserId,
      },
    });

    // 添加贡献者（如果还不是贡献者）
    const existingContributor = await prisma.novelContributor.findUnique({
      where: {
        novelId_contributorId: {
          novelId,
          contributorId: userId,
        },
      },
    });

    if (!existingContributor) {
      await prisma.novelContributor.create({
        data: {
          novelId,
          contributorId: userId,
          role: 'co_author',
        },
      });

      // 更新贡献者数量
      await prisma.novel.update({
        where: { id: novelId },
        data: {
          contributorCount: { increment: 1 },
        },
      });
    }
  }

  // 更新作品最后更新时间
  await prisma.novel.update({
    where: { id: novelId },
    data: { lastUpdateAt: new Date() },
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
          content: `【续写】${novel.title} - 第${latestChapter.chapterNumber + 1}章\n\n${content.substring(0, 200)}...`,
          metadata: {
            type: 'continuation',
            novelId,
            continuationId: continuation.id,
            afterChapterNumber: latestChapter.chapterNumber,
          },
        }),
      });
    }
  } catch (err) {
    console.error('Failed to sync to Second Me:', err);
  }

  return NextResponse.json({ code: 0, data: continuation });
}
