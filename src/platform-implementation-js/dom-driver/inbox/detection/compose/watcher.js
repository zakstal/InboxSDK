/* @flow */
//jshint ignore:start

import _ from 'lodash';
import Kefir from 'kefir';
import udKefir from 'ud-kefir';
import Logger from '../../../../lib/logger';
import streamWaitFor from '../../../../lib/stream-wait-for';
import delayAsap from '../../../../lib/delay-asap';
import censorHTMLtree from '../../../../../common/censor-html-tree';
import makeElementChildStream from '../../../../lib/dom/make-element-child-stream';
import type ItemWithLifetimePool from '../../../../lib/ItemWithLifetimePool';
import type {ElementWithLifetime} from '../../../../lib/dom/make-element-child-stream';
import makeMutationObserverChunkedStream from '../../../../lib/dom/make-mutation-observer-chunked-stream';
import makeElementStreamMerger from '../../../../lib/dom/make-element-stream-merger';
import selectorStream from '../../../../lib/dom/selectorStream';
import threadWatcher from '../thread/watcher';

export default function watcher(
  root: Document=document,
  openedThreadPool: ?ItemWithLifetimePool<*>=null
): Kefir.Stream<ElementWithLifetime> {
  const openedThreads: Kefir.Stream<ElementWithLifetime> = openedThreadPool ? openedThreadPool.items() : threadWatcher(root);

  const inlineComposeSelector = selectorStream([
    '*',
    ':not([role=heading])',
    ':not([role=list])',
    '*',
    '[jsvs]',
    {$map(el) {
      const buttonEl = _.find(el.children, child => child.nodeName === 'BUTTON');
      if (!buttonEl) {
        Logger.error(new Error("inline compose button not found"), {
          html: censorHTMLtree(el)
        });
      }
      return buttonEl;
    }},
    {$watch: {attributeFilter: ['style'], fn: el => el.style.display !== 'none'}},
    {$map: el => (el.parentElement:any)}
  ]);

  const inlineComposes = openedThreads
    .flatMap(({el,removalStream}) => inlineComposeSelector(el).takeUntilBy(removalStream));

  const regularComposeSelector = selectorStream([
    'div[id][jsaction]',
    'div[id][class]:not([role])',
    'div[class]',
    'div[id]',
    'div[jstcache][class]:not([aria-hidden], [tabindex])',
    {$map(el) {
      const composeEl = el.querySelector('div[role=dialog]');
      if (!composeEl) {
        Logger.error(new Error("compose dialog element not found"), {
          html: censorHTMLtree(el)
        });
      }
      return composeEl;
    }}
  ]);

  const regularComposes = regularComposeSelector(root.body)
    .map(({el,removalStream}) => ({
      // Needed so the element isn't removed before we see the element
      // re-added as full-screen.
      el, removalStream: removalStream.delay(1)
    }));

  const fullscreenComposeSelector = selectorStream([
    '[id][jsaction]',
    'div[id]:not([jsaction])',
    'div[tabindex][jsaction*="exit_full_screen"]',
    '*',
    '*',
    '*',
    '*',
    '*',
    '[role=dialog]'
  ]);

  const fullscreenComposes = fullscreenComposeSelector(root.body);

  return Kefir.merge([
    inlineComposes,
    Kefir.merge([
      regularComposes, fullscreenComposes
    ])
      .flatMap(makeElementStreamMerger())
  ])
    .filter(({el}) => !el.classList.contains('inboxsdk__drawer_view'));
}
