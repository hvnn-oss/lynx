export function defineEndpoint<
  const TMethod extends "GET" | "POST" | "DELETE" | "PUT" | "PATCH" | "DELETE",
  const TPath extends `/${string}`,
  TRequest,
  TResponse,
  TParams = undefined,
>(endpoint: {
  method: TMethod;
  path: TPath;
  request: TRequest;
  response: TResponse;
  params?: TParams;
}) {
  return endpoint;
}
