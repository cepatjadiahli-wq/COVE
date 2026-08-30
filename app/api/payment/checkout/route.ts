import { NextRequest, NextResponse } from "next/server";
import { createMayarPaymentLink } from "@/lib/mayar/client";
import { SUBSCRIPTION_TIERS, SubscriptionTierId } from "@/lib/subscription/tiers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tierId, customerName, customerEmail, customerPhone } = body;

    const normalizedTierId: SubscriptionTierId =
      tierId === "monthly" || tierId === "monthly_129k"
        ? "monthly_129k"
        : tierId === "annual" || tierId === "annual_499k"
        ? "annual_499k"
        : "lifetime_799k";

    const tier = SUBSCRIPTION_TIERS[normalizedTierId];
    if (!tier) {
      return NextResponse.json({ error: "Paket langganan tidak valid." }, { status: 400 });
    }

    const name = customerName || "Kontraktor Indonesia";
    const email = customerEmail || "kontraktor@cove.id";
    const phone = customerPhone || "08123456789";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // If MAYAR_API_KEY is not provided (e.g. testing in dev), provide a mock checkout redirect for demonstration
    if (!process.env.MAYAR_API_KEY || process.env.MAYAR_API_KEY.includes("your-mayar")) {
      console.log(`[Mayar Simulation] Checkout created for ${tier.name} - Rp ${tier.price.toLocaleString("id-ID")}`);
      return NextResponse.json({
        success: true,
        simulation: true,
        tierName: tier.name,
        amount: tier.price,
        checkoutUrl: `${appUrl}/dashboard?payment_success=true&tier=${normalizedTierId}`,
        message: "Simulation checkout generated. In production, this redirects to Mayar QRIS/VA gateway.",
      });
    }

    // Call Mayar API
    const paymentResponse = await createMayarPaymentLink({
      name: `Langganan COVE - ${tier.name}`,
      amount: tier.price,
      customerName: name,
      customerEmail: email,
      customerMobile: phone,
      description: `Pembayaran ${tier.name} (${tier.billingPeriod}) Software Manajemen Keuangan Konstruksi COVE V1`,
      redirectUrl: `${appUrl}/dashboard?payment_success=true&tier=${normalizedTierId}`,
      metadata: {
        tierId: normalizedTierId,
        tierName: tier.name,
        customerEmail: email,
      },
    });

    if (paymentResponse?.data?.link) {
      return NextResponse.json({
        success: true,
        checkoutUrl: paymentResponse.data.link,
        amount: tier.price,
        tierName: tier.name,
      });
    } else {
      throw new Error(paymentResponse.message || "Gagal membuat tautan pembayaran Mayar.");
    }
  } catch (error: any) {
    console.error("Checkout API Error:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server saat membuat tagihan." },
      { status: 500 }
    );
  }
}
