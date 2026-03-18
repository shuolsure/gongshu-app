import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ code: 1, message: '未登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      secondmeUserId: true,
      name: true,
      avatar: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ code: 1, message: '用户不存在' }, { status: 404 });
  }

  // 统计数据
  const novelCount = await prisma.novel.count({
    where: { authorId: userId },
  });

  const voteCount = await prisma.voteRecord.count({
    where: { voterId: userId },
  });

  return NextResponse.json({
    code: 0,
    data: {
      ...user,
      novelCount,
      voteCount,
    },
  });
}
