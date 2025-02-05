import { isFn } from "./utils";

export const EFFECT_GETTER = Symbol();
export const EFFECT_SETTER = Symbol();

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
): [() => T, (newValue: T | ((prev: T) => T)) => void] {
  let value = isFn(initialValue) ? (initialValue as () => T)() : initialValue;
  const subscribers = new Set<() => void>();

  function get() {
    if (activeEffect) {
      subscribers.add(activeEffect);
    }
    return value;
  }

  function set(newValue: T | ((prev: T) => T)) {
    const newVal = isFn(newValue)
      ? (newValue as (prev: T) => T)(value)
      : newValue;
    if (newVal !== value) {
      value = newVal;
      subscribers.forEach(fn => fn());
    }
  }

  get[EFFECT_GETTER] = EFFECT_GETTER;
  get[EFFECT_SETTER] = set;
  set[EFFECT_SETTER] = EFFECT_SETTER;

  return [get, set];
}
