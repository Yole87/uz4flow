import { QueueTabsView } from "./QueueTabsView";

/**
 * Compatibility wrapper — apenas delega para QueueTabsView.
 * A view real está em /queue.
 */
export function QueueDashboard() {
  return <QueueTabsView />;
}
