export default function handler(req, res) {
  res.status(200).json({
    message: 'pong',
    env: {
      hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  });
}
