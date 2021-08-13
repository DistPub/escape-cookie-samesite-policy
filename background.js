// config section
const config = {};
chrome.storage.local.get(['whitelist'], result => {
  if (result.whitelist) {
    config.whitelist = result.whitelist;
  } else {
    config.whitelist = {};
  }
});

const plus = [];
const queue = {};
const tabRequest = {};
const requestHeaders = {};

function getAllWhitelistOrigin() {
  return Object.values(config.whitelist).reduce((a, b) => a.concat(b), []);
}

// business logic
chrome.tabs.onRemoved.addListener(tabId => {
  if (tabRequest[tabId]) {
    console.log(`tab ${tabId} removed, clear tabRequest`);
    delete tabRequest[tabId];
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabRequest[tabId] && changeInfo.url) {
    console.log(`tab ${tabId} url updated, empty tabRequest`);
    tabRequest[tabId] = {};
  }
});

chrome.webRequest.onBeforeRequest.addListener(details => {
  let url = new URL(details.url);

  if (!getAllWhitelistOrigin().includes(url.origin)) {
    return;
  }

  if (details.tabId === -1) {
    return;
  }

  if (tabRequest[details.tabId]) {
    tabRequest[details.tabId][details.requestId] = details;
  } else {
    tabRequest[details.tabId]= {};
    tabRequest[details.tabId][details.requestId] = details;
  }
},
// filters
{ urls: ["*://*/*"] },
// extraInfoSpec
["requestBody"]);

chrome.webRequest.onBeforeSendHeaders.addListener(details => {
  let url = new URL(details.url);

  if (!getAllWhitelistOrigin().includes(url.origin)) {
    return;
  }

  requestHeaders[details.requestId] = details.requestHeaders;

  if (tabRequest[details.tabId] && tabRequest[details.tabId][details.requestId]) {
    tabRequest[details.tabId][details.requestId].requestHeaders = details.requestHeaders;
  }
},
// filters
{ urls: ["*://*/*"] },
// extraInfoSpec
["requestHeaders"]);

chrome.webRequest.onHeadersReceived.addListener(details => {
  let url = new URL(details.url);

  if (!getAllWhitelistOrigin().includes(url.origin)) {
    return;
  }

  if (tabRequest[details.tabId] && tabRequest[details.tabId][details.requestId]) {
    tabRequest[details.tabId][details.requestId].responseHeaders = details.responseHeaders;
  }
},
// filters
{ urls: ["*://*/*"] },
// extraInfoSpec
["responseHeaders"]);

// escape cors policy
const corsService = details => {
  let url = new URL(details.url);

  if (!config.whitelist[details.initiator]?.includes(url.origin)) {
    return {responseHeaders: details.responseHeaders};
  }

  let extra = [];
  extra.push({
    name: 'Access-Control-Allow-Origin',
    value: details.initiator === 'null' ? '*' : details.initiator ? details.initiator : '*'
  });
  extra.push({
    name: 'Access-Control-Allow-Methods',
    value: 'GET, PUT, POST, DELETE, HEAD, OPTIONS'
  });
  extra.push({
    name: 'Access-Control-Allow-Credentials',
    value: 'true'
  });
  extra.push({
    name: 'Access-Control-Expose-Headers',
    value: details.responseHeaders.map(item=>item.name).join(', ')
  });

  if (requestHeaders[details.requestId]) {
    let headers = Object.fromEntries(
      requestHeaders[details.requestId].map(item=>[item.name.toLowerCase(), item.value])
    );

    if (headers['access-control-request-headers']) {
      extra.push({
        name: 'Access-Control-Allow-Headers',
        value: headers['access-control-request-headers']
      });
    }
    delete requestHeaders[details.requestId];
  }

  return {responseHeaders: [
    ...details.responseHeaders.filter(item=>!item.name.toLowerCase().startsWith('access-control-')),
    ...extra]};
};

chrome.webRequest.onHeadersReceived.addListener(corsService,
  // filters
  { urls: ["*://*/*"] },
  // extraInfoSpec
  ["blocking","responseHeaders","extraHeaders"]
);

// escape cookie samesite policy
const cookieService = details => {
  let url = new URL(details.url);

  if (!getAllWhitelistOrigin().includes(url.origin)) {
    return {responseHeaders: details.responseHeaders};
  }

  let notSetCookies = details.responseHeaders.filter(item=>!/set-cookie/i.test(item.name));
  let setCookies = details.responseHeaders.filter(item=>/set-cookie/i.test(item.name));

  setCookies = setCookies.map(cookie=> {
    let attrs = cookie.value.split(';').map(item=>item.trim());
    let existsSameSite = false;
    let existsSecure = false;
    attrs = attrs.map(item=>{
      let [k,...rest] = item.split('=');

      if (/samesite/i.test(k)) {
        existsSameSite = true;
        return `${k}=None`;
      }

      if (/secure/i.test(k)) {
        existsSecure = true;
        return k;
      }

      return item;
    });

    if (!existsSameSite) {
      attrs.push('SameSite=None');
    }

    if (!existsSecure) {
      attrs.push('Secure')
    }

    cookie.value = attrs.join(';');
    return cookie;
  });

  if (setCookies.length && url.protocol === 'http:') {
    setCookies.push({
      name: 'x-chrome-extension-note',
      value: `the origin set-cookie is insecure but modified to secure, you need add ${url.origin} to chrome://flags/#unsafely-treat-insecure-origin-as-secure`
    });
  }
  return { responseHeaders: [...notSetCookies, ...setCookies] };
};

chrome.webRequest.onHeadersReceived.addListener(cookieService,
  // filters
  { urls: ["*://*/*"] },
  // extraInfoSpec
  ["blocking","responseHeaders","extraHeaders"]
);

// options page server
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let method = request.method;

  if (method === "ping") {
    sendResponse("pong");
  }

  if (method === "get-config") {
    sendResponse(config);
  }

  if (method === "get-whitelist") {
    sendResponse(config.whitelist[sender.origin] ?? []);
  }

  if (method === 'add-whitelist') {
    let update = false;

    if (!config.whitelist[sender.origin]) {
      config.whitelist[sender.origin] = []
      update = true;
    }

    if (!config.whitelist[sender.origin].includes(request.data)) {
      config.whitelist[sender.origin].push(request.data);
      update = true;
    }

    if (update) {
      chrome.storage.local.set({whitelist: config.whitelist});
    }

    sendResponse(config.whitelist[sender.origin]);
  }

  if (method === 'set-whitelist') {
    config.whitelist = request.data;
    chrome.storage.local.set({whitelist: request.data});
    sendResponse(config);
  }

  if (method === "add-feature-plus") {
    if (plus.map(item => item.tab.id).includes(sender.tab.id)) {
      sendResponse(null);
    } else {
      delete request.method;
      request.tab = sender.tab;
      plus.push(request);
      sendResponse(request);
      queue[sender.tab.id] = [];
    }
  }
  if (method === "get-feature-plus") {
    sendResponse(plus);
  }
  if (method === 'delete-feature-plus') {
    let [item] = plus.splice(request.idx, 1);
    delete queue[item.tab.id];
  }

  if (method === 'get-history-requests') {
    sendResponse(tabRequest[request.tabId] ?? {});
  }

  if (method === 'add-flow') {
    queue[request.tab].push(request.flow);
    sendResponse(queue[request.tab])
  }
  if (method === 'get-flow') {
    if (queue[sender.tab.id]?.length) {
      sendResponse(queue[sender.tab.id].shift());
    } else {
      sendResponse(null);
    }
  }
});