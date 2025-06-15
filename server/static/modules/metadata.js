/**
 * @module Metadata
 * @description Handles node metadata registration
 */

/**
 * @typedef {Object} ZoneMetadata
 * @property {"zone"} type
 * @property {string} id
 * @property {string} name
 * @property {import("./graph-editor-api").ZoneType} zone_type
 */

/**
 * @typedef {Object} CoworkerMetadata
 * @property {"coworker"} type
 * @property {string} id
 * @property {string} name
 * @property {import("./graph-editor-api").CoworkerAuth} auth
 */

/**
 * @typedef {Object} AccessNodeMetadata
 * @property {"access_node"} type
 * @property {string} id
 * @property {string} name
 * @property {import("./graph-editor-api").AccessLevel} access_level
 */

/**
 * @typedef {Object} GroupMetadata
 * @property {"group"} type
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {CoworkerMetadata | ZoneMetadata | AccessNodeMetadata | GroupMetadata} Metadata
 */

export {};
