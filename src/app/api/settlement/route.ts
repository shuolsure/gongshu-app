import { NextRequest, NextResponse } from 'next/server';
import { runDailySettlement, getSettlementReport } from '@/lib/settlement';

// GET: 获取结算状态报告
export async function GET() {
  const report = await getSettlementReport();
  return NextResponse.json({ code: 0, data: report });
}

// POST: 执行每日结算
export async function POST(request: NextRequest) {
  // 简单的 API Key 验证（生产环境应使用更安全的方式）
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.SETTLEMENT_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json(
      { code: 1, message: '未授权' },
      { status: 401 }
    );
  }

  try {
    const results = await runDailySettlement();
    
    const summary = {
      total: results.length,
      settled: results.filter(r => r.settled).length,
      skipped: results.filter(r => !r.settled).length,
      goldenThreeChapters: results.filter(r => r.goldenThreeChapters).length,
    };

    return NextResponse.json({ 
      code: 0, 
      data: { summary, details: results } 
    });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json(
      { code: 1, message: '结算执行失败' },
      { status: 500 }
    );
  }
}
