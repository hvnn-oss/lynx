import { LlmInstrumentationRule, LynxContext } from "../core/types.js";
import { generateSpanId } from "../utils/id.js";
import { extractTokenUsage } from "../utils/usage.js";
import { LynxTracer } from "../core/tracer.js";

/**
 * Proxy를 사용해 다양한 LLM 클라이언트 인스턴스(OpenAI, Anthropic, Google Gen AI 등)를 동적으로 감시하고 추적을 기록합니다.
 */
export function instrumentLLM<T extends object>(
  tracer: LynxTracer,
  instance: T,
  optionsOrLabel: string | {
    modelLabel?: string;
    customRule?: Partial<LlmInstrumentationRule>;
  } = "llm.inference"
): T {
  const options = typeof optionsOrLabel === "string"
    ? { modelLabel: optionsOrLabel }
    : optionsOrLabel;

  const modelLabel = options.modelLabel ?? "llm.inference";
  const customRule = options.customRule;

  const isTargetLLMMethod = (path: string[]): boolean => {
    if (customRule?.isTargetMethod) {
      return customRule.isTargetMethod(path);
    }

    const pathStr = path.join(".");
    return (
      pathStr === "chat.completions.create" || // OpenAI
      pathStr === "messages.create" ||         // Anthropic (Claude)
      pathStr === "models.generateContent" ||  // Google Gen AI 신규
      pathStr === "generateContent" ||         // Google Generative AI 기존
      pathStr === "generateText" ||            // Vercel AI SDK
      pathStr === "streamText" ||             // Vercel AI SDK
      pathStr === "generateObject" ||          // Vercel AI SDK
      pathStr === "streamObject" ||            // Vercel AI SDK
      pathStr === "ollama.chat" ||             // Ollama Chat
      pathStr === "ollama.generate" ||         // Ollama Generate
      pathStr === "cohere.chat" ||             // Cohere Chat
      pathStr === "cohere.generate" ||         // Cohere Generate
      pathStr === "chat" ||                    // Ollama/Cohere direct
      pathStr === "invoke" ||                  // LangChain
      pathStr === "predict"                    // LangChain
    );
  };

  const createRecursiveProxy = (target: any, path: string[] = []): any => {
    if (target == null || (typeof target !== "object" && typeof target !== "function")) {
      return target;
    }

    return new Proxy(target, {
      get(obj, prop) {
        if (typeof prop === "symbol") {
          return Reflect.get(obj, prop);
        }

        const val = obj[prop];
        const newPath = [...path, prop];

        if (typeof val === "function" && isTargetLLMMethod(newPath)) {
          return async function (this: any, ...args: any[]) {
            const context = LynxTracer.getStore();
            const spanId = generateSpanId();
            const parentSpanId = context?.spanId;
            const startTime = Date.now();

            const rawInput = customRule?.extractInput
              ? customRule.extractInput(args)
              : args[0];

            if (context) {
              tracer.captureInternal("LLM_REASONING", modelLabel, {
                input: rawInput,
                path: newPath.join("."),
                spanId,
                parentSpanId
              }, context);
            }

            try {
              const result = Reflect.apply(val, obj, args);
              const resolvedResult = result instanceof Promise ? await result : result;
              const latency = Date.now() - startTime;
              
              const rawOutput = customRule?.extractOutput
                ? customRule.extractOutput(resolvedResult)
                : resolvedResult;

              const usage = customRule?.extractUsage
                ? customRule.extractUsage(resolvedResult)
                : extractTokenUsage(resolvedResult);

              if (context) {
                tracer.captureInternal("LLM_REASONING", modelLabel, {
                  output: rawOutput,
                  spanId,
                  parentSpanId,
                  latency,
                  usage
                }, context);
              }
              return resolvedResult;
            } catch (err: unknown) {
              const error = err as Error;
              const latency = Date.now() - startTime;
              if (context) {
                tracer.captureInternal("ERROR", modelLabel, {
                  error: error.message,
                  spanId,
                  parentSpanId,
                  latency
                }, context);
              }
              throw err;
            }
          };
        }

        if (val && (typeof val === "object" || typeof val === "function")) {
          return createRecursiveProxy(val, newPath);
        }

        return val;
      },
    });
  };

  return createRecursiveProxy(instance);
}

/**
 * 도구 함수를 래핑하여 실행 매개변수와 반환 결과 및 오류를 추적합니다.
 */
export function instrumentTool<T extends (...args: any[]) => any>(
  tracer: LynxTracer,
  toolName: string,
  fn: T,
): T {
  return (async (...args: any[]) => {
    const context = LynxTracer.getStore();
    const spanId = generateSpanId();
    const parentSpanId = context?.spanId;
    const startTime = Date.now();

    if (context) {
      tracer.captureInternal("CALL_TOOLS", toolName, {
        input: args[0],
        spanId,
        parentSpanId
      }, context);
    }

    try {
      const result = fn(...args);
      const resolvedResult = result instanceof Promise ? await result : result;
      const latency = Date.now() - startTime;
      
      if (context) {
        tracer.captureInternal("CALL_TOOLS", toolName, {
          output: resolvedResult,
          spanId,
          parentSpanId,
          latency
        }, context);
      }
      return resolvedResult;
    } catch (err: unknown) {
      const error = err as Error;
      const latency = Date.now() - startTime;
      if (context) {
        tracer.captureInternal("ERROR", toolName, {
          error: error.message,
          spanId,
          parentSpanId,
          latency
        }, context);
      }
      throw err;
    }
  }) as unknown as T;
}
