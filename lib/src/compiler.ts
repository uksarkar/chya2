import { buildState, createEffect, createSignal, RAW_STATE } from "./signal";
import { evaluate, extractAttrExpr, isFn } from "./utils";

const ATTR_X_FOR = "for";
const ATTR_X_IF = "if";
const ATTR_X_MODEL = "model";
const ATTR_X_TEMPLATE = "template";
const ATTR_X_HTML = "html";

const createComment = () => document.createComment("");
const removeAttr = (el: HTMLElement, name: string) => el.removeAttribute(name);
const getAttr = (el: HTMLElement, name: string) => el.getAttribute(name);
const makeAttrName = (name: string) => `x-${name}`;

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
          let evaluatedValue = evaluate(expr, state);
          if (isFn(evaluatedValue)) {
            evaluatedValue = evaluatedValue();
          }

          if (attrName in element) {
            // Direct property assignment (better for inputs, checkboxes, etc.)
            // @ts-ignore
            element[attrName] = evaluatedValue;
          } else {
            // Handle boolean attributes properly
            if (typeof evaluatedValue === "boolean") {
              if (evaluatedValue) {
                element.setAttribute(attrName, "");
              } else {
                element.removeAttribute(attrName);
              }
            } else {
              // Default case: use setAttribute
              element.setAttribute(attrName, String(evaluatedValue));
            }
          }
          removeAttr(element, attr.name);
        } catch (e) {
          console.error(`Error evaluating x-bind:${attrName}:`, e);
        }
      });
    }

    // Process x-model.*
    else if (attr.name === makeAttrName(ATTR_X_MODEL)) {
      const [_, eventName] = extractAttrExpr(attr.name, 7);
      const isCheckBox = (element as HTMLInputElement).type.charAt(0) === "c";

      // Bind the value properly for input fields
      element.addEventListener(eventName || "input", e => {
        const val = isCheckBox
          ? (e.target as HTMLInputElement).checked
          : (e.target as HTMLInputElement).value;
        state[expr] = val;
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
      removeAttr(element, attr.name);
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
      removeAttr(element, attr.name);
    }
  });
};

const renderFor = (element: HTMLElement, state: Record<string, unknown>) => {
  const expr = getAttr(element, makeAttrName(ATTR_X_FOR))!.trim();
  const [itemExpr, arrayExpr] = expr.split(" in ").map(s => s.trim());
  const [itemName, indexKey] = itemExpr.split(",").map(item => item.trim());

  if (!itemName || !arrayExpr) {
    console.error(`Invalid x-for expression: "${expr}"`);
    return;
  }

  removeAttr(element, makeAttrName(ATTR_X_FOR));

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
          parent.insertBefore(clone, placeholder);

          renderedNodes.set(index, {
            node: clone,
            setter,
            indexSetter
          });

          // Create a new reactive scope for each item
          const itemState = buildState({
            ...(state[RAW_STATE as keyof unknown] as () => object)(),
            [itemName]: getter,
            [indexKey]: iGetter
          });
          bindAttrs(clone, itemState);
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

      // Process x-if
      if (element.hasAttribute(makeAttrName(ATTR_X_IF))) {
        const expr = getAttr(element, makeAttrName(ATTR_X_IF))!.trim();
        const placeholder = createComment();
        removeAttr(element, makeAttrName(ATTR_X_IF));

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
                bindAttrs(element, state);
              }
            }
          } catch (e) {
            console.error(`Error evaluating x-if: ${expr}`, e);
          }
        });
        return;
      }

      // Process x-for
      if (element.hasAttribute(makeAttrName(ATTR_X_FOR))) {
        renderFor(element, state);
        return;
      }

      // bind attrs
      bindAttrs(element, state);

      // Process x-html:*
      if (element.hasAttribute(makeAttrName(ATTR_X_HTML))) {
        createEffect(() => {
          element.innerHTML = evaluate(
            getAttr(element, makeAttrName(ATTR_X_HTML)),
            state
          );
        });
        removeAttr(element, makeAttrName(ATTR_X_HTML));
        return;
      }

      // Process x-template:*
      if (element.hasAttribute(makeAttrName(ATTR_X_TEMPLATE))) {
        createEffect(() => {
          element.innerHTML = evaluate(
            getAttr(element, makeAttrName(ATTR_X_TEMPLATE)),
            state
          );
          compileDOM(element.childNodes, state);
        });
        removeAttr(element, makeAttrName(ATTR_X_TEMPLATE));
        return;
      }

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
