// 설정 모듈이 import되기 전에 테스트용 필수 환경 변수를 준비합니다.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-with-at-least-32-characters";
process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
process.env.REFRESH_TOKEN_TTL_SECONDS = "1209600";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_PORT = "5432";
process.env.DATABASE_NAME = "lynx_test";
process.env.DATABASE_USERNAME = "lynx_test";
process.env.DATABASE_PASSWORD = "lynx_test";
process.env.CORE_REDIS_HOST = "127.0.0.1";
process.env.CORE_REDIS_PORT = "6379";
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USERNAME = "test";
process.env.SMTP_PASSWORD = "test";
process.env.SMTP_FROM_EMAIL = "noreply@example.com";

// 단위 테스트가 실제 Redis 연결을 만들지 않도록 기본 provider를 대체합니다.
jest.mock("../src/provider/redis/redis-config.js", () => ({
  coreRedis: {
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));
