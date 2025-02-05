import { createEffect, createSignal, EFFECT_SETTER } from "./signal";
import { evaluate, extractAttrExpr, isFn, objKeys } from "./utils";

const createComment = () => document.createComment("");

const renderTextNode = (node: Node, state: Record<string, unknown>) => {
  const matches = [...node.textContent!.matchAll(/\{\{(.*?)\}\}/g)];

  if (matches.length) {
    const originalText = node.textContent!;

    createEffect(() => {
      let newContent = originalText;
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
  Array.from(element.attributes).forEach(attr => {
    const expr = attr.value.trim();

    // Process x-bind:*
    if (attr.name.startsWith("x-bind:")) {
      const [attrName] = extractAttrExpr(attr.name, 7);

      createEffect(() => {
        try {
          const evaluatedValue = evaluate(expr, state);
          element.setAttribute(
            attrName,
            String(isFn(evaluatedValue) ? evaluatedValue() : evaluatedValue)
          );
        } catch (e) {
          console.error(`Error evaluating x-bind:${attrName}`, e);
        }
      });
    }

    // Process x-model.*
    else if (attr.name.startsWith("x-model")) {
      const [_, eventName] = extractAttrExpr(attr.name, 7);
      const isCheckBox = (element as HTMLInputElement).type.charAt(0) === "c";

      // Bind the value properly for input fields
      element.addEventListener(eventName || "input", e => {
        const val = isCheckBox
          ? (e.target as HTMLInputElement).checked
          : (e.target as HTMLInputElement).value;

        if (state[expr] && isFn(state[expr][EFFECT_SETTER as keyof unknown])) {
          // @ts-ignore
          state[expr][EFFECT_SETTER](val);
        }
      });

      // create effect
      createEffect(() => {
        const evaluatedValue = evaluate(expr, state);

        if (isCheckBox) {
          (element as HTMLInputElement).checked = !!evaluatedValue;
        } else {
          (element as HTMLInputElement).value = evaluatedValue;
        }
      });
    }

    // Process x-on:*
    else if (attr.name.startsWith("x-on:")) {
      const [event, modifier] = extractAttrExpr(attr.name, 5);

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
      const placeholder = createComment();

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
  const placeholder = createComment();
  parent.insertBefore(placeholder, element);
  element.remove();

  const renderedNodes = new Map<
    number,
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
          const itemState = {
            ...state,
            [itemName]: getter,
            [indexKey]: iGetter
          };
          createEffect(() => {
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
  children: NodeListOf<ChildNode>,
  state: Record<string, unknown>
) => {
  for (const child of Array.from(children)) {
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

export const createReactiveObj = (data: Record<string, any>) => {
  objKeys(data).forEach(key => {
    if (!isFn(data[key])) {
      data[key] = createSignal(data[key])[0];
    }
  });
  return data;
};
