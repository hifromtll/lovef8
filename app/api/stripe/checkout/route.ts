import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const BOOSTER_PACKS: Record<string, { name: string; amountCents: number; sparks: number }> = {
  booster_350: { name: '350 Sparks Booster', amountCents: 499, sparks: 350 },
  booster_850: { name: '850 Sparks Booster', amountCents: 999, sparks: 850 },
  booster_2100: { name: '2100 Sparks Booster', amountCents: 1999, sparks: 2100 },
  booster_3600: { name: '3600 Sparks Booster', amountCents: 2999, sparks: 3600 },
};

const MEMBERSHIP_PLANS: Record<string, { name: string; amountCents: number; sparks: number; interval: 'month' }> = {
  membership_basic: { name: 'Basic Membership', amountCents: 499, sparks: 430, interval: 'month' },
  membership_plus: { name: 'Plus Membership', amountCents: 999, sparks: 1100, interval: 'month' },
  membership_premium: { name: 'Premium Membership', amountCents: 1999, sparks: 2400, interval: 'month' },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { itemKey, itemType, userId, email } = body as {
      itemKey?: string;
      itemType?: 'booster' | 'membership';
      userId?: string;
      email?: string;
    };

    if (!userId) {
      return Response.json({ error: 'Missing userId.' }, { status: 400 });
    }

    if (!itemType || !itemKey) {
      return Response.json({ error: 'Missing itemType or itemKey.' }, { status: 400 });
    }

    if (itemType === 'booster') {
      const pack = BOOSTER_PACKS[itemKey];

      if (!pack) {
        return Response.json({ error: 'Invalid booster pack.' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${SITE_URL}/wallet?purchase=success&type=booster`,
        cancel_url: `${SITE_URL}/wallet?purchase=cancelled&type=booster`,
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pack.name,
                description: `${pack.sparks} Sparks one-time booster for LoveF8`,
              },
              unit_amount: pack.amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: userId,
          item_type: 'booster',
          item_key: itemKey,
          sparks: String(pack.sparks),
        },
      });

      return Response.json({ url: session.url });
    }

    if (itemType === 'membership') {
      const plan = MEMBERSHIP_PLANS[itemKey];

      if (!plan) {
        return Response.json({ error: 'Invalid membership plan.' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: `${SITE_URL}/wallet?purchase=success&type=membership`,
        cancel_url: `${SITE_URL}/wallet?purchase=cancelled&type=membership`,
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              recurring: {
                interval: plan.interval,
              },
              product_data: {
                name: plan.name,
                description: `${plan.sparks} Sparks every 30 days for LoveF8`,
              },
              unit_amount: plan.amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: userId,
          item_type: 'membership',
          item_key: itemKey,
          sparks: String(plan.sparks),
        },
      });

      return Response.json({ url: session.url });
    }

    return Response.json({ error: 'Invalid itemType.' }, { status: 400 });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: 'Unable to create checkout session.' }, { status: 500 });
  }
}