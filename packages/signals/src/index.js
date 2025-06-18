/**
 * @module Signals
 * Exposes a small api for reactive states
 */

import { assert_is_input, assert_is_not_null, assert_msg } from "@kpla/assert";

/**
 * @callback SignalGetter - Get the signal value
 * @callback SignalSetter - Sets the signal value and calls dependencies 
 * @param {*} value
 * @typedef {[SignalGetter, SignalSetter]} Signal
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
 * @param {*} value 
 * @returns {Signal}
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

/** @enum {string} */
const Attributes = {
  VALUE: "koppla-value",
  TEXT: "koppla-text",
  FOR: "koppla-for"
}

export class DocumentParser {
  /**
 * @type {Map<string, Signal>}
 */
  signals = new Map();
  /** @type {HTMLElement | Document | DocumentFragment} */
  root = document;
  expression_regex = /\{\{(.*)\}\}/g;


  /**
   * Get a signal given its name in the document
   * @param {string} name
   * @returns {Signal}
   */
  get(name) {
    assert_msg(this.signals.has(name), `No input is bound to ${name}`)
    const signal = this.signals.get(name);
    assert_is_not_null(signal)
    return signal;
  }

  /**
   * @private
   * @param {string} name
   * @param {*} initial_value
   * @returns {Signal}
   */
  _getOrCreateSignal(name, initial_value) {
    if (this.signals.has(name)) {
      const signal = this.signals.get(name)
      assert_is_not_null(signal);
      return signal;
    } else {
      const signal = createSignal(initial_value);
      this.signals.set(name, signal);
      return signal;
    }
  }

  parse() {
    /** @type {NodeListOf<HTMLTemplateElement>} */
    const templates = this.root.querySelectorAll(`template[${Attributes.FOR}]`);
    for (const template of templates) {
      const expression = template.getAttribute(Attributes.FOR);
      assert_is_not_null(expression);
      const match = expression.match(/(\S+)\s+in\s+(\S+)/);
      if (!match) continue;
      const [, item_name, array_name] = match;
      const [getArray] = this._getOrCreateSignal(array_name, []);

      const start_anchor = document.createComment(`for: ${array_name} start`);
      const end_anchor = document.createComment(`for: ${array_name} end`);
      const template_content = template.content;

      assert_is_not_null(template.parentNode);
      template.parentNode.insertBefore(start_anchor, template);
      template.parentNode.insertBefore(end_anchor, template);
      template.remove();

      createEffect(() => {
        const items = getArray()
        if (!Array.isArray(items)) return;
        let current_node = start_anchor.nextSibling;
        while (current_node && current_node !== end_anchor) {
          const next_node = current_node.nextSibling;
          current_node.remove();
          current_node = next_node;
        }

        const fragment = document.createDocumentFragment();
        for (const item of items) {
          const clone = template_content.cloneNode(true);
          if (!isElementNode(clone) && !isFragmentNode(clone)) return;
          const context = {[item_name]: item};
          this._populateInstance(clone, context)
          fragment.appendChild(clone);
        }

        assert_is_not_null(end_anchor.parentNode);
        end_anchor.parentNode.insertBefore(fragment, end_anchor);
      });
    }

    const elements = this.root.querySelectorAll(`
[${Attributes.VALUE}],
[${Attributes.TEXT}],
[${Attributes.FOR}]
`)

    for (let el of elements) {
      if (el.hasAttribute(Attributes.VALUE)) {
        assert_is_input(el);
        const signal_name = el.getAttribute(Attributes.VALUE);
        assert_is_not_null(signal_name);
        const [_, setValue] = this._getOrCreateSignal(signal_name, el.value);
        setValue(el.value);

        el.addEventListener("input", (e) => {
          assert_is_not_null(e.target);
          assert_is_input(e.target);
          setValue(e.target.value);
        });
      }
      if (el.hasAttribute(Attributes.TEXT)) {
        const signal_name = el.getAttribute(Attributes.TEXT);
        assert_is_not_null(signal_name);
        const [getText] = this._getOrCreateSignal(signal_name, null);
        createEffect(() => {
          el.textContent = getText();
        });
      }
    }

    this._parseReactiveBindings(this.root);
  }

  /**
   * @param {HTMLElement | DocumentFragment | Document} root_node 
   */
  _parseReactiveBindings(root_node) {
    const walker = document.createTreeWalker(root_node, NodeFilter.SHOW_TEXT);
    const text_nodes = [];
    while (walker.nextNode()) text_nodes.push(walker.currentNode);

    for (const node of text_nodes) {
      const original_text = node.nodeValue;
      assert_is_not_null(original_text)
      if (!original_text.includes("{{")) continue;

      const dependencies = [...original_text.matchAll(this.expression_regex)]
      .map(match => match[1].trim());

      createEffect(() => {
        /** @type {{[key:string]: any}}*/
        const context = {};
        for (const dep of dependencies) {
          const [getValue] = this._getOrCreateSignal(dep, "");
          context[dep] = getValue();
        }
        node.nodeValue = this._resolveExpression(original_text, context);
      });
    }

    const all_elements = isElementNode(root_node)
      ? [root_node, ...root_node.querySelectorAll("*")]
      : [...root_node.querySelectorAll("*")]

    for (const element of all_elements) {
      for (const attr of [...element.attributes]) {
        const original_attr_value = attr.value;
        if (!original_attr_value.includes("{{")) continue;

        const dependencies = [...original_attr_value.matchAll(this.expression_regex)]
        .map(match => match[1].trim());

        createEffect(() => {
        /** @type {{[key:string]: any}}*/
          const context = {};
          for (const dep of dependencies) {
            const [getValue] = this._getOrCreateSignal(dep, "");
            context[dep] = getValue();
          }
          element.setAttribute(attr.name, this._resolveExpression(original_attr_value, context))
        })
      }
    }
  }


  /**
 * @private
 * @param {DocumentFragment| HTMLElement} root_node - The node to populate
 * @param {object} context - The data object for this instance
 */
  _populateInstance(root_node, context) {
    /** @type {Array<Element>} */
    const all_elements = isElementNode(root_node)
      ? [root_node, ...root_node.querySelectorAll("*")]
      : [...root_node.querySelectorAll("*")];

    for (const element of all_elements) {
      for (const attr of [...element.attributes]) {
        if (attr.value.includes("{{")) {
          const new_value = this._resolveExpression(attr.value, context);
          element.setAttribute(attr.name, new_value);
        }
      }
    }

    const walker = document.createTreeWalker(root_node, NodeFilter.SHOW_TEXT);
    let text_node;

    while (text_node = walker.nextNode()) {
      assert_is_not_null(text_node.nodeValue);
      if (text_node.nodeValue.includes("{{")) {
        text_node.nodeValue = this._resolveExpression(text_node.nodeValue, context);
      }
    }
  }
  /**
 * @private
 * @param {string} template - The template string (e.g., "class-{{status}}").
 * @param {object} context - The data object to get values from (e.g., an item from a loop).
 * @returns {string} - The resolved string.
 */
_resolveExpression(template, context) {
    return template.replace(this.expression_regex, (_, expression) => {
      expression = expression.trim();
      const props = expression.split(".");
      /** @type {any} */
      let value = context;

      for (const prop of props) {
        if (value === undefined || value === null) {
          value = undefined;
          break;
        }
        value = value[prop];
      }

      if (value === undefined || value === null) {
        return "";
      }

      if (typeof value === 'object') {
        return "";
      }
      return String(value);
    });
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


