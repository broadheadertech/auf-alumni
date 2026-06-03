/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academy from "../academy.js";
import type * as actions_email from "../actions/email.js";
import type * as actions_sendConnectionEmail from "../actions/sendConnectionEmail.js";
import type * as actions_sendVerificationEmail from "../actions/sendVerificationEmail.js";
import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as authReset from "../authReset.js";
import type * as authResetHelpers from "../authResetHelpers.js";
import type * as billing from "../billing.js";
import type * as companies from "../companies.js";
import type * as compliance from "../compliance.js";
import type * as connections from "../connections.js";
import type * as crons from "../crons.js";
import type * as directory from "../directory.js";
import type * as employerOrgs from "../employerOrgs.js";
import type * as events from "../events.js";
import type * as feed from "../feed.js";
import type * as helpers_audit from "../helpers/audit.js";
import type * as helpers_privacy from "../helpers/privacy.js";
import type * as helpers_rbac from "../helpers/rbac.js";
import type * as helpers_registry from "../helpers/registry.js";
import type * as helpers_registryStub from "../helpers/registryStub.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as mentorship from "../mentorship.js";
import type * as messaging from "../messaging.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as seedAccounts from "../seedAccounts.js";
import type * as seedAccountsHelpers from "../seedAccountsHelpers.js";
import type * as social from "../social.js";
import type * as users from "../users.js";
import type * as verification from "../verification.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academy: typeof academy;
  "actions/email": typeof actions_email;
  "actions/sendConnectionEmail": typeof actions_sendConnectionEmail;
  "actions/sendVerificationEmail": typeof actions_sendVerificationEmail;
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  authReset: typeof authReset;
  authResetHelpers: typeof authResetHelpers;
  billing: typeof billing;
  companies: typeof companies;
  compliance: typeof compliance;
  connections: typeof connections;
  crons: typeof crons;
  directory: typeof directory;
  employerOrgs: typeof employerOrgs;
  events: typeof events;
  feed: typeof feed;
  "helpers/audit": typeof helpers_audit;
  "helpers/privacy": typeof helpers_privacy;
  "helpers/rbac": typeof helpers_rbac;
  "helpers/registry": typeof helpers_registry;
  "helpers/registryStub": typeof helpers_registryStub;
  http: typeof http;
  jobs: typeof jobs;
  mentorship: typeof mentorship;
  messaging: typeof messaging;
  notifications: typeof notifications;
  profiles: typeof profiles;
  reports: typeof reports;
  seed: typeof seed;
  seedAccounts: typeof seedAccounts;
  seedAccountsHelpers: typeof seedAccountsHelpers;
  social: typeof social;
  users: typeof users;
  verification: typeof verification;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
