import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, orderId, config } = body
    
    if (!config?.access_token) {
      throw new Error('Pagar.me Access Token is required')
    }

    const authHeader = `Basic ${btoa(config.access_token + ':')}`

    if (action === 'check_status' && orderId) {
      console.log(`🔍 Checking status for Pagar.me order: ${orderId}`)
      const response = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      })
      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      })
    }

    // Default action: Create order
    const { orderData } = body
    console.log('📦 Processing payment with Pagar.me API...')
    
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(orderData)
    })

    const data = await response.json()
    console.log('📡 Pagar.me Response:', JSON.stringify(data, null, 2))

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    })
  } catch (error) {
    console.error('❌ Error in pagarme-proxy:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
