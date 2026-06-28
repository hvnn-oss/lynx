import axios from "axios";
import { ERROR_CODES } from "@repo/constants";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// api 요청 시 헤더에 액세스 토큰 추가
api.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("_uid") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 액세스 토큰 만료 시 재발급
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalReq = error.config;
    const errorResponse = error.response;
    const errCode = errorResponse?.data?.error_code || (errorResponse?.data?.errors && errorResponse?.data?.errors[0]?.error_code);
    
    if (
      errorResponse &&
      (errorResponse.status === 401 || errorResponse.status === 403) &&
      errCode === ERROR_CODES.TOKEN_EXPIRED &&
      !originalReq._retry
    ) {
      originalReq._retry = true;
      try {
        const res = await axios.post(
          `/api/auth/refresh`,
          {},
          {
            withCredentials: true,
          }
        );
        if (res.data.success && res.data.accessToken) {
          localStorage.setItem("_uid", res.data.accessToken);
          originalReq.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(originalReq);
        }
      } catch (refreshError) {
        // 리프레시 토큰 만료/오류 시 세션 만료 처리 및 로그인 페이지 이동
        localStorage.removeItem("_uid");
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

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

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

function cleanParams(params?: QueryParams): QueryParams | undefined {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as QueryParams;
}
