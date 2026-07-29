import { bootstrapContract } from "@repo/contract";
import type { DashboardBootstrapResponseDto } from "@repo/dto";
import { requestContract } from "./api";

/** Loads the authenticated dashboard context in one request. */
export function getDashboardBootstrap(): Promise<DashboardBootstrapResponseDto> {
  return requestContract({
    basePath: bootstrapContract.basePath,
    endpoint: bootstrapContract.get,
  });
}
