/** SDK가 별도 설정 없이 사용하는 런타임 설정 갱신 간격입니다. */
export const DEFAULT_RUNTIME_CONFIG_REFRESH_INTERVAL_MS = 60_000;

/** SDK가 설정할 수 있는 가장 짧은 런타임 설정 갱신 간격입니다. */
export const MINIMUM_RUNTIME_CONFIG_REFRESH_INTERVAL_MS = 5_000;

/** 서버가 대상별 런타임 설정 번들을 메모리에 유지하는 시간입니다. */
export const RUNTIME_CONFIG_SERVER_CACHE_TTL_MS = 30_000;
