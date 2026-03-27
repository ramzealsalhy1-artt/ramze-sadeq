import { Redis } from '@upstash/redis';
import { syncWithExternalServices } from '../lib/syncServices';

const redis = Redis.fromEnv();

// البيانات الافتراضية (يمكنك استيرادها من ملف منفصل أو تضمينها هنا)
// نضع بيانات افتراضية مبسطة لضمان التشغيل
const defaultData = {
  header: {
    title: "أسواق ريادة المستهلك",
    subtitle: "أفضل المتاجر والمنتجات بأفضل الأسعار",
    images: [
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&h=600&fit=crop"
    ]
  },
  ticker: ["🔥 عروض حصرية تصل إلى 50% خصم", "💎 أشهر الماركات العالمية"],
  carousel: [],
  design: {
    categoryBg: "linear-gradient(145deg, #f9eef7, #f3d9e8)",
    categoryText: "#9b4d96",
    categoryFontSize: "2rem",
    storeBg: "#ffffff",
    storeText: "#1e293b",
    storeFontSize: "1.3rem",
    productBg: "#ffffff",
    productText: "#1e293b",
    productFontSize: "0.85rem",
    adBg: "linear-gradient(90deg, #fbbf24, #f59e0b)",
    adText: "#0f172a",
    adFontSize: "1.1rem",
    generalFontSize: "1rem"
  },
  categories: [],
  stores: {},
  products: {},
  testimonials: [],
  footer: {
    email: "support@example.com",
    phone: "+966 123 456 789",
    whatsapp: "https://wa.me/966123456789",
    social: [],
    payments: ["fab fa-cc-visa", "fab fa-cc-mastercard"]
  },
  settings: {
    currency: "SAR",
    language: "ar",
    showSaudiFlag: false,
    cartEnabled: true,
    enableUserProfile: true,
    orderMethods: { whatsapp: true, email: true, chat: true },
    trustBadges: [],
    contests: [],
    contactEmail: "admin@example.com"
  },
  messages: [],
  indexes: {}
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = 'markets_app_data';
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  // GET: جلب البيانات
  if (req.method === 'GET') {
    try {
      let data = await redis.get(key);
      if (!data) {
        // إذا كانت البيانات غير موجودة، نخزن البيانات الافتراضية
        await redis.set(key, JSON.stringify(defaultData));
        return res.status(200).json(defaultData);
      }
      if (typeof data === 'string') data = JSON.parse(data);
      return res.status(200).json(data);
    } catch (error) {
      console.error('GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
  }

  // POST: تحديث البيانات
  if (req.method === 'POST') {
    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const newData = req.body;
      // حفظ في Redis
      await redis.set(key, JSON.stringify(newData));

      // جلب إعدادات الخدمات السحابية من Redis
      const configsKey = 'cloud_configs';
      let configs = await redis.get(configsKey);
      if (typeof configs === 'string') configs = JSON.parse(configs);
      if (!configs) configs = {};

      // المزامنة التلقائية إذا كانت مفعّلة
      let syncResults = null;
      if (configs.autoSync === true) {
        syncResults = await syncWithExternalServices(newData, configs);
      }

      return res.status(200).json({ success: true, autoSync: configs.autoSync, syncResults });
    } catch (error) {
      console.error('POST error:', error);
      return res.status(500).json({ error: 'Failed to save data', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}