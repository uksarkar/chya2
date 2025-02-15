import { compileDOM } from "./compiler";
import { createEffect, createSignal, buildState } from "./signal";
import { evaluate } from "./utils";

export default class Chya {
  private states: Map<string, any>;
  private activeEffect?: VoidFunction;
  private stateSubscribers: Record<string, VoidFunction[]>;

  constructor() {
    this.states = new Map();
    this.stateSubscribers = {};
  }

  createSignal = createSignal;
  createEffect = (effect: VoidFunction) => {
    this.activeEffect = effect;
    createEffect(effect);
    this.activeEffect = undefined;
  };
  computed = <T>(ef: () => T) => {
    const [getter, setter] = createSignal<T | undefined>(undefined);
    createEffect(() => setter(ef));
    return getter as () => T;
  };

  init() {
    document
      .querySelectorAll<HTMLElement>("[x-app]")
      .forEach(el => this.render(el));
  }

  getState(name: string) {
    const state = this.states.get(name);
    if (!state && this.activeEffect) {
      this.stateSubscribers[name] = [
        ...(this.stateSubscribers[name] || []),
        this.activeEffect
      ];
    }
    return state;
  }

  render(el: HTMLElement) {
    const stateName = el.getAttribute("x-app")!.trim();
    const state = this.states.get(stateName) ?? this.createState(el);

    if (!this.states.has(stateName) && state) {
      this.setState(stateName, state);
    }

    compileDOM(el.childNodes, state);
  }

  app(name: string, setup: () => Record<string, unknown>) {
    if (this.states.has(name)) {
      console.warn(`State "${name}" is already defined.`);
      return;
    }

    this.setState(name, buildState(setup()));
  }

  private createState(el: HTMLElement) {
    const stateExpr = el.getAttribute("x-state");
    if (!stateExpr) {
      console.warn("Missing x-state attribute in:", el);
      return {};
    }
    return buildState(evaluate(stateExpr) || {});
  }

  private setState(name: string, state: Record<string, unknown>) {
    this.states.set(name, state);
    this.stateSubscribers[name]?.forEach(createEffect);
    delete this.stateSubscribers[name];
  }
}
