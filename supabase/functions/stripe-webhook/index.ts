import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  'https://nvxbkbiistmbsrjpvxlk.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY') as string
)

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const eventType = body.type
    const obj = body.data?.object

    // checkout.session.completed — use metadata.userId
    if (eventType === 'checkout.session.completed') {
      const userId = obj?.metadata?.userId
      if (userId) {
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
            .update({ stripe_subscription_id: obj.subscription ?? null, active: true })
            .eq('id', rows[0].id)
        }
      }
    }

    // customer.subscription.created — use subscription metadata.userId
    if (eventType === 'customer.subscription.created') {
      const userId = obj?.metadata?.userId
      if (userId) {
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
            .update({ stripe_subscription_id: obj.id ?? null, active: true })
            .eq('id', rows[0].id)
        }
      }
    }

    // customer.subscription.updated — deactivate if cancelled
    if (eventType === 'customer.subscription.updated') {
      const active = obj?.status === 'active'
      if (obj?.id) {
        await supabase
          .from('member_memberships')
          .update({ active })
          .eq('stripe_subscription_id', obj.id)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})