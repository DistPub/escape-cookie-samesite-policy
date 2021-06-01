chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.path === "b2o" && request.method === "whitelist") {
    document.querySelector('#whitelist').value = request.data.join(', ');
  }
  if (request.path === "b2o" && request.method === "force-secure") {
    document.querySelector('#force-secure').checked = request.data;
  }
});

function load() {
  window.removeEventListener("load", load);
  chrome.runtime.sendMessage({path: "o2b", method: 'page-load'});

  document.querySelector('#whitelist').addEventListener("change", function (event) {
    let whitelist = event.target.value.split(',').map(item=>item.trim()).filter(item=>item.length>0);
    chrome.runtime.sendMessage({path: "o2b", method: 'set-whitelist', data: whitelist});
  });

  document.querySelector('#force-secure').addEventListener("change", function (event) {
    chrome.runtime.sendMessage({path: "o2b", method: 'set-force-secure', data: event.target.checked});
  });
}

window.addEventListener("load", load);