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
import type * as accountStatus from "../accountStatus.js";
import type * as actions_email from "../actions/email.js";
import type * as actions_sendCardIssued from "../actions/sendCardIssued.js";
import type * as actions_sendConnectionEmail from "../actions/sendConnectionEmail.js";
import type * as actions_sendDigestEmail from "../actions/sendDigestEmail.js";
import type * as actions_sendEventInvite from "../actions/sendEventInvite.js";
import type * as actions_sendVerificationEmail from "../actions/sendVerificationEmail.js";
import type * as addJob from "../addJob.js";
import type * as admin from "../admin.js";
import type * as adminAlumni from "../adminAlumni.js";
import type * as adminData from "../adminData.js";
import type * as adminEmployers from "../adminEmployers.js";
import type * as analytics from "../analytics.js";
import type * as articles from "../articles.js";
import type * as auth from "../auth.js";
import type * as authReset from "../authReset.js";
import type * as authResetHelpers from "../authResetHelpers.js";
import type * as billing from "../billing.js";
import type * as clearDemo from "../clearDemo.js";
import type * as companies from "../companies.js";
import type * as compliance from "../compliance.js";
import type * as connections from "../connections.js";
import type * as crons from "../crons.js";
import type * as digest from "../digest.js";
import type * as digestModel from "../digestModel.js";
import type * as directory from "../directory.js";
import type * as employerOrgs from "../employerOrgs.js";
import type * as enquiries from "../enquiries.js";
import type * as events from "../events.js";
import type * as feed from "../feed.js";
import type * as helpers_audit from "../helpers/audit.js";
import type * as helpers_privacy from "../helpers/privacy.js";
import type * as helpers_rbac from "../helpers/rbac.js";
import type * as helpers_registry from "../helpers/registry.js";
import type * as helpers_registryStub from "../helpers/registryStub.js";
import type * as helpers_siteContentPages from "../helpers/siteContentPages.js";
import type * as helpers_taxonomy from "../helpers/taxonomy.js";
import type * as http from "../http.js";
import type * as idCards from "../idCards.js";
import type * as jobs from "../jobs.js";
import type * as lookups from "../lookups.js";
import type * as mentorship from "../mentorship.js";
import type * as messaging from "../messaging.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seedAccounts from "../seedAccounts.js";
import type * as seedAccountsHelpers from "../seedAccountsHelpers.js";
import type * as seedActivity from "../seedActivity.js";
import type * as siteContent from "../siteContent.js";
import type * as social from "../social.js";
import type * as taxonomy from "../taxonomy.js";
import type * as users from "../users.js";
import type * as verification from "../verification.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academy: typeof academy;
  accountStatus: typeof accountStatus;
  "actions/email": typeof actions_email;
  "actions/sendCardIssued": typeof actions_sendCardIssued;
  "actions/sendConnectionEmail": typeof actions_sendConnectionEmail;
  "actions/sendDigestEmail": typeof actions_sendDigestEmail;
  "actions/sendEventInvite": typeof actions_sendEventInvite;
  "actions/sendVerificationEmail": typeof actions_sendVerificationEmail;
  addJob: typeof addJob;
  admin: typeof admin;
  adminAlumni: typeof adminAlumni;
  adminData: typeof adminData;
  adminEmployers: typeof adminEmployers;
  analytics: typeof analytics;
  articles: typeof articles;
  auth: typeof auth;
  authReset: typeof authReset;
  authResetHelpers: typeof authResetHelpers;
  billing: typeof billing;
  clearDemo: typeof clearDemo;
  companies: typeof companies;
  compliance: typeof compliance;
  connections: typeof connections;
  crons: typeof crons;
  digest: typeof digest;
  digestModel: typeof digestModel;
  directory: typeof directory;
  employerOrgs: typeof employerOrgs;
  enquiries: typeof enquiries;
  events: typeof events;
  feed: typeof feed;
  "helpers/audit": typeof helpers_audit;
  "helpers/privacy": typeof helpers_privacy;
  "helpers/rbac": typeof helpers_rbac;
  "helpers/registry": typeof helpers_registry;
  "helpers/registryStub": typeof helpers_registryStub;
  "helpers/siteContentPages": typeof helpers_siteContentPages;
  "helpers/taxonomy": typeof helpers_taxonomy;
  http: typeof http;
  idCards: typeof idCards;
  jobs: typeof jobs;
  lookups: typeof lookups;
  mentorship: typeof mentorship;
  messaging: typeof messaging;
  notifications: typeof notifications;
  profiles: typeof profiles;
  reports: typeof reports;
  search: typeof search;
  seed: typeof seed;
  seedAccounts: typeof seedAccounts;
  seedAccountsHelpers: typeof seedAccountsHelpers;
  seedActivity: typeof seedActivity;
  siteContent: typeof siteContent;
  social: typeof social;
  taxonomy: typeof taxonomy;
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
