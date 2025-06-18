  /**
 * @param {boolean} expression Expression to assert
 * @param {string} msg Written out with error if assertion fails
 *
 * @returns {asserts value is true}
 */
export function assert_msg(expression, msg) {
  if (!expression) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`)
  }
}

/**
 * @param {Element | EventTarget} el 
 * @returns {asserts el is HTMLInputElement}
 */
export function assert_is_input(el) {
  if (!("value" in el)) {
    throw new Error("[ASSERTION FAILED]: Element is not of type input")
  }
}

/**
 * @param {unknown} value 
 * @returns {asserts value is string}
 */
export function assert_is_string(value) {
  if (typeof value != "string") {
    throw new Error(`[ASSERTION FAILED]: Value was not a string :: ${value}`)
  }
}

/**
 * @param {unknown} value 
 * @returns {asserts value is number}
 */
export function assert_is_number(value) {
  if (typeof value != "number") {
    throw new Error(`[ASSERTION FAILED]: Value was not a number :: ${value}`)
  }
}

/**
 * @param {HTMLElement | EventTarget} el 
 * @returns {asserts el is HTMLFormElement}
 */
export function assert_is_form(el) {
  if (!("submit" in el)) {
    throw new Error(`[ASSERTION FAILED]: Element was not a form :: ${el}`)
  }
}

/**
 * @param {HTMLElement | EventTarget} el 
 * @returns {asserts el is HTMLDialogElement}
 */
export function assert_is_dialog(el) {
  if (!("showModal" in el)) {
    throw new Error(`[ASSERTION FAILED]: Element was not a dialog :: ${el}`)
  }
}

/**
 * @param {HTMLElement} el 
 * @returns {asserts el is HTMLCanvasElement}
 */
export function assert_is_canvas(el) {
  if (!("getContext" in el)) {
    throw new Error("Element is not a canvas")
  }
}

/**
 * @param {Node} el 
 * @returns {asserts el is Attr}
 */
export function assert_is_attr(el) {
  if (!("name" in el) && !("value" in el)) {
    throw new Error("Node is not an attribute")
  }
}

/**
 * @param {unknown} value 
 */
export function assert_is_not_null(value) {
  if (value == undefined || value == null) {
    throw new Error(`[ASSERTION FAILED]: Value was nullish`)
  }
}

/**
 * @param {boolean} expression 
 */
export function assert(expression) {
  if (!expression) {
    throw new Error(`[ASSERTION FAILED]: Expression was false`)
  }
}


