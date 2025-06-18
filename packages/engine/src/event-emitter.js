import { assert_is_not_null } from "@kpla/assert";

export class EventEmitter {
  /**
   * @type {Map<string, Array<Function>>}
   */
  listeners = new Map();

  /**
   * @param {string} event_name 
   * @param {Function} callback 
   * @returns {this}
   */
  on(event_name, callback) {
    if (!this.listeners.has(event_name)) {
      this.listeners.set(event_name, []);
    }

    const listeners = this.listeners.get(event_name);
    assert_is_not_null(listeners);
    listeners.push(callback);
    return this;
  }

  /**
   * @param {string} event_name 
   * @param {Function} callback 
   * @returns {this}
   */
  off(event_name, callback) {
    const listeners = this.listeners.get(event_name);
    if (!listeners) {
      return this;
    }

    const new_listeners = listeners.filter(listener => listener != callback);
    this.listeners.set(event_name, new_listeners);

    return this;
  }

  /**
   * @param {string} event_name 
   * @param {...any} args 
   * @returns {boolean} - Returns true if event had listeners
   */
  emit(event_name, ...args) {
    const listeners = this.listeners.get(event_name);
    if (!listeners || listeners.length == 0) {
      return false;
    }

    for (let callback of [...listeners]) {
      callback(...args);
    }

    return true;
  }

  /**
   * @param {string} event_name 
   */
  removeAllListeners(event_name) {
    if (event_name) {
      this.listeners.delete(event_name)
      return;
    }

    this.listeners.clear();
  }
}
