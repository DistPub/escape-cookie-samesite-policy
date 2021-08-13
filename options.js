window.addEventListener("load", () => {
  let $whitelist = document.querySelector('#whitelist');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    $whitelist.value = response.whitelist.join(', ');
  });

  $whitelist.addEventListener("change", event => {
    let whitelist = event.target.value;
    whitelist = whitelist.split(',').map(item => item.trim()).filter(item => item.length>0);
    chrome.runtime.sendMessage({method: 'set-whitelist', data: whitelist});
  });
});