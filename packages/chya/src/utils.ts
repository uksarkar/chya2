import { createSignal, EFFECT_GETTER, EFFECT_SETTER } from "./signal";

export const RAW_STATE = Symbol();
export const isFn = (fn: unknown): fn is Function => typeof fn === "function";

export const evaluate = (
  expression: string | null,
  scope?: Record<string, unknown>
) => {
  return new Function("scope", `with(scope) { return ${expression} }`)(
    scope || {}
  );
};

export const extractAttrExpr = (name: string, startsFrom: number) =>
  name.slice(startsFrom).split(".");

export const buildState = (state: Record<string, unknown>) => {
  const newState = {
    [RAW_STATE]: () => state
  };
  Object.keys(state).forEach(key => {
    if (!isFn(state[key])) {
      state[key] = createSignal(state[key])[0];
    }
    Object.defineProperty(newState, key, {
      get: () => {
        if (state[key] && state[key][EFFECT_GETTER as keyof unknown]) {
          return (state[key] as () => unknown)();
        }

        return state[key];
      },
      set: val => {
        if (state[key] && isFn(state[key][EFFECT_SETTER as keyof unknown])) {
          (state[key][EFFECT_SETTER as keyof unknown] as (v: unknown) => void)(
            val
          );
        }
      }
    });
  });

  return newState;
};
