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

// business logic
const service = details => {
  let url = new URL(details.url);

  if (!config.whitelist.includes(url.host)) {
    return {responseHeaders: details.responseHeaders}
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
});