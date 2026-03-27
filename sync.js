import { Redis } from '@upstash/redis';
import { syncWithExternalServices } from '../lib/syncServices';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // قراءة البيانات الأساسية
    const dataKey = 'markets_app_data';
    let mainData = await redis.get(dataKey);
    if (typeof mainData === 'string') mainData = JSON.parse(mainData);
    if (!mainData) {
      return res.status(404).json({ error: 'No data found' });
    }

    // قراءة إعدادات الخدمات
    const configsKey = 'cloud_configs';
    let configs = await redis.get(configsKey);
    if (typeof configs === 'string') configs = JSON.parse(configs);
    if (!configs) configs = {};

    // المزامنة
    const results = await syncWithExternalServices(mainData, configs);

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
}