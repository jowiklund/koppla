/**
 * @module Signals
 * Exposes a small api for reactive states
 */

import { assert_is_not_null } from "@kpla/assert";

/**
 * @template T
 * @callback SignalGetter
 * @returns {T}
 */

/**
 * @template T
 * @callback SignalSetter
 * @param {T} value
 */

/**
 * @template T
 * @typedef {[SignalGetter<T>, SignalSetter<T>]} Signal
 */

/** @type {Function | null} */
let active_effect = null;

class Dependency {
  subscribers = new Set();

  depend() {
    if (active_effect) {
      this.subscribers.add(active_effect);
    }
  }

  notify() {
    for (let effect of this.subscribers) {
      effect();
    }
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {Signal<T>}
 */
export function createSignal(value) {
  const dep = new Dependency();

  const get = () => {
    dep.depend();
    return value;
  };

  /**
   * @param {*} new_value
   */
  const set = (new_value) => {
    if (new_value != value) {
      value = new_value;
      dep.notify();
    }
  };

  return [get, set]
}

/**
 * Creates a reactive new read-only signal that computes its values based on other signals.
 *
 * @template T
 * @param {() => T} getter_fn
 * @returns {SignalGetter<T>}
 */
export function computed(getter_fn) {
  const initial_value = getter_fn();
  const [computed_val, set_computed_val] = createSignal(initial_value);

  createEffect(() => {
    const new_val = getter_fn()
    set_computed_val(new_val);
  })

  return /** @type {SignalGetter<T>} */ (computed_val);
}

/**
 * @param {Function} fn
 */
export function createEffect(fn) {
  const effect = () => {
    active_effect = effect;
    fn();
    active_effect = null;
  }

  effect();
}

/**
 * @enum {string}
 */
const Attr = {
  VALUE: "koppla-value",
  FOR: "koppla-for",
  REF: "koppla-ref",
}

export class DocumentParser {
  /** @type {HTMLElement | Document | DocumentFragment} */
  root = document;
  /** @type {object} */
  providers;
  expression_regex = /\{\{(.*)\}\}/g;

  /**
   * @param {HTMLElement | Document} [root_element]
   * @param {object} [providers]
   */
  constructor(root_element = document, providers = {}) {
    this.root = root_element;
    this.providers = providers;
  }

  parse() {
    const components = this.root.querySelectorAll(`script[type="module/koppla"]`)
    for (const script of components) {
      if (script.parentElement) {
        this._parseComponent(script.parentElement);
      }
    }
  }

  /**
   * @param {HTMLElement} component_root 
   */
  _parseComponent(component_root) {
    const template = component_root.querySelector("template");
    const script = component_root.querySelector(`script[type="module/koppla"]`);
    assert_is_not_null(template);
    assert_is_not_null(script);

    const script_content = script.textContent || "";

    try {
      const modified_script = `return (function() { ${script_content} })();`;

      const provider_names = Object.keys(this.providers);
      const provider_values = Object.values(this.providers);

      const component_fn = new Function(
        "signal",
        "computed",
        "effect",
        "root",
        ...provider_names,
        modified_script
      );

      const reactive_scope = component_fn(
        createSignal,
        computed,
        createEffect,
        component_root,
        ...provider_values
      );

      this._bindTemplate(template, reactive_scope);

    } catch(e) {
      console.error("Error parsing component", e, component_root);
    }
  }

  /**
   * @param {HTMLTemplateElement} template 
   * @param {object} scope 
   */
  _bindTemplate(template, scope) {
    const content = template.content.cloneNode(true);

    if (!isFragmentNode(content)) {
      return;
    }

    this._bindForLoops(content, scope);

    this._bindTextAndAttributes(content, scope);
    this._bindEventListeners(content, scope);

    assert_is_not_null(template.parentNode);
    template.parentNode.replaceChild(content, template);
  }

  /**
   * Finds and activates `for` loop directives within a node.
   * @private
   * @param {DocumentFragment | HTMLElement} root_node
   * @param {{[key: string]: any}} parent_scope
   */
  _bindForLoops(root_node, parent_scope) {
    const loop_templates = root_node.querySelectorAll(`template[${Attr.FOR}]`);
    for (const template of loop_templates) {
      if (!(template instanceof HTMLTemplateElement)) continue;
      const expression = template.getAttribute(Attr.FOR);
      assert_is_not_null(expression);
      const match = expression.match(/(\S+)\s+in\s+(\S+)/);
      if (!match) continue;

      const [_, item_name, array_name] = match;

      const array_signal_getter = parent_scope[array_name.replace(/\(\)/g, '')];
      if (typeof array_signal_getter !== "function") continue;

      const start_anchor = document.createComment(`${Attr.FOR}: ${expression} start`)
      const end_anchor = document.createComment(`${Attr.FOR}: ${expression} end`)
      const loop_content = template.content;

      assert_is_not_null(template.parentNode);
      template.parentNode.insertBefore(start_anchor, template);
      template.parentNode.insertBefore(end_anchor, template);
      template.remove();

      createEffect(() => {
        const items = array_signal_getter();
        if (!Array.isArray(items)) return;
        let node = start_anchor.nextSibling;
        while (node && node !== end_anchor) {
          const next_node = node.nextSibling;
          node.remove();
          node = next_node;
        }

        const fragment = document.createDocumentFragment();
        for (const item of items) {
          const clone = loop_content.cloneNode(true);
          if (!(clone instanceof DocumentFragment)) continue;
          const item_scope = {...parent_scope, [item_name]: item};

          this._bindForLoops(clone, item_scope);
          this._bindTextAndAttributes(clone, item_scope);
          this._bindEventListeners(clone, item_scope);

          fragment.appendChild(clone);
        }
        assert_is_not_null(end_anchor.parentNode);
        end_anchor.parentNode.insertBefore(fragment, end_anchor);
      })
    }
  }

  /**
   * @private
   * @param {DocumentFragment | HTMLElement} root_node
   * @param {{[key: string]: any}} scope
   */
  _bindTextAndAttributes(root_node, scope) {
    const elements = root_node.querySelectorAll("*");

    for (const element of elements) {
      if (element.hasAttribute(Attr.VALUE)) {
        const signal_name = element.getAttribute(Attr.VALUE);
        assert_is_not_null(signal_name)

        if (isSignal(scope[signal_name])) {
          const [getter] = scope[signal_name] || [];
          if (getter && (
            element instanceof HTMLInputElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement
          )) {
            createEffect(() => {
              if (element.type === 'checkbox' && "checked" in element) {
                element.checked = getter();
              } else {
                element.value = getter();
              }
            });
          }
        }
      }

      if (element.hasAttribute("koppla-ref")) {
        const ref_name = element.getAttribute(Attr.REF);
        assert_is_not_null(ref_name);

        if (isSignal(scope[ref_name])) {
          scope[ref_name][1](element)
        } else {
          scope[ref_name] = createSignal(element)
        }
        element.removeAttribute(Attr.REF)
      }

      for (const attr of [...element.attributes]) {
        if (attr.name.startsWith("koppla-")) continue;

        if (attr.value.includes("{{")) {
          const original_attr_value = attr.value;
          createEffect(() => {
            const new_value = this._resolveExpressions(original_attr_value, scope);
            if (
              ["true", "false"].includes(new_value) &&
                ["selected", "disabled", "checked"].includes(attr.name)
            ) {
              if (new_value === "true") element.setAttribute(attr.name, "");
                else element.removeAttribute(attr.name);
            } else {
              element.setAttribute(attr.name, new_value);
            }
          })
        }
      }
    }

    const walker = document.createTreeWalker(root_node, NodeFilter.SHOW_TEXT);
    /** @type {Node | null} */
    let text_node;
    const nodes_to_process = [];
    while (text_node = walker.nextNode()) {
      if (text_node.nodeValue && text_node.nodeValue.includes("{{")) {
        nodes_to_process.push(text_node)
      }
    }

    for (const original_node of nodes_to_process) {
      if (!original_node.nodeValue) continue;
      const original_content = original_node.nodeValue;
      const parent_node = original_node.parentNode;

      if (!parent_node) {
        console.warn(`Skipping detached node: ${original_content}`)
        continue;
      }

      const start_anchor = document.createComment(`koppla-exp-start: ${original_content.trim()}`)
      const end_anchor = document.createComment(`koppla-exp-end: ${original_content.trim()}`)

      parent_node.insertBefore(start_anchor, original_node);
      parent_node.insertBefore(end_anchor, original_node.nextSibling);
      if (isElementNode(original_node)) {
        original_node.remove()
      }

      createEffect(() => {
        let node_to_remove = start_anchor.nextSibling;
        while(node_to_remove && node_to_remove !== end_anchor) {
          const next = node_to_remove.nextSibling;
          node_to_remove.remove()
          node_to_remove = next;
        }

        const new_resolved_text = this._resolveExpressions(original_content, scope);

        const new_text_node = document.createTextNode(new_resolved_text);

        if (end_anchor.parentNode) {
          end_anchor.parentNode.insertBefore(new_text_node, end_anchor);
        }
      })
    }

  }

  /**
   * @private
   * @param {DocumentFragment | HTMLElement} root_node
   * @param {{[key:string]: any}} scope 
   */
  _bindEventListeners(root_node, scope) {
    const events = ["click", "change", "submit", "close"];

    for (const event_name of events) {
      const attr_name = `koppla-${event_name}`;
      const elements_with_listeners = root_node.querySelectorAll(`[${attr_name}]`);
      for (const element of elements_with_listeners) {
        const handler_name = element.getAttribute(attr_name);
        if (handler_name && typeof scope[handler_name] === "function") {
          element.addEventListener(event_name, (event) => scope[handler_name](event));
        }
      }
    }

    const value_bound_elements = root_node.querySelectorAll('[koppla-value]');
    for (const element of value_bound_elements) {
      const signal_name = element.getAttribute("koppla-value");
      assert_is_not_null(signal_name);
      const [, setter] = scope[signal_name] || [];
      if (setter && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
        const eventName = (element.type === 'checkbox' || element.tagName === 'SELECT') ? 'change' : 'input';
        element.addEventListener(eventName, (event) => {
          const target = /** @type {HTMLInputElement} */ (event.target);
          const value = target.type === 'checkbox' ? target.checked : target.value;
          setter(value);
        });
      }
    }
  }

  /**
   * @private
   * @param {string} template 
   * @param {{[key: string]: any}} scope 
   */
  _resolveExpressions(template, scope) {
    return template.replace(this.expression_regex, (_, expression) => {
      expression = expression.trim();

      const scope_keys = Object.keys(scope);
      const scope_values = Object.values(scope);

      try {
        const evaluator = new Function(...scope_keys, `return ${expression}`);
        let result = evaluator(...scope_values);

        if (isSignal(result)) {
          result = result[0]();
        }

        if (result === undefined || result === null) {
          return "";
        }

        if (typeof result === 'object') {
          return "";
        }

        return String(result);
      } catch (e) {
        console.warn(`Error evaluating expression: "${expression}"`, e);
        return "";
      }
    })
  }
}

/**
 * @param {unknown} el 
 * @returns {el is HTMLElement}
 */
export function isElementNode(el) {
  if (!el) return false;
  if (typeof el == "object" && "nodeType" in el && el.nodeType === Node.ELEMENT_NODE) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} el 
 * @returns {el is DocumentFragment}
 */
export function isFragmentNode(el) {
  if (!el) return false;
  if (typeof el == "object" && "nodeType" in el && el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return true;
  }
  return false;
}

/**
 * @typedef {Object} TextNode
 * @property {string} nodeValue
 */
/**
 * @param {unknown} el 
 * @returns {boolean}
 */
export function isTextNode(el) {
  if (!el) return false;
  if (typeof el == "object" && "nodeType" in el && el.nodeType === Node.TEXT_NODE) {
    return true;
  }
  return false;
}

/**
 * @template T
 * @param { unknown } val
 * @returns {val is Signal<T>}
 */
function isSignal(val) {
  return Array.isArray(val) && typeof val[0] === "function" && typeof val[1] === "function";
}
