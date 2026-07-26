import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, id, source } = body as {
      type?: string;
      id?: string;
      source?: string;
    };

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing required fields: type, id' }, { status: 400 });
    }

    // Simulate installation — in production, this would use the SDK to install
    const installResult = {
      success: true,
      type,
      id,
      source: source ?? 'auto',
      installedAt: new Date().toISOString(),
      message: `${type} "${id}" installed successfully from ${source ?? 'auto'}`,
    };

    return NextResponse.json(installResult);
  } catch (error) {
    console.error('POST /api/ecosystem/install error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Install failed' },
      { status: 500 },
    );
  }
}
