// lib/syncServices.js
// دوال المزامنة مع الخدمات الخارجية – استيراد ديناميكي لتحمل الأعطال

/**
 * مزامنة البيانات مع جميع الخدمات الخارجية المفعّلة
 * @param {Object} data - البيانات الرئيسية للموقع
 * @param {Object} configs - إعدادات الخدمات الخارجية (مخزنة في Redis)
 * @returns {Promise<Object>} نتائج المزامنة لكل خدمة
 */
export async function syncWithExternalServices(data, configs) {
  const results = {};

  for (const [serviceName, serviceConfig] of Object.entries(configs)) {
    if (!serviceConfig.enabled) continue;
    try {
      switch (serviceName) {
        case 'firebase':
          results.firebase = await syncToFirebase(data, serviceConfig.config);
          break;
        case 'supabase':
          results.supabase = await syncToSupabase(data, serviceConfig.config);
          break;
        case 'aws_dynamodb':
          results.aws_dynamodb = await syncToDynamoDB(data, serviceConfig.config);
          break;
        case 'firestore':
          results.firestore = await syncToFirestore(data, serviceConfig.config);
          break;
        case 'mongodb_atlas':
          results.mongodb_atlas = await syncToMongoDB(data, serviceConfig.config);
          break;
        case 'back4app':
          results.back4app = await syncToBack4App(data, serviceConfig.config);
          break;
        case 'redis_external':
          results.redis_external = await syncToExternalRedis(data, serviceConfig.config);
          break;
        case 'vercel_json':
          results.vercel_json = await syncToVercelJSON(data, serviceConfig.config);
          break;
        case 'netlify_json':
          results.netlify_json = await syncToNetlifyJSON(data, serviceConfig.config);
          break;
        case 'digitalocean_spaces':
          results.digitalocean_spaces = await syncToDigitalOceanSpaces(data, serviceConfig.config);
          break;
        case 'custom_rest':
          results.custom_rest = await syncToCustomREST(data, serviceConfig.config);
          break;
        default:
          results[serviceName] = { success: false, error: 'Service not implemented' };
      }
    } catch (err) {
      results[serviceName] = { success: false, error: err.message };
    }
  }
  return results;
}

// ================== دوال المزامنة مع استيراد ديناميكي ==================

/**
 * Firebase Realtime Database
 */
async function syncToFirebase(data, config) {
  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(config.serviceAccount),
        databaseURL: config.databaseURL
      });
    }
    const db = admin.database();
    await db.ref('markets_app_data').set(data);
    return { success: true };
  } catch (error) {
    console.warn('Firebase sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Supabase
 */
async function syncToSupabase(data, config) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.url, config.anonKey);
    const { error } = await supabase
      .from('markets_data')
      .upsert({ id: 'markets_app_data', data }, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error) {
    console.warn('Supabase sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * AWS DynamoDB
 */
async function syncToDynamoDB(data, config) {
  try {
    const AWS = await import('aws-sdk');
    AWS.config.update({
      region: config.region,
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    });
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const params = {
      TableName: config.table,
      Item: { id: 'markets_app_data', data: JSON.stringify(data) }
    };
    await dynamodb.put(params).promise();
    return { success: true };
  } catch (error) {
    console.warn('DynamoDB sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Google Cloud Firestore
 */
async function syncToFirestore(data, config) {
  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(config.serviceAccount),
        projectId: config.projectId
      });
    }
    const db = admin.firestore();
    await db.collection('markets').doc('app_data').set({ data });
    return { success: true };
  } catch (error) {
    console.warn('Firestore sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * MongoDB Atlas
 */
async function syncToMongoDB(data, config) {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(config.uri);
    await client.connect();
    const db = client.db(config.database);
    const collection = db.collection(config.collection);
    await collection.updateOne(
      { _id: 'app_data' },
      { $set: { data } },
      { upsert: true }
    );
    await client.close();
    return { success: true };
  } catch (error) {
    console.warn('MongoDB sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Back4App (Parse Server)
 */
async function syncToBack4App(data, config) {
  try {
    const Parse = await import('parse/node');
    Parse.initialize(config.appId, config.restKey);
    Parse.serverURL = 'https://parseapi.back4app.com';
    const MarketsData = Parse.Object.extend('MarketsData');
    const query = new Parse.Query(MarketsData);
    const existing = await query.equalTo('name', 'app_data').first();
    if (existing) {
      existing.set('data', JSON.stringify(data));
      await existing.save();
    } else {
      const newEntry = new MarketsData();
      newEntry.set('name', 'app_data');
      newEntry.set('data', JSON.stringify(data));
      await newEntry.save();
    }
    return { success: true };
  } catch (error) {
    console.warn('Back4App sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Redis خارجي
 */
async function syncToExternalRedis(data, config) {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(config.url);
    await redis.set('markets_app_data', JSON.stringify(data));
    await redis.quit();
    return { success: true };
  } catch (error) {
    console.warn('External Redis sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Vercel JSON Store (عبر API)
 */
async function syncToVercelJSON(data, config) {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.post(
      `https://api.vercel.com/v1/projects/${config.projectId}/data`,
      { data },
      { headers: { Authorization: `Bearer ${config.token}` } }
    );
    if (response.status !== 200) throw new Error('Vercel sync failed');
    return { success: true };
  } catch (error) {
    console.warn('Vercel JSON sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Netlify JSON Store
 */
async function syncToNetlifyJSON(data, config) {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.post(
      `https://api.netlify.com/api/v1/sites/${config.siteId}/deploys`,
      { files: { 'data.json': JSON.stringify(data) } },
      { headers: { Authorization: `Bearer ${config.token}` } }
    );
    if (response.status !== 200) throw new Error('Netlify sync failed');
    return { success: true };
  } catch (error) {
    console.warn('Netlify JSON sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * DigitalOcean Spaces (S3-compatible)
 */
async function syncToDigitalOceanSpaces(data, config) {
  try {
    const AWS = await import('aws-sdk');
    const spacesEndpoint = new AWS.Endpoint(config.endpoint);
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    });
    const params = {
      Bucket: config.bucket,
      Key: 'markets_app_data.json',
      Body: JSON.stringify(data),
      ContentType: 'application/json',
      ACL: 'public-read'
    };
    await s3.putObject(params).promise();
    return { success: true };
  } catch (error) {
    console.warn('DigitalOcean Spaces sync error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * واجهة REST مخصصة
 */
async function syncToCustomREST(data, config) {
  try {
    const axios = (await import('axios')).default;
    const url = config.baseUrl + (config.dataPath || '');
    const headers = {
      'Content-Type': 'application/json',
      ...(config.headers || {})
    };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const response = await axios({
      method: config.method || 'POST',
      url,
      data,
      headers
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Custom REST sync failed: ${response.status}`);
    }
    return { success: true };
  } catch (error) {
    console.warn('Custom REST sync error:', error.message);
    return { success: false, error: error.message };
  }
}