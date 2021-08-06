function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  return new Promise(resolve => chrome.tabs.query(queryOptions, resolve));
}

function exec(id, options) {
  return new Promise(resolve => chrome.tabs.executeScript(id, options, resolve));
}

window.addEventListener("load", async () => {
  let $list = document.querySelector('#list');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    response.whitelist.map(item => {
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

  let $plus = document.querySelector('#plus');
  chrome.runtime.sendMessage({method: 'get-feature-plus'}, async response => {
    for (let [idx, plus] of response.entries()) {
      let [itis] = await exec(plus.tab.id, {code: `(function(){return location.href==="${plus.tab.url}";})();`});

      // not alive
      if (chrome.runtime.lastError || !itis) {
        chrome.runtime.sendMessage({method: 'delete-feature-plus', idx});
        continue;
      }

      let [match] = await exec(tab.id, {code: plus.checker});
      if (!match) {
        continue;
      }

      let $item = document.createElement('li');
      $item.innerHTML = `<button>${plus.name}</button>`;
      $plus.appendChild($item);
      $item.onclick = async () => {
        let [flow] = await exec(tab.id, {code: plus.maker});
        chrome.runtime.sendMessage({method: 'add-flow', tab: plus.tab.id, flow});
      }
    }
  });
});