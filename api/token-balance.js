export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const owner = req.query?.owner;
  const mint = req.query?.mint;
  if (!owner || typeof owner !== 'string') {
    return res.status(400).json({ error: 'Missing owner parameter' });
  }

  const rpcEndpoints = [
    'https://solana-rpc.publicnode.com',
    'https://api.mainnet-beta.solana.com'
  ];

  // Mode 1: All held SPL + Token-2022 tokens for owner (when mint is omitted)
  if (!mint || typeof mint !== 'string') {
    const EXCLUDED_MINTS = new Set([
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    ]);
    for (const endpoint of rpcEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            {
              jsonrpc: '2.0',
              id: 1,
              method: 'getTokenAccountsByOwner',
              params: [
                owner,
                { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                { encoding: 'jsonParsed', commitment: 'confirmed' }
              ]
            },
            {
              jsonrpc: '2.0',
              id: 2,
              method: 'getTokenAccountsByOwner',
              params: [
                owner,
                { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' },
                { encoding: 'jsonParsed', commitment: 'confirmed' }
              ]
            }
          ])
        });

        if (response.ok) {
          const batch = await response.json();
          if (Array.isArray(batch)) {
            const byMint = new Map();
            for (const item of batch) {
              const accounts = item?.result?.value;
              if (!Array.isArray(accounts)) continue;
              for (const acc of accounts) {
                const parsed = acc?.account?.data?.parsed?.info;
                const tokenMint = parsed?.mint;
                const tokenAmount = parsed?.tokenAmount;
                if (!tokenMint || EXCLUDED_MINTS.has(tokenMint) || !tokenAmount) continue;
                const uiAmount = Number(tokenAmount.uiAmount || 0);
                if (uiAmount <= 0) continue;
                const decimals = tokenAmount.decimals ?? 6;
                const rawBig = BigInt(tokenAmount.amount || '0');
                const prev = byMint.get(tokenMint);
                if (prev) {
                  prev.rawBig += rawBig;
                  prev.uiAmount += uiAmount;
                } else {
                  byMint.set(tokenMint, { mint: tokenMint, rawBig, decimals, uiAmount });
                }
              }
            }
            const tokens = Array.from(byMint.values()).map(t => ({
              mint: t.mint,
              rawAmount: t.rawBig.toString(),
              decimals: t.decimals,
              uiAmount: t.uiAmount
            }));
            return res.status(200).json({ tokens });
          }
        }
      } catch (err) {
        // Try next RPC
      }
    }
    return res.status(502).json({ error: 'Failed to fetch wallet tokens' });
  }

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
