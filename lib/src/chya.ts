import { compileDOM } from "./compiler";
import { createEffect, createSignal, buildState } from "./signal";
import { evaluate } from "./utils";

export default class Chya {
  private states: Map<string, any>; // Stores all state objects for the app
  private activeEffect?: VoidFunction; // Holds the currently active effect for reactivity tracking
  private stateSubscribers: Record<string, VoidFunction[]>; // Maps state names to their dependent effects

  constructor() {
    this.states = new Map();
    this.stateSubscribers = {};
  }

  /**
   * Create a reactive signal that tracks its consumers and updates them on value changes.
   * A signal returns its value when called without arguments and updates it when called with an argument.
   *
   * @example
   * const [count, setCount] = Chya.createSignal(0);
   *
   * Chya.createEffect(() => {
   *  console.log(count()); // Logs the current value of count
   * });
   *
   * // Update the signal using a function that receives the previous value
   * setCount(prevCount => prevCount + 1);
   *
   * // Directly update with a new value
   * setCount(1);
   *
   * // Update using the current value
   * setCount(count() + 1);
   */
  createSignal = createSignal;

  /**
   * Create a reactive effect that automatically tracks dependencies.
   * When any tracked signal changes, the effect is re-executed.
   *
   * If a state is accessed within this effect but isn't initialized yet,
   * the effect will automatically re-run once the state becomes available.
   *
   * @param effect - A function containing reactive dependencies.
   *
   * @example
   * const [count, setCount] = Chya.createSignal(0);
   *
   * Chya.createEffect(() => {
   *  console.log(count()); // Re-runs when count changes
   * });
   *
   * setCount(prevCount => prevCount + 1);
   *
   * // Access a remote state
   * Chya.app("exampleState", () => {
   *  const [data, setData] = Chya.createSignal("");
   *  return { data };
   * });
   *
   * Chya.createEffect(() => {
   *  const state = Chya.getState("exampleState");
   *  console.log(state?.data); // Reactively logs even if initialized later
   * });
   */
  createEffect = (effect: VoidFunction) => {
    this.activeEffect = effect; // Register the effect for dependency tracking
    createEffect(effect); // Execute the effect
    this.activeEffect = undefined; // Clear the active effect after execution
  };

  /**
   * Create a computed value based on other signals.
   * Computed values are lazily evaluated and automatically update
   * when their dependencies change.
   *
   * @param ef - Function that returns the computed value.
   * @returns A getter function for the computed value.
   *
   * @example
   * const [count, setCount] = Chya.createSignal(0);
   * const doubleCount = Chya.computed(() => count() * 2);
   *
   * setCount(2);
   * console.log(doubleCount()); // Outputs 4
   */
  computed = <T>(ef: () => T) => {
    const [getter, setter] = createSignal<T | undefined>(undefined);
    createEffect(() => setter(ef())); // Recompute whenever dependencies change
    return getter as () => T;
  };

  /**
   * Initialize the Chya application by scanning the DOM for elements
   * with the `x-app` attribute and rendering them.
   *
   * @example
   * <div x-app="counter" x-state="{count: 0}">{{count}}</div>
   * <script>
   *  Chya.init();
   * </script>
   */
  init() {
    document
      .querySelectorAll<HTMLElement>("[x-app]")
      .forEach(el => this.render(el)); // Render all found app elements
  }

  /**
   * Get a state by name, whether it's initialized or not.
   * If accessed within an effect, the effect is automatically subscribed
   * to state changes for consistent reactivity.
   *
   * @param name - The name of the state.
   * @returns The state object or undefined if not found.
   */
  getState(name: string) {
    const state = this.states.get(name);
    // If state isn't initialized and within an active effect, subscribe the effect
    if (!state && this.activeEffect) {
      this.stateSubscribers[name] = [
        ...(this.stateSubscribers[name] || []),
        this.activeEffect
      ];
    }
    return state;
  }

  /**
   * Manually render a Chya app within a specific DOM element.
   *
   * @param el - The root element of the application.
   * @param stateName - Optional state name to use for this instance.
   *
   * @example
   * <div id="app" x-state="{count: 0}">{{count}}</div>
   * <script>
   *  Chya.render(document.getElementById("app"), "counter");
   * </script>
   */
  render(el: HTMLElement, stateName?: string) {
    if (!stateName) {
      stateName = el.getAttribute("x-app")?.trim();
    }

    // Get or create the state for the current element
    const state = this.states.get(stateName || "") ?? this.createState(el);

    // Register the state if not already present
    if (stateName && !this.states.has(stateName) && state) {
      this.setState(stateName, state);
    }

    // Compile and render the DOM with reactive bindings
    compileDOM(el.childNodes, state);
  }

  /**
   * Create an app state programmatically.
   * Any scalar value is automatically wrapped with a signal for reactivity.
   *
   * @param name - The name of the state.
   * @param setup - A function returning the state object.
   *
   * @example
   * Chya.app("counter", () => {
   *    const [count, setCount] = Chya.createSignal(0);
   *    return { count, isCounting: false };
   * });
   */
  app(name: string, setup: () => Record<string, unknown>) {
    if (this.states.has(name)) {
      console.warn(`State "${name}" is already defined.`);
      return;
    }

    // Build the state object and register it
    this.setState(name, buildState(setup()));
  }

  /**
   * Create state from the DOM element's x-state attribute.
   * Any scalar value will be wrapped with a signal for reactivity.
   *
   * @param el - The DOM element with the x-state attribute.
   * @returns The initialized state object.
   */
  private createState(el: HTMLElement) {
    const stateExpr = el.getAttribute("x-state");
    if (!stateExpr) {
      console.warn("Missing x-state attribute in:", el);
      return {};
    }

    // Evaluate the state expression and build the state object
    return buildState(evaluate(stateExpr) || {});
  }

  /**
   * Register a state by name and notify all subscribers to rerun their effects.
   *
   * @param name - The name of the state.
   * @param state - The state object to register.
   */
  private setState(name: string, state: Record<string, unknown>) {
    this.states.set(name, state); // Save the state object
    // Rerun all effects that depend on this state
    this.stateSubscribers[name]?.forEach(createEffect);
    // Clear the subscribers once effects are re-executed
    delete this.stateSubscribers[name];
  }
}
