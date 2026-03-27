import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = 'cloud_configs';
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  if (req.method === 'GET') {
    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      let configs = await redis.get(key);
      if (typeof configs === 'string') configs = JSON.parse(configs);
      return res.status(200).json(configs || {});
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const newConfigs = req.body;
      await redis.set(key, JSON.stringify(newConfigs));
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}