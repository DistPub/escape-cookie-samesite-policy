chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
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

    if (setCookies.length) {
      setCookies.push({
        name: 'x-chrome-extension-note',
        value: 'modified all set-cookie headers to disable samesite policy'
      });
    }
    return { responseHeaders: [...notSetCookies, ...setCookies] };
  },
  // filters
  {
    urls: ["*://*/*"],
  },
  // extraInfoSpec
  ["blocking","responseHeaders","extraHeaders"]
);