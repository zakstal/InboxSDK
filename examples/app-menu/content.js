/// <reference path="types.d.ts" />

function log() {
  console.log(...['app-menu'].concat(arguments));
}

InboxSDK.load(2, 'app-menu').then(async (sdk) => {
  var appendStylesheet = function (url) {
    const css =
      '.inboxsdk__button_icon.bentoBoxIndicator { background: transparent url(https://assets.streak.com/clientjs-commit-builds/assets/pipelineIndicator.ebfc97a74f09365a433e8537ff414815.png) no-repeat; height: 18px; width: 18px; }';
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');

    head.appendChild(style);
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));

    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.type = 'text/css';
    sheet.href = url;
    document.head.appendChild(sheet);
  };

  sdk.Router.handleCustomRoute('custom-route-1', (customRouteView) => {
    const el = document.createElement('span');
    el.innerHTML = 'This is custom route 1';
    customRouteView.getElement().appendChild(el);
  });

  sdk.Router.handleCustomRoute('custom-route-2', (customRouteView) => {
    const el = document.createElement('span');
    el.innerHTML = 'This is custom route 2';
    customRouteView.getElement().appendChild(el);
  });

  const customItem1 = sdk.AppMenu.addMenuItem({
      name: 'Custom Panel 1',
      insertIndex: 1,
      onClick: () => {
        log('clicked custom menu item 1');
        sdk.Router.goto('custom-route-1');
      },
      routeID: 'custom-route-1',
    }),
    customItem2 = sdk.AppMenu.addMenuItem({
      name: 'II',
      onClick: () => {
        log('clicked custom menu item 2');
        sdk.Router.goto('custom-route-2');
      },
      isRouteActive: (route) => {
        return route === 'custom-route-2';
      },
      iconUrl: {
        lightTheme: chrome.runtime.getURL('monkey-face.jpg'),
      }
    }),
    panel1 = await customItem1.addCollapsiblePanel({
      title: 'Panel 1',
      primaryButton: {
        name: 'Custom panel 1',
        onClick: () => alert('clicked custom panel 1'),
        iconUrl: {lightTheme: chrome.runtime.getURL('monkey-face.jpg')},
      }
    }),
    panel2 = await customItem2.addCollapsiblePanel({
      title: 'Panel 2',
    });

    panel1.addNavItem({
      name: 'Nav Item 1',
      onClick: () => alert('clicked nav item 1'),
    })
});
