/**
 * @typedef {Object} Context
 * @property {import(".").PositionData} pos
 * @property {MouseEvent | null} event
 * @property {Tool} tool
 */

import { assert_is_not_null } from "@kpla/assert";
import { Tool } from ".";

/**
 * @enum {number}
 * @readonly
 */
export const State = {
  IDLE: 0,
  CONNECTING: 1,
  PANNING: 2,
  SELECTING: 3,
  DRAGGING: 4,
  CREATE_NODE: 5
}

/**
 * @enum {number}
 * @readonly
 */
export const EventName = {
  MOUSE_DOWN: 0,
  MOUSE_UP: 1,
  MOUSE_MOVE: 3
}

/**
 * @typedef Transition
 * @property {State} source
 * @property {State} dest
 * @property {Guard | null} guard
 */

/**
 * @callback Guard
 * @param {Context} context
 * @returns {boolean}
 */

export class StateMachine {
  /** @type {Context} */
  ctx = {
    pos: {
      screen: {x: 0, y: 0},
      mouse: {x: 0,y: 0},
      node: null
    },
    event: null,
    tool: Tool.CURSOR
  };
  /** @type {State} */
  current = State.IDLE;
  /** @type {Map<State, Map<EventName, Array<Transition>>>} */
  transitions = new Map()

  constructor() {
    this._setupTransitions();
  }

  _setupTransitions() {
    this._addTransition(
      State.IDLE, EventName.MOUSE_DOWN, State.CONNECTING,
      (ctx) => ctx.tool == Tool.CONNECTOR && ctx.pos.node !== null
    );
    this._addTransition(
      State.IDLE, EventName.MOUSE_DOWN, State.PANNING,
      (ctx) => ctx.tool == Tool.PAN
    );
    this._addTransition(
      State.IDLE, EventName.MOUSE_DOWN, State.DRAGGING,
      (ctx) => ctx.pos.node !== null && ctx.tool == Tool.CURSOR
    );
    this._addTransition(
      State.IDLE, EventName.MOUSE_DOWN, State.SELECTING,
      (ctx) => ctx.tool == Tool.CURSOR
    );
    this._addTransition(
      State.IDLE, EventName.MOUSE_DOWN, State.CREATE_NODE,
      (ctx) => ctx.pos.node === null && ctx.tool == Tool.ADD_NODE
    );
    this._addTransition(State.CONNECTING, EventName.MOUSE_UP, State.IDLE);
    this._addTransition(State.PANNING, EventName.MOUSE_UP, State.IDLE);
    this._addTransition(State.DRAGGING, EventName.MOUSE_UP, State.IDLE);
    this._addTransition(State.SELECTING, EventName.MOUSE_UP, State.IDLE);
    this._addTransition(State.CREATE_NODE, EventName.MOUSE_UP, State.IDLE);
  }
  /**
   * @param {State} source 
   * @param {EventName} event_name
   * @param {State} dest 
   * @param {Guard | null} guard
   */
  _addTransition(source, event_name, dest, guard = null) {
    if (!this.transitions.has(source)) {
      this.transitions.set(source, new Map());
    }
    const event_transitions = this.transitions.get(source);
    assert_is_not_null(event_transitions);
    if (!event_transitions.has(event_name)) {
      event_transitions.set(event_name, []);
    }

    const evt = event_transitions.get(event_name);
    assert_is_not_null(evt);
    evt.push({source, dest, guard})
  }

  /**
   * @param {EventName} event_name 
   * @param {Context} new_context 
   */
  dispatch(event_name, new_context) {
    this.ctx = new_context;
    const current_transitions = this.transitions.get(this.current);
    if (!current_transitions) {
      console.warn(`No transitions for current state: ${this.current}`, this.ctx);
      return;
    }

    const transitions_for_event = current_transitions.get(event_name);
    if (!transitions_for_event) {
      console.warn(`No transitions for event: ${event_name}`, this.current, this.ctx);
      return;
    }

    let triggered = false;
    for (const t of transitions_for_event) {
      if (this.current === t.source && (!t.guard || t.guard(this.ctx))) {
        this.current = t.dest;
        triggered = true;
        break;
      }
    }

    if (!triggered) {
      const { stack } = new Error();
      console.warn(`No transition triggered for ${event_name}`, stack);
    }
  }

  /**
   * @param {State} state 
   * @returns {boolean}
   */
  is(state) {
    return this.current === state;
  }

  /**
   * @param {State} source 
   * @param {State} dest 
   * @returns {string}
   */
  _createTransitionKey(source, dest) {
    return `${source}-${dest}`
  }
}
