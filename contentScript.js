window.addEventListener('message', event=>{
  if (event.source !== window) {
    return;
  }

  if (event.data.destination === 'edge-lover-bridge') {
    if (event.data.payload.method === 'add-whitelist') {
      if(!confirm(`Allow this website read and change your data on ${event.data.payload.data}?`)) {
        return window.postMessage({source: 'edge-lover-bridge', payload: null, id: event.data.id});
      }
    }

    chrome.runtime.sendMessage(event.data.payload, response => {
      window.postMessage({source: 'edge-lover-bridge', payload: response, id: event.data.id});
    });
  }
});

function hook(window) {
  let counter = 0;
  let messageCallback = {};

  window.addEventListener('message', event=>{
    if (event.source !== window) {
      return;
    }

    if (event.data.source === 'edge-lover-bridge') {
      messageCallback[event.data.id](event.data.payload);
      delete messageCallback[event.data.id];
    }
  });

  window.requestEdgeLover = message => {
    let id = ++ counter;
    window.postMessage({destination: 'edge-lover-bridge', payload: message, id});
    return new Promise(resolve => messageCallback[id] = resolve);
  };
}

const script = document.createElement('script');
script.textContent = ';(' + hook.toString() + ')(window)';
document.documentElement.appendChild(script);
script.parentNode.removeChild(script);
