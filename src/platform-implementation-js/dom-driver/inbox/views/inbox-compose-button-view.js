/* @flow */

import includes from 'lodash/includes';
import {defn} from 'ud';
import Kefir from 'kefir';
import type InboxComposeView from './inbox-compose-view';
import fromEventTargetCapture from '../../../lib/from-event-target-capture';
import insertElementInOrder from '../../../lib/dom/insert-element-in-order';
import DropdownView from '../../../widgets/buttons/dropdown-view';
import InboxDropdownView from './inbox-dropdown-view';
import type {TooltipDescriptor} from '../../../views/compose-button-view';
import type {ComposeButtonDescriptor} from '../../../driver-interfaces/compose-view-driver';
import InboxTooltipView from './inbox-tooltip-view';

let insertionOrderHint: number = 0;

class InboxComposeButtonView {
  _composeView: InboxComposeView;
  _buttonEl: HTMLElement;
  _tooltip: ?InboxTooltipView;

  constructor(composeView: InboxComposeView, buttonDescriptor: Kefir.Observable<?ComposeButtonDescriptor>, groupOrderHint: string, extraOnClickOptions: Object) {
    this._tooltip = null;
    this._composeView = composeView;
    const div = this._buttonEl = document.createElement('div');
    div.setAttribute('role', 'button');
    div.setAttribute('data-insertion-order-hint', String(insertionOrderHint++));
    div.tabIndex = 0;
    div.className = 'inboxsdk__button_icon';
    const img = document.createElement('img');
    img.className = 'inboxsdk__button_iconImg';
    let onClick = () => {};
    let hasDropdown = false;
    let dropdown = null;
    Kefir.merge([
      Kefir.fromEvents(div, 'click'),
      fromEventTargetCapture(div, 'keyup').filter(e => includes([32/*space*/, 13/*enter*/], e.which))
    ]).onValue(event => {
      event.preventDefault();
      event.stopPropagation();
      this.closeTooltip();
      if (hasDropdown) {
        if (dropdown) {
          dropdown.close();
          return;
        } else {
          this._buttonEl.classList.add('inboxsdk__active');
          dropdown = new DropdownView(new InboxDropdownView(), div);
          dropdown.setPlacementOptions({
            vAlign: 'bottom'
          });
          dropdown.on('destroy', () => {
            this._buttonEl.classList.remove('inboxsdk__active');
            dropdown = null;
          });
        }
      }
      onClick(Object.assign(({dropdown}:any), extraOnClickOptions));
    });
    let lastOrderHint = null;

    buttonDescriptor.takeUntilBy(composeView.getStopper()).onValue(buttonDescriptor => {
      if (!buttonDescriptor) {
        div.remove();
        lastOrderHint = null;
        return;
      }
      hasDropdown = buttonDescriptor.hasDropdown;
      div.title = buttonDescriptor.title;
      div.className = 'inboxsdk__button_icon '+(buttonDescriptor.iconClass||'');
      onClick = buttonDescriptor.onClick;
      if (buttonDescriptor.iconUrl) {
        img.src = buttonDescriptor.iconUrl;
        div.appendChild(img);
      } else {
        img.remove();
      }
      const orderHint = buttonDescriptor.orderHint||0;
      if (lastOrderHint !== orderHint) {
        lastOrderHint = orderHint;
        div.setAttribute('data-order-hint', String(orderHint));
        insertElementInOrder(composeView.getModifierButtonContainer(), div);
      }
    });

    composeView.getStopper().onValue(() => {
      this.closeTooltip();
      div.remove();
      if (dropdown) {
        dropdown.close();
      }
    });
  }

  showTooltip(tooltipDescriptor: TooltipDescriptor) {
    if (this._composeView.isInlineReplyForm()) {
      // In Inbox, if you haven't interacted with an inline compose yet, then
      // it will auto-close as soon as anything else including the tooltip is
      // interacted with. Focusing the inline compose is enough to make Inbox
      // think it's been interacted with and to avoid that behavior.
      this._composeView.getElement().focus();
    }
    if (this._tooltip) {
      this.closeTooltip();
    }
    const tooltip = this._tooltip = new InboxTooltipView(this._buttonEl, tooltipDescriptor);
    tooltip.getStopper().onValue(() => {
      if (this._tooltip === tooltip) {
        this._tooltip = null;
      }
    });
  }

  closeTooltip() {
    if (this._tooltip) {
      this._tooltip.destroy();
    }
  }
}

export default defn(module, InboxComposeButtonView);
