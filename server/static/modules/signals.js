/**
 * @module Signals
 * Exposes a small api for reactive states
 */

/**
 * @callback SignalGetter - Get the signal value
 * @callback SignalSetter - Sets the signal value and calls dependencies 
 * @param {*} value
 * @typedef {[SignalGetter, SignalSetter]} Signal
 */

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
