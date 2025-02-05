import { createReactiveObj, compileDOM } from "./compiler";
import { createEffect, createSignal } from "./signal";
import { evaluate, guardProperty } from "./utils";

export default class Chya {
  private states: Map<string, any>;

  constructor() {
    this.states = new Map();
  }

  createSignal = createSignal;
  createEffect = createEffect;

  init() {
    document
      .querySelectorAll<HTMLElement>("[x-app]")
      .forEach(el => this.render(el));
  }

  getState(name: string) {
    const state = this.states.get(name);
    return state ? guardProperty(state) : null;
  }

  render(el: HTMLElement) {
    const stateName = el.getAttribute("x-app")!.trim();
    const state = this.states.get(stateName) ?? this.createState(el);

    if (!this.states.has(stateName) && state) {
      this.states.set(stateName, state);
    }

    compileDOM(el.childNodes, state);
  }

  setup(name: string, setup: () => object) {
    if (this.states.has(name)) {
      console.warn(`State "${name}" is already defined.`);
      return;
    }

    this.states.set(name, createReactiveObj(setup()));
  }

  private createState(el: HTMLElement) {
    const stateExpr = el.getAttribute("x-state");
    if (!stateExpr) {
      console.warn("Missing x-state attribute in:", el);
      return {};
    }
    return createReactiveObj(evaluate(stateExpr) || {});
  }
}
