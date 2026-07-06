import { onRequestDelete as __api_logs_ts_onRequestDelete } from "D:\\brokebarista\\brokebarista\\functions\\api\\logs.ts"
import { onRequestGet as __api_logs_ts_onRequestGet } from "D:\\brokebarista\\brokebarista\\functions\\api\\logs.ts"
import { onRequestOptions as __api_logs_ts_onRequestOptions } from "D:\\brokebarista\\brokebarista\\functions\\api\\logs.ts"
import { onRequestPost as __api_logs_ts_onRequestPost } from "D:\\brokebarista\\brokebarista\\functions\\api\\logs.ts"
import { onRequestPut as __api_logs_ts_onRequestPut } from "D:\\brokebarista\\brokebarista\\functions\\api\\logs.ts"

export const routes = [
    {
      routePath: "/api/logs",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_logs_ts_onRequestDelete],
    },
  {
      routePath: "/api/logs",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_logs_ts_onRequestGet],
    },
  {
      routePath: "/api/logs",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_logs_ts_onRequestOptions],
    },
  {
      routePath: "/api/logs",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_logs_ts_onRequestPost],
    },
  {
      routePath: "/api/logs",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_logs_ts_onRequestPut],
    },
  ]