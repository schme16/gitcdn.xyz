(function () {
    'use strict';

    function initClipboard() {
        var inputElem = document.querySelector('#url-dev');
        var clipboardIcon = '<svg height="32" viewBox="-40 0 512 512" width="32" fill="#fff" xmlns="http://www.w3.org/2000/svg" id="fi_1621635"><path d="m271 512h-191c-44.113281 0-80-35.886719-80-80v-271c0-44.113281 35.886719-80 80-80h191c44.113281 0 80 35.886719 80 80v271c0 44.113281-35.886719 80-80 80zm-191-391c-22.054688 0-40 17.945312-40 40v271c0 22.054688 17.945312 40 40 40h191c22.054688 0 40-17.945312 40-40v-271c0-22.054688-17.945312-40-40-40zm351 261v-302c0-44.113281-35.886719-80-80-80h-222c-11.046875 0-20 8.953125-20 20s8.953125 20 20 20h222c22.054688 0 40 17.945312 40 40v302c0 11.046875 8.953125 20 20 20s20-8.953125 20-20zm0 0"></path></svg>';
        var clipboardIconGradient ='<svg height="512pt" viewBox="-40 0 512 512" width="512pt" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="fi_1622069"><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="0" x2="431" y1="256" y2="256"><stop offset="0" stop-color="#87f1fc"></stop><stop offset=".2557" stop-color="#7fd4fb"></stop><stop offset=".5295" stop-color="#78bcfb"></stop><stop offset=".7844" stop-color="#74aefa"></stop><stop offset="1" stop-color="#73a9fa"></stop></linearGradient><path d="m271 512h-191c-44.113281 0-80-35.886719-80-80v-271c0-44.113281 35.886719-80 80-80h191c44.113281 0 80 35.886719 80 80v271c0 44.113281-35.886719 80-80 80zm-191-391c-22.054688 0-40 17.945312-40 40v271c0 22.054688 17.945312 40 40 40h191c22.054688 0 40-17.945312 40-40v-271c0-22.054688-17.945312-40-40-40zm351 261v-302c0-44.113281-35.886719-80-80-80h-222c-11.046875 0-20 8.953125-20 20s8.953125 20 20 20h222c22.054688 0 40 17.945312 40 40v302c0 11.046875 8.953125 20 20 20s20-8.953125 20-20zm0 0" fill="url(#a)"></path></svg>';
        var button = document.createElement('button');
        button.classList.add('btn-clipboard');
        button.classList.add('waves-effect');
        button.classList.add('waves-light');
        button.classList.add('teal');
        button.classList.add('darken-3');
        button.classList.add('btn');
        button.classList.add('hidden');
        button.setAttribute('aria-label','Copy code to clipboard');
        button.setAttribute('style','border-radius:10px');
        button.innerHTML = clipboardIcon + '<span class="btn-clipboard__label">Copy</span>';

        inputElem.parentElement.appendChild(button);

        var clipboard = new Clipboard('.btn-clipboard', {
            target: function() {
                return inputElem;
            }
        });

        clipboard.on('success', function(event) {
            var textEl = document.querySelector('.btn-clipboard__label');
            event.clearSelection();
            textEl.innerHTML = 'Copied';
            setTimeout(function() {
                textEl.innerHTML = 'Copy';
            }, 2000);
        });

        inputElem.addEventListener('change', function(event) {
          if (event.target.value) {
            button.classList.remove('hidden')
          } else {
            button.classList.add('hidden');
          }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initClipboard();
    });

}());
