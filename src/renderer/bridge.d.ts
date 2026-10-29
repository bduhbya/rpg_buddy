import type { ApplicationBridge } from '../shared/application-info';

declare global {
  interface Window {
    rpgBuddy: ApplicationBridge;
  }
}
