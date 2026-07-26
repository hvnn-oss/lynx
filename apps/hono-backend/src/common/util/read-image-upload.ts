import type { Context } from "hono";
import { env } from "../config/config.js";
import { BadRequestErrorException } from "../exceptions/bad-request.js";
import type { AppEnv } from "../types/app-env.js";

export interface ImageUploadBody {
  contentType: string;
  bytes: Uint8Array;
}

/** raw 이미지 요청의 MIME 타입과 크기를 확인하고 바이트를 읽습니다. */
export async function readImageUpload(
  context: Context<AppEnv>,
): Promise<ImageUploadBody> {
  const contentType = context.req
    .header("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!contentType) {
    throw new BadRequestErrorException("PROFILE_IMAGE_CONTENT_TYPE_REQUIRED");
  }

  const contentLength = Number(context.req.header("Content-Length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > env.IMAGE_MAX_UPLOAD_BYTES
  ) {
    throw new BadRequestErrorException("PROFILE_IMAGE_TOO_LARGE");
  }

  const bytes = new Uint8Array(await context.req.arrayBuffer());
  if (bytes.byteLength > env.IMAGE_MAX_UPLOAD_BYTES) {
    throw new BadRequestErrorException("PROFILE_IMAGE_TOO_LARGE");
  }

  return { contentType, bytes };
}
