import {
  buildStateFromExpr,
  compileDOM,
  proxyGetter,
  proxyState
} from "./compiler";
import { createEffect, createSignal, EFFECT_SETTER } from "./signal";

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
    return this.states.get(name);
  }

  setState(name: string, obj: Record<string, unknown>) {
    const state = this.states.get(name);
    if (state) {
      Object.keys(obj).forEach(key => {
        if (state[key] && state[key][EFFECT_SETTER]) {
          state[key](obj[key]);
        } else {
          state[key] = obj[key];
        }
      });
    }
  }

  render(el: HTMLElement) {
    const stateName = el.getAttribute("x-app")?.trim();

    const state = this.states.get(stateName!) ?? this.createState(el);

    if (!this.states.has(stateName!)) {
      this.states.set(stateName!, state);
    }

    compileDOM(el.childNodes, state);
  }

  private createState(el: HTMLElement) {
    const stateExpr = el.getAttribute("x-state");
    if (!stateExpr) {
      console.warn("Missing x-state attribute in:", el);
      return {};
    }

    const { getters, setters } = buildStateFromExpr(stateExpr);
    const state = proxyState(getters, setters);

    return state;
  }

  setup(name: string, setup: () => object) {
    if (this.states.has(name)) {
      console.warn(`State "${name}" is already defined.`);
      return;
    }

    this.states.set(name, new Proxy(setup(), { get: proxyGetter }));
  }
}
