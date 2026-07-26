import axios from "axios";
import { ERROR_CODES } from "@repo/constants";
import {
  authContract,
  getAuthEndpointPath,
  type ContractEndpoint,
  type ContractSchemaInput,
  type ContractSchemaOutput,
} from "@repo/contract";

const ACCESS_TOKEN_STORAGE_KEY = "_uid";
const TOKEN_REFRESH_BUFFER_SECONDS = 30;

let refreshPromise: Promise<string> | null = null;

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

interface RetryableRequestConfig {
  _retry?: boolean;
  headers?: Record<string, string>;
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

export function clearStoredAccessToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function isAccessTokenExpired(accessToken: string) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + TOKEN_REFRESH_BUFFER_SECONDS;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    const request = authContract.refresh.request.parse({});
    refreshPromise = axios
      .post(
        `/api${getAuthEndpointPath(authContract.refresh)}`,
        request,
        {
          withCredentials: true,
        },
      )
      .then((res) => {
        const response = authContract.refresh.response.parse(res.data);
        setStoredAccessToken(response.access_token);
        return response.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

// API 요청 헤더에 access token을 추가합니다.
api.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// access token이 만료되면 refresh token으로 한 번만 재발급을 시도합니다.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalReq = error.config as
      | (typeof error.config & RetryableRequestConfig)
      | undefined;
    const errorResponse = error.response;
    const errCode =
      errorResponse?.data?.code ||
      errorResponse?.data?.error_code ||
      (errorResponse?.data?.errors && errorResponse.data.errors[0]?.error_code);

    if (
      originalReq &&
      errorResponse &&
      (errorResponse.status === 401 || errorResponse.status === 403) &&
      errCode === ERROR_CODES.TOKEN_EXPIRED &&
      !originalReq._retry
    ) {
      originalReq._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalReq.headers = {
          ...originalReq.headers,
          Authorization: `Bearer ${accessToken}`,
        };
        return api(originalReq);
      } catch (refreshError) {
        clearStoredAccessToken();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

type ContractRequestOptions<TEndpoint extends ContractEndpoint> = {
  basePath: string;
  endpoint: TEndpoint;
} & ([NonNullable<TEndpoint["params"]>] extends [never]
  ? { params?: never }
  : {
      params: ContractSchemaInput<NonNullable<TEndpoint["params"]>>;
    }) &
  (TEndpoint["request"] extends null
    ? { request?: never }
    : { request: ContractSchemaInput<TEndpoint["request"]> });

export async function requestContract<TEndpoint extends ContractEndpoint>({
  basePath,
  endpoint,
  params,
  request,
}: ContractRequestOptions<TEndpoint>): Promise<
  ContractSchemaOutput<TEndpoint["response"]>
> {
  const parsedParams = endpoint.params?.parse(params);
  const parsedRequest = endpoint.request?.parse(request);
  const path = buildContractPath(basePath, endpoint.path, parsedParams);
  const isQueryRequest = endpoint.method === "GET";
  const response = await api.request<unknown>({
    method: endpoint.method,
    url: path,
    params: isQueryRequest ? cleanParams(parsedRequest) : undefined,
    data: isQueryRequest ? undefined : parsedRequest,
  });

  if (!endpoint.response) return undefined as ContractSchemaOutput<
    TEndpoint["response"]
  >;

  return endpoint.response.parse(response.data) as ContractSchemaOutput<
    TEndpoint["response"]
  >;
}

function cleanParams(
  params?: unknown,
): Record<string, unknown> | undefined {
  if (!params || typeof params !== "object") return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
}

function buildContractPath(
  basePath: string,
  pathTemplate: string,
  params: unknown,
) {
  const pathParams =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {};
  const path = pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = pathParams[key];
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Missing contract path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });

  return `${basePath}${path}`;
}

function decodeJwtPayload(accessToken: string): { exp?: number } | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(paddedPayload)) as { exp?: number };
  } catch {
    return null;
  }
}
