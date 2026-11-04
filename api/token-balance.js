export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const owner = req.query?.owner;
  const mint = req.query?.mint;
  if (!owner || !mint || typeof owner !== 'string' || typeof mint !== 'string') {
    return res.status(400).json({ error: 'Missing owner or mint parameter' });
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
          id: 'memetinder-tokbal',
          method: 'getTokenAccountsByOwner',
          params: [
            owner,
            { mint },
            { encoding: 'jsonParsed', commitment: 'confirmed' }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const accounts = data?.result?.value;
        if (Array.isArray(accounts)) {
          let totalRaw = 0n;
          let decimals = 6;
          let uiAmount = 0;

          for (const acc of accounts) {
            const tokenAmount = acc?.account?.data?.parsed?.info?.tokenAmount;
            if (tokenAmount) {
              decimals = tokenAmount.decimals ?? 6;
              totalRaw += BigInt(tokenAmount.amount || '0');
              uiAmount += Number(tokenAmount.uiAmount || 0);
            }
          }

          return res.status(200).json({
            rawAmount: totalRaw.toString(),
            decimals,
            uiAmount
          });
        }
      }
    } catch (err) {
      // Try next RPC
    }
  }

  return res.status(502).json({ error: 'Failed to fetch token balance' });
}
