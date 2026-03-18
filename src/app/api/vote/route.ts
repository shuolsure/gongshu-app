import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: 投票（点赞/点踩）
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ code: 1, message: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetId, voteType } = body;

  // 参数校验
  if (!['novel', 'chapter', 'continuation'].includes(targetType)) {
    return NextResponse.json({ code: 1, message: '无效的投票对象类型' }, { status: 400 });
  }

  if (!['like', 'dislike'].includes(voteType)) {
    return NextResponse.json({ code: 1, message: '无效的投票类型' }, { status: 400 });
  }

  // 检查目标是否存在
  let targetExists = false;
  let novelId: string | null = null;

  if (targetType === 'novel') {
    const novel = await prisma.novel.findUnique({ where: { id: targetId } });
    if (novel) {
      targetExists = true;
      novelId = targetId;
    }
  } else if (targetType === 'chapter') {
    const chapter = await prisma.chapter.findUnique({ where: { id: targetId } });
    if (chapter) {
      targetExists = true;
      novelId = chapter.novelId;
    }
  } else if (targetType === 'continuation') {
    const continuation = await prisma.continuation.findUnique({ where: { id: targetId } });
    if (continuation) {
      targetExists = true;
      novelId = continuation.novelId;
    }
  }

  if (!targetExists) {
    return NextResponse.json({ code: 1, message: '投票目标不存在' }, { status: 404 });
  }

  // 查找已有投票记录
  const existingVote = await prisma.voteRecord.findUnique({
    where: {
      voterId_targetType_targetId: {
        voterId: userId,
        targetType,
        targetId,
      },
    },
  });

  // 使用事务处理投票
  const result = await prisma.$transaction(async (tx) => {
    // 如果已有投票记录
    if (existingVote) {
      // 如果投票类型相同，则取消投票
      if (existingVote.voteType === voteType) {
        // 删除投票记录
        await tx.voteRecord.delete({
          where: { id: existingVote.id },
        });

        // 更新目标计数
        if (targetType === 'novel') {
          await tx.novel.update({
            where: { id: targetId },
            data: {
              totalVotes: voteType === 'like' ? { decrement: 1 } : { increment: 1 },
            },
          });
        } else if (targetType === 'chapter') {
          await tx.chapter.update({
            where: { id: targetId },
            data: {
              likes: voteType === 'like' ? { decrement: 1 } : {},
              dislikes: voteType === 'dislike' ? { decrement: 1 } : {},
              votes: voteType === 'like' ? { decrement: 1 } : { increment: 1 },
            },
          });
        } else if (targetType === 'continuation') {
          await tx.continuation.update({
            where: { id: targetId },
            data: {
              likes: voteType === 'like' ? { decrement: 1 } : {},
              dislikes: voteType === 'dislike' ? { decrement: 1 } : {},
              votes: voteType === 'like' ? { decrement: 1 } : { increment: 1 },
            },
          });
        }

        return { action: 'removed', voteType: null };
      }

      // 如果投票类型不同，则更新投票
      await tx.voteRecord.update({
        where: { id: existingVote.id },
        data: { voteType },
      });

      // 更新目标计数
      if (targetType === 'novel') {
        await tx.novel.update({
          where: { id: targetId },
          data: {
            totalVotes: voteType === 'like' ? { increment: 2 } : { decrement: 2 },
          },
        });
      } else if (targetType === 'chapter') {
        await tx.chapter.update({
          where: { id: targetId },
          data: {
            likes: existingVote.voteType === 'like' ? { decrement: 1 } : { increment: 1 },
            dislikes: existingVote.voteType === 'dislike' ? { decrement: 1 } : { increment: 1 },
            votes: voteType === 'like' ? { increment: 2 } : { decrement: 2 },
          },
        });
      } else if (targetType === 'continuation') {
        await tx.continuation.update({
          where: { id: targetId },
          data: {
            likes: existingVote.voteType === 'like' ? { decrement: 1 } : { increment: 1 },
            dislikes: existingVote.voteType === 'dislike' ? { decrement: 1 } : { increment: 1 },
            votes: voteType === 'like' ? { increment: 2 } : { decrement: 2 },
          },
        });
      }

      return { action: 'updated', voteType };
    }

    // 创建新投票记录
    await tx.voteRecord.create({
      data: {
        voterId: userId,
        targetType,
        targetId,
        voteType,
      },
    });

    // 更新目标计数
    if (targetType === 'novel') {
      await tx.novel.update({
        where: { id: targetId },
        data: {
          totalVotes: voteType === 'like' ? { increment: 1 } : { decrement: 1 },
        },
      });
    } else if (targetType === 'chapter') {
      await tx.chapter.update({
        where: { id: targetId },
        data: {
          likes: voteType === 'like' ? { increment: 1 } : {},
          dislikes: voteType === 'dislike' ? { increment: 1 } : {},
          votes: voteType === 'like' ? { increment: 1 } : { decrement: 1 },
        },
      });
    } else if (targetType === 'continuation') {
      await tx.continuation.update({
        where: { id: targetId },
        data: {
          likes: voteType === 'like' ? { increment: 1 } : {},
          dislikes: voteType === 'dislike' ? { increment: 1 } : {},
          votes: voteType === 'like' ? { increment: 1 } : { decrement: 1 },
        },
      });
    }

    // 更新用户投票统计
    await tx.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() }, // 触发更新
    });

    return { action: 'created', voteType };
  });

  // 更新作品的热度相关字段
  if (novelId) {
    await updateNovelStats(novelId);
  }

  return NextResponse.json({ code: 0, data: result });
}

// 辅助函数：更新作品统计
async function updateNovelStats(novelId: string) {
  // 计算总投票数（作品 + 章节 + 续写）
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: {
      chapters: { select: { votes: true } },
      continuations: { select: { votes: true } },
    },
  });

  if (!novel) return;

  const chaptersVotes = novel.chapters.reduce((sum, c) => sum + c.votes, 0);
  const continuationsVotes = novel.continuations.reduce((sum, c) => sum + c.votes, 0);
  const totalVotes = novel.totalVotes + chaptersVotes + continuationsVotes;

  await prisma.novel.update({
    where: { id: novelId },
    data: { totalVotes },
  });
}
