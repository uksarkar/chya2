import { createEffect, createSignal, EFFECT_GETTER } from "./signal";
import { evaluate, isFn } from "./utils";

const renderTextNode = (node: Node, state: Record<string, unknown>) => {
  const matches = [...node.textContent!.matchAll(/\{\{(.*?)\}\}/g)];

  if (matches.length) {
    const originalText = node.textContent;

    createEffect(() => {
      let newContent = originalText!;
      matches.forEach(match => {
        try {
          newContent = newContent.replace(
            match[0],
            evaluate(match[1]?.trim(), state)
          );
        } catch (e) {
          console.error(`Error evaluating expression: ${match[1]}`, e);
        }
      });
      node.textContent = newContent;
    });
  }
};

const bindAttrs = (element: HTMLElement, state: Record<string, unknown>) => {
  const isCheckBox = element.getAttribute("type") === "checkbox";

  Array.from(element.attributes).forEach(attr => {
    // Process x-bind:*
    if (attr.name.startsWith("x-bind:")) {
      const [_, binding] = attr.name.split(":");
      const [attrName, modifier] = binding?.split(".") || [];
      const expr = attr.value.trim();

      if (attrName === "value") {
        // Bind the value properly for input fields
        element.addEventListener(modifier || "input", e => {
          state[expr] = isCheckBox
            ? (e.target as HTMLInputElement).checked
            : (e.target as HTMLInputElement).value;
        });
      }

      createEffect(() => {
        try {
          const evaluatedValue = evaluate(expr, state);
          if (attrName === "value") {
            if (isCheckBox) {
              (element as HTMLInputElement).checked = !!evaluatedValue;
            } else {
              (element as HTMLInputElement).value = evaluatedValue;
            }
          } else {
            element.setAttribute(attrName, String(evaluatedValue));
          }
        } catch (e) {
          console.error(`Error evaluating x-bind:${attrName}`, e);
        }
      });
    }

    // Process x-on:*
    else if (attr.name.startsWith("x-on:")) {
      const [_, eventName] = attr.name.split(":");
      const [event, modifier] = eventName?.split(".") || [];
      const expr = attr.value.trim();

      element.addEventListener(event, event => {
        try {
          // Handle event modifiers (stop propagation, prevent default)
          if (modifier === "stop") event.stopPropagation();
          if (modifier === "prevent") event.preventDefault();

          const fn = evaluate(expr, state);
          if (isFn(fn)) {
            fn(event, state);
          }
        } catch (e) {
          console.error(`Error evaluating x-on:${event}`, e);
        }
      });
    }

    // Process x-if:*
    else if (attr.name === "x-if") {
      const expr = element.getAttribute("x-if")!.trim();
      const placeholder = document.createComment("");

      createEffect(() => {
        try {
          const condition = !!evaluate(expr, state);

          if (!condition) {
            if (element.isConnected) {
              element.replaceWith(placeholder);
            }
          } else {
            if (!element.isConnected && placeholder.isConnected) {
              placeholder.replaceWith(element);

              // Rebind events
              compileDOM(element.childNodes, state);
            }
          }
        } catch (e) {
          console.error(`Error evaluating x-if: ${expr}`, e);
        }
      });
    }
  });
};

const renderFor = (element: HTMLElement, state: Record<string, unknown>) => {
  const expr = element.getAttribute("x-for")!.trim();
  const [itemExpr, arrayExpr] = expr.split(" in ").map(s => s.trim());
  const [itemName, indexKey] = itemExpr.split(",").map(item => item.trim());

  if (!itemName || !arrayExpr) {
    console.error(`Invalid x-for expression: "${expr}"`);
    return;
  }

  const parent = element.parentElement!;
  const placeholder = document.createComment("");
  parent.insertBefore(placeholder, element);
  element.remove(); // Remove template, but keep reference

  const renderedNodes = new Map<
    any,
    {
      setter: ReturnType<typeof createSignal>[1];
      node: HTMLElement;
      indexSetter: ReturnType<typeof createSignal<number>>[1];
    }
  >();

  createEffect(() => {
    try {
      const items = evaluate(arrayExpr, state);
      if (!Array.isArray(items)) {
        console.error(`x-for expects an array, got:`, items);
        return;
      }

      // remove non recognized items
      if (renderedNodes.size > items.length) {
        for (let index = items.length; index < renderedNodes.size; index++) {
          const obj = renderedNodes.get(index);
          if (obj) {
            obj.node?.remove();
            renderedNodes.delete(index);
          }
        }
      }

      // Render new items
      items.forEach((item, index) => {
        const obj = renderedNodes.get(index);
        if (obj) {
          obj.setter(item);
          obj.indexSetter(index);
        } else {
          const [getter, setter] = createSignal(item);
          const [iGetter, indexSetter] = createSignal(index);
          const clone = element.cloneNode(true) as HTMLElement;
          clone.removeAttribute("x-for");
          parent.insertBefore(clone, placeholder);
          bindAttrs(clone, state);

          renderedNodes.set(index, {
            node: clone,
            setter,
            indexSetter
          });

          // Create a new reactive scope for each item
          createEffect(() => {
            const itemState = new Proxy(
              { state, [itemName]: null, [indexKey]: index },
              {
                get(target, p, receiver) {
                  if (p === itemName) {
                    return getter();
                  }

                  if (p === indexKey) {
                    return iGetter();
                  }

                  return Reflect.get(target, p, receiver);
                }
              }
            );
            compileDOM(clone.childNodes, itemState);
          });
        }
      });
    } catch (e) {
      console.error(`Error evaluating x-for: ${expr}`, e);
    }
  });
};

export const compileDOM = (
  children: NodeListOf<ChildNode> | HTMLCollection,
  state: Record<string, unknown>
) => {
  for (const child of children) {
    // Handle Element Nodes
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement;

      // Process x-for
      if (element.hasAttribute("x-for")) {
        renderFor(element, state);
        return;
      }

      // bind attrs
      bindAttrs(element, state);

      // Recursively process child nodes
      if (element.hasChildNodes()) {
        compileDOM(element.childNodes, state);
      }
    }

    // Handle Text Nodes ({{ expression }})
    if (
      child.nodeType === Node.TEXT_NODE &&
      child.textContent?.includes("{{")
    ) {
      renderTextNode(child, state);
    }
  }
};

export const buildStateFromExpr = (expr: string | null) => {
  const data = evaluate(expr, {}) || {};
  return Object.keys(data).reduce(
    (obj, key) => {
      const signal = createSignal(data[key]);
      obj.getters[key] = signal[0];
      obj.setters[key] = signal[1];

      return obj;
    },
    {
      getters: {} as Record<string, ReturnType<typeof createSignal>[0]>,
      setters: {} as Record<string, ReturnType<typeof createSignal>[1]>
    }
  );
};

export const proxyGetter = (target: any, p: any, receiver: any) => {
  const val = Reflect.get(target, p, receiver);
  if (val && val[EFFECT_GETTER]) {
    return val();
  }
  return val;
};

export const proxyState = (
  getters: Record<string, ReturnType<typeof createSignal>[0]>,
  setters: Record<string, ReturnType<typeof createSignal>[1]>
) => {
  return new Proxy(getters, {
    get: proxyGetter,
    set(_, p, newValue) {
      if (isFn(setters[p as keyof unknown])) {
        setters[p as keyof unknown](newValue);
        return true;
      }
      return false;
    }
  });
};
