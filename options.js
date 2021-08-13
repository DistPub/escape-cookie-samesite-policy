window.addEventListener("load", () => {
  let $whitelist = document.querySelector('#whitelist');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    $whitelist.value = JSON.stringify(response.whitelist);
  });

  $whitelist.addEventListener("change", event => {
    let whitelist = event.target.value;
    chrome.runtime.sendMessage({method: 'set-whitelist', data: JSON.parse(whitelist)});
  });
});