window.addEventListener('message', event=>{
  if (event.source !== window) {
    return;
  }

  if (event.data.destination === 'edge-lover-bridge') {
    chrome.runtime.sendMessage(event.data.payload, response => {
      window.postMessage({source: 'edge-lover-bridge', payload: response, id: event.data.id});
    });
  }
});