// config section
const config = {};
chrome.storage.local.get(['whitelist', 'forceSecure'], result => {
  if (result.whitelist) {
    config.whitelist = result.whitelist;
  } else {
    config.whitelist = [];
  }

  config.forceSecure = Boolean(result.forceSecure);
});

const plus = [];
const queue = {};
const tabRequest = {};

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

  if (!config.whitelist.includes(url.host)) {
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

  if (!config.whitelist.includes(url.host)) {
    return;
  }

  if (tabRequest[details.tabId] && tabRequest[details.tabId][details.requestId]) {
    tabRequest[details.tabId][details.requestId].requestHeaders = details.requestHeaders;
  }
},
// filters
{ urls: ["*://*/*"] },
// extraInfoSpec
["requestHeaders"]);

const service = details => {
  let url = new URL(details.url);

  if (!config.whitelist.includes(url.host)) {
    return {responseHeaders: details.responseHeaders}
  }

  if (tabRequest[details.tabId] && tabRequest[details.tabId][details.requestId]) {
    tabRequest[details.tabId][details.requestId].responseHeaders = details.responseHeaders;
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

    if (!existsSecure && (url.protocol === 'https:' || config.forceSecure)) {
      attrs.push('Secure')
    }

    cookie.value = attrs.join(';');
    return cookie;
  });

  if (setCookies.length) {
    setCookies.push({
      name: 'x-chrome-extension-note',
      value: 'modified all set-cookie headers to disable samesite policy'
    });

    if (url.protocol === 'http:' && config.forceSecure) {
      setCookies.push({
        name: 'x-chrome-extension-note',
        value: `the origin is insecure but modified to secure, you need add ${url.origin} to chrome://flags/#unsafely-treat-insecure-origin-as-secure`
      });
    }
  }
  return { responseHeaders: [...notSetCookies, ...setCookies] };
};

chrome.webRequest.onHeadersReceived.addListener(service,
  // filters
  { urls: ["*://*/*"] },
  // extraInfoSpec
  ["blocking","responseHeaders","extraHeaders"]
);

// options page server
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let method = request.method;

  if (method === "get-config") {
    sendResponse(config);
  }
  if (method === 'set-whitelist') {
    config.whitelist = request.data;
    chrome.storage.local.set({whitelist: request.data});
    sendResponse(config);
  }
  if (method === 'set-force-secure') {
    config.forceSecure = request.data;
    chrome.storage.local.set({forceSecure: request.data});
    sendResponse(config);
  }

  if (method === "get-feature-plus") {
    sendResponse(plus);
  }

  if (method === 'add-flow') {
    queue[request.tab].push(request.flow);
    sendResponse(queue[request.tab])
  }

  if (method === 'delete-feature-plus') {
    let [item] = plus.splice(request.idx, 1);
    delete queue[item.tab.id];
  }

  if (method === 'get-history-requests') {
    sendResponse(tabRequest[request.tabId] ?? {});
  }
});

// external website page server
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  let method = request.method;

  if (method === "ping") {
    sendResponse("pong");
  }
  if (method === "get-config") {
    sendResponse(config);
  }
  if (method === 'add-whitelist') {
    if (!config.whitelist.includes(request.data)) {
      config.whitelist.push(request.data);
      chrome.storage.local.set({whitelist: config.whitelist});
    }
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

  if (method === 'get-flow') {
    if (queue[sender.tab.id]?.length) {
      sendResponse(queue[sender.tab.id].shift());
    } else {
      sendResponse(null);
    }
  }
});