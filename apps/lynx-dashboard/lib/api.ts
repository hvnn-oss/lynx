import axios from "axios";
// import { ERROR_CODES } from "@repo/constants";

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

// // 액세스 토큰 만료 시 재발급
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalReq = error.config;
//     const errorData = error.response?.data;
//     if(
//         error.response?.status == 403 &&
//         error?.code == ERROR_CODES.TOKEN_EXPIRED &&
//         !originalReq._retry
//     ) {
//         originalReq._retry = true;
//         try {
//             const res = await axios.post(`/api/auth/refresh`, {
//             }, {
//                 withCredentials: true
//             });
//             const newUid = res.dat
//         }
//     }
// },
// );

export default api;
