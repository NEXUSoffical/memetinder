export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const pubkey = req.query?.pubkey;
  if (!pubkey || typeof pubkey !== 'string') {
    return res.status(400).json({ error: 'Missing pubkey parameter' });
  }

  const rpcEndpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-rpc.publicnode.com'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'memetinder-bal',
          method: 'getBalance',
          params: [pubkey, { commitment: 'confirmed' }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data?.result?.value === 'number') {
          return res.status(200).json({
            lamports: data.result.value,
            sol: data.result.value / 1e9,
            rpc: endpoint
          });
        }
      }
    } catch (err) {
      // Try next RPC
    }
  }

  return res.status(502).json({ error: 'Failed to fetch balance from Solana RPCs' });
}
