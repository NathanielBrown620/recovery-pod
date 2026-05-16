import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  'https://nvxbkbiistmbsrjpvxlk.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY') as string
)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') as string
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, membershipId, podId } = session.metadata!

    // Update the most recent inactive membership for this user
    const { data: rows } = await supabase
      .from('member_memberships')
      .select('id')
      .eq('profile_id', userId)
      .eq('active', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (rows && rows.length > 0) {
      await supabase
        .from('member_memberships')
        .update({
          stripe_subscription_id: session.subscription as string,
          active: true,
        })
        .eq('id', rows[0].id)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const active = subscription.status === 'active'

    await supabase
      .from('member_memberships')
      .update({ active })
      .eq('stripe_subscription_id', subscription.id)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
