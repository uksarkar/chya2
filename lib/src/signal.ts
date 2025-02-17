import { isFn } from "./utils";

export const EFFECT_GETTER = Symbol();
export const EFFECT_SETTER = Symbol();
export const RAW_STATE = Symbol();

// Global variables
let activeEffect: (() => void) | null = null;

// State managements
export function createEffect(fn: () => void) {
  activeEffect = fn;
  const clear = fn();
  activeEffect = null;

  return clear;
}

// Modify createSignal to track effects
export function createSignal<T>(
  initialValue: T | (() => T)
): [() => T, (newValue: T | ((prev: T) => T), notify?: boolean) => void] {
  let value = isFn(initialValue) ? (initialValue as () => T)() : initialValue;
  const subscribers = new Set<() => void>();

  function get() {
    if (activeEffect) {
      subscribers.add(activeEffect);
    }
    return value;
  }

  function set(newValue: T | ((prev: T) => T), notify = true) {
    const newVal = isFn(newValue)
      ? (newValue as (prev: T) => T)(value)
      : newValue;
    if (newVal !== value) {
      value = newVal;
      if (notify) {
        subscribers.forEach(fn => fn());
      }
    }
  }

  get[EFFECT_GETTER] = EFFECT_GETTER;
  get[EFFECT_SETTER] = set;
  set[EFFECT_SETTER] = EFFECT_SETTER;

  return [get, set];
}

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
