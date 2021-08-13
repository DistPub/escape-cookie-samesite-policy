function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  return new Promise(resolve => chrome.tabs.query(queryOptions, resolve));
}

function exec(id, options) {
  return new Promise(resolve => chrome.tabs.executeScript(id, options, resolve));
}

function getHistory(tabId) {
  return new Promise(resolve => chrome.runtime.sendMessage({method: 'get-history-requests', tabId}, resolve));
}

window.addEventListener("load", async () => {
  let $list = document.querySelector('#list');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    Array.from(new Set(Object.values(response.whitelist).reduce((a, b)=>a.concat(b), []))).map(item => {
      let $item = document.createElement('li');
      $item.innerText = item;
      $list.appendChild($item);
    });
  });

  let [tab] = await getCurrentTab();

  // failed, e.g. on chrome ui
  if (chrome.runtime.lastError) {
    return;
  }

  let historyRequests = await getHistory(tab.id);
  historyRequests = JSON.stringify(historyRequests);

  let $plus = document.querySelector('#plus');
  chrome.runtime.sendMessage({method: 'get-feature-plus'}, async response => {
    for (let [idx, plus] of response.entries()) {
      try {
        let [itis] = await exec(plus.tab.id, {code: `;(function(){return location.href==="${plus.tab.url}";})()`});

        // not alive
        if (!itis) {
          console.log(`not alive, delete plus: ${idx}`);
          chrome.runtime.sendMessage({method: 'delete-feature-plus', idx});
          continue;
        }
      } catch (error) {
        console.log(`error: ${error}, delete plus: ${idx}`);
        chrome.runtime.sendMessage({method: 'delete-feature-plus', idx});
        continue;
      }

      let [match] = await exec(tab.id, {code: `;(${plus.checker})(${historyRequests})`});
      if (!match) {
        console.log(`not matched, plus: ${idx}`);
        continue;
      }

      let $item = document.createElement('li');
      $item.innerHTML = `<button>${plus.name}</button>`;
      $plus.appendChild($item);
      $item.onclick = async () => {
        let [flow] = await exec(tab.id, {code: `;(${plus.maker})(${historyRequests})`});
        chrome.runtime.sendMessage({method: 'add-flow', tab: plus.tab.id, flow});
      }
    }
  });
});