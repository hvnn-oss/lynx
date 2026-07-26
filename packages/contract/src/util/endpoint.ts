export type ContractSchema = {
  parse(input: unknown): unknown;
  _zod: {
    input: unknown;
    output: unknown;
  };
};
export type ContractSchemaInput<TSchema> =
  TSchema extends { _zod: { input: infer TInput } } ? TInput : never;
export type ContractSchemaOutput<TSchema> =
  TSchema extends { _zod: { output: infer TOutput } } ? TOutput : never;

export type ContractEndpoint = {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  path: `/${string}`;
  request: ContractSchema | null;
  response: ContractSchema | null;
  params?: ContractSchema;
};

export function defineEndpoint<
  const TMethod extends ContractEndpoint["method"],
  const TPath extends `/${string}`,
  TRequest extends ContractSchema | null,
  TResponse extends ContractSchema | null,
  TParams extends ContractSchema | undefined = undefined,
>(endpoint: {
  method: TMethod;
  path: TPath;
  request: TRequest;
  response: TResponse;
  params?: TParams;
}) {
  return endpoint;
}
