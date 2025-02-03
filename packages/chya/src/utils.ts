export const isFn = (fn: unknown): fn is Function => typeof fn === "function";
export const evaluate = (expression: string | null, scope?: unknown) => {
  return new Function("scope", `with(scope) { return ${expression} }`)(
    scope || {}
  );
};
