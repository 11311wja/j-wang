import { initializeStorage } from "../shared/storage.js";

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
});
