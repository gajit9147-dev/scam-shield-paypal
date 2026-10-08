document.getElementById('go').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) { await chrome.runtime.sendMessage({ type: 'check', tabId: tab.id }); window.close(); }
});
