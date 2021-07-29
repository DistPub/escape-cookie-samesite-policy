window.addEventListener("load", () => {
  let $list = document.querySelector('#list');

  chrome.runtime.sendMessage({method: 'get-config'}, response => {
    response.whitelist.map(item => {
      let $item = document.createElement('li');
      $item.innerText = item;
      $list.appendChild($item);
    });
  });
});