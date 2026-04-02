import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPartnerInquiryAlert } from '@/lib/email/impact';

// GET /api/impact/partners — active partners for public display
export async function GET() {
  const partners = await prisma.impactPartner.findMany({
    where: { isActive: true },
    select: {
      id: true,
      companyName: true,
      tier: true,
      logoUrl: true,
      websiteUrl: true,
    },
    orderBy: [
      { tier: 'desc' }, // sustaining first
      { companyName: 'asc' },
    ],
  });

  return NextResponse.json({ partners });
}

// POST /api/impact/partners — partner inquiry (no auth required)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { companyName, contactName, contactEmail, tier, message } = body;

  if (!companyName || !contactEmail || !tier) {
    return NextResponse.json(
      { error: 'companyName, contactEmail, and tier are required' },
      { status: 400 }
    );
  }

  // Store as an inactive partner record (admin reviews and activates)
  await prisma.impactPartner.create({
    data: {
      companyName,
      contactName: contactName ?? null,
      contactEmail,
      tier,
      annualAmount: 0, // set by admin after conversation
      activeFrom: new Date(),
      isActive: false,
      notes: message ?? null,
    },
  });

  // Fire-and-forget: alert admin of new partner inquiry
  sendPartnerInquiryAlert({
    companyName,
    contactName: contactName ?? null,
    contactEmail: contactEmail ?? null,
    tier,
    notes: message ?? null,
  }).catch(() => {});

  return NextResponse.json({ success: true }, { status: 201 });
}
