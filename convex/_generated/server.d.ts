/* eslint-disable */
/**
 * Generated server utilities.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { DataModel } from "./dataModel";

/**
 * Define a query in this Convex app's public API.
 */
export declare const query: QueryBuilder<DataModel, "public">;

/**
 * Define a query that is only callable by other Convex functions.
 */
export declare const internalQuery: QueryBuilder<DataModel, "internal">;

/**
 * Define a mutation in this Convex app's public API.
 */
export declare const mutation: MutationBuilder<DataModel, "public">;

/**
 * Define a mutation that is only callable by other Convex functions.
 */
export declare const internalMutation: MutationBuilder<DataModel, "internal">;

/**
 * Define an action in this Convex app's public API.
 */
export declare const action: ActionBuilder<DataModel, "public">;

/**
 * Define an action that is only callable by other Convex functions.
 */
export declare const internalAction: ActionBuilder<DataModel, "internal">;

/**
 * Define an HTTP action.
 */
export declare const httpAction: HttpActionBuilder;

/**
 * The context type for queries in this Convex app.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * The context type for mutations in this Convex app.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * The context type for actions in this Convex app.
 */
export type ActionCtx = GenericActionCtx<DataModel>;
