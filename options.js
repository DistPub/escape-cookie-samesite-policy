window.addEventListener("load", () => {
  let $whitelist = document.querySelector('#whitelist');
  let $forceSecure = document.querySelector('#force-secure');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    $whitelist.value = response.whitelist.join(', ');
    $forceSecure.checked = response.forceSecure;
  });

  $whitelist.addEventListener("change", event => {
    let whitelist = event.target.value;
    whitelist = whitelist.split(',').map(item => item.trim()).filter(item => item.length>0);
    chrome.runtime.sendMessage({method: 'set-whitelist', data: whitelist});
  });

  $forceSecure.addEventListener("change", event => {
    chrome.runtime.sendMessage({method: 'set-force-secure', data: event.target.checked});
  });
});