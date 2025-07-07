import { DashboardManager } from "./dashboard-manager.js"
const dashboard = document.getElementById("dashboard");

export const manager = new DashboardManager({
    root: dashboard
})
