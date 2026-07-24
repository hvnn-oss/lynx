import axios from "axios";
import { ERROR_CODES } from "@repo/constants";
import { authContract, getAuthEndpointPath } from "@repo/contract";

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
    refreshPromise = axios
      .post(
        `/api${getAuthEndpointPath(authContract.refresh)}`,
        {},
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

export default api;

export type QueryParams = object;

export async function getJson<T>(
  url: string,
  params?: QueryParams,
): Promise<T> {
  const response = await api.get<T>(url, { params: cleanParams(params) });
  return response.data;
}

export async function postJson<TResponse, TBody>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await api.post<TResponse>(url, body);
  return response.data;
}

function cleanParams(
  params?: QueryParams,
): Record<string, unknown> | undefined {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
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
