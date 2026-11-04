export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

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
          id: 'memetinder-bh',
          method: 'getLatestBlockhash',
          params: [{ commitment: 'confirmed' }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const blockhash = data?.result?.value?.blockhash;
        if (blockhash) {
          return res.status(200).json({
            blockhash,
            lastValidBlockHeight: data.result.value.lastValidBlockHeight,
            rpc: endpoint
          });
        }
      }
    } catch (err) {
      // Try next RPC
    }
  }

  return res.status(502).json({ error: 'Failed to fetch latest blockhash' });
}
