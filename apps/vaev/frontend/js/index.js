import "./datastar/datastar.js";
import "../css/style.css";
import w_url from '@kpla/engine/public/main.wasm?url';

export const wasm_url = w_url;
export { CanvasGUIDriver } from "@kpla/canvas-driver";

/**
 * Creates a throttled function that only invokes the provided function `func`
 * at most once per every `delay` milliseconds.
 *
 * The throttled function comes with a `cancel` method to cancel delayed
 * `func` invocations and a `flush` method to immediately invoke them.
 *
 * @param {Function} func The function to throttle.
 * @param {number} delay The number of milliseconds to throttle invocations to.
 * @returns {Function} Returns the new throttled function.
 */
export function throttle(func, delay) {
  /** @type {ReturnType<typeof setTimeout> | null} Stores the timer ID from setTimeout. */
  let timeout_id = null;
  /** @type {any[] | null} Stores the arguments of the last call. */
  let last_args = null;
  /** @type {any} Stores the `this` context of the last call. */
  let last_this = null;
  /** @type {any} Stores the result of the last `func` invocation. */
  let result;
  /** @type {number} Timestamp of the last time `func` was invoked. */
  let last_call_time = 0;

  /**
   * The core throttled function that manages the invocation of the original function.
   * It's called every time the event fires.
   * @param {...any} args The arguments to pass to the original function.
   * @returns {any} Returns the result of the last successful invocation of `func`.
   */
  function throttled(...args) {
    const now = Date.now();
    const remaining = delay - (now - last_call_time);
    last_args = args;
    last_this = this;

    // If the time window has passed, execute the function immediately.
    if (remaining <= 0 || remaining > delay) {
      if (timeout_id) {
        clearTimeout(timeout_id);
        timeout_id = null;
      }
      last_call_time = now;
      result = func.apply(last_this, last_args);
      // Clear args and this if there's no pending timeout.
      if (!timeout_id) {
        last_args = last_this = null;
      }
    } else if (!timeout_id) {
      // If we're still within the time window, set a timeout to execute after the remaining time.
      // This is the "trailing" edge invocation.
      timeout_id = setTimeout(() => {
        last_call_time = Date.now();
        timeout_id = null;
        result = func.apply(last_this, last_args);
        if (!timeout_id) {
          last_args = last_this = null;
        }
      }, remaining);
    }
    return result;
  }

  /**
   * Cancels the pending delayed invocation of the throttled function.
   * Any trailing edge call that has been scheduled will be cancelled.
   */
  throttled.cancel = function() {
    assert_is_not_null(timeout_id);
    clearTimeout(timeout_id);
    last_call_time = 0;
    timeout_id = last_args = last_this = null;
  };

  /**
   * Immediately invokes the throttled function if there's a pending execution.
   * This is useful for flushing a final call, for example, on an unmount event.
   * @returns {any} The result of the flushed function invocation.
   */
  throttled.flush = function() {
    if (!timeout_id) {
      return result;
    }
    
    // Effectively a trailing edge invocation, but executed immediately.
    last_call_time = Date.now();
    clearTimeout(timeout_id);
    timeout_id = null;

    result = func.apply(last_this, last_args);
    if (!timeout_id) {
        last_args = last_this = null;
    }
    return result;
  };

  return throttled;
}
