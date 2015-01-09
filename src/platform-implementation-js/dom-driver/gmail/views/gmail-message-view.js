var _ = require('lodash');
var Bacon = require('baconjs');
var $ = require('jquery');

var MessageViewDriver = require('../../../driver-interfaces/message-view-driver');

var GmailAttachmentAreaView = require('./gmail-attachment-area-view');
var GmailAttachmentCardView = require('./gmail-attachment-card-view');

var makeMutationObserverStream = require('../../../lib/dom/make-mutation-observer-stream');

var GmailMessageView = function(element, gmailThreadView){
	MessageViewDriver.call(this);

	this._element = element;
	this._eventStream = new Bacon.Bus();
	this._stopper = this._eventStream.filter(false).mapEnd();
	this._threadViewDriver = gmailThreadView;

	// Outputs the same type of stream as makeElementChildStream does.
	this._replyElementStream = this._eventStream.filter(function(event) {
		return event.eventName === 'replyElement';
	}).map('.change');

	this._setupMessageStateStream();
	this._processInitialState();
	this._monitorEmailAddressHovering();
};

GmailMessageView.prototype = Object.create(MessageViewDriver.prototype);

_.extend(GmailMessageView.prototype, {

	__memberVariables: [
		{name: '_element', destroy: false, get: true},
		{name: '_stopper', destroy: false},
		{name: '_eventStream', destroy: true, get: true, destroyFunction: 'end'},
		{name: '_threadViewDriver', destroy: false, get: true},
		{name: '_replyElementStream', destroy: false, get: true},
		{name: '_gmailAttachmentAreaView', destroy: true},
		{name: '_addedAttachmentCardOptions', destroy: false, defaultValue: {}},
		{name: '_addedDownloadAllAreaButtonOptions', destroy: false, defaultValue: {}},
		{name: '_messageLoaded', destroy: false, defaultValue: false}
	],

	isLoaded: function(){
		return this._messageLoaded;
	},

	getContentsElement: function(){
		return this._element.querySelector('.adP');
	},

	getLinks: function(){
		var anchors = this.getContentsElement().querySelectorAll('a');

		var self = this;
		return _.map(anchors, function(anchor){
			return {
				text: anchor.textContent,
				html: anchor.innerHTML,
				href: anchor.href,
				element: anchor,
				isInQuotedArea: self.isElementInQuotedArea(anchor)
			};
		});
	},

	isElementInQuotedArea: function(element){
		return $(element).parents('blockquote').length > 0;
	},

	getSender: function(){
		var senderSpan = this._element.querySelector('h3.iw span[email]');
		return {
			name: senderSpan.getAttribute('name'),
			emailAddress: senderSpan.getAttribute('email')
		};
	},

	getRecipients: function(){
		var receipientSpans = this._element.querySelectorAll('.hb span[email]');
		return _.map(receipientSpans, function(span){
			return {
				name: span.getAttribute('name'),
				emailAddress: span.getAttribute('email')
			};
		});
	},

	getAttachmentCardViewDrivers: function(){
		if(!this._gmailAttachmentAreaView){
			this._gmailAttachmentAreaView = this._getAttachmentArea();
		}

		if(!this._gmailAttachmentAreaView){
			return [];
		}

		return this._gmailAttachmentAreaView.getGmailAttachmentCardViews();
	},

	addAttachmentCard: function(options){
		var attachmentCardOptionsHash = this._getAttachmentCardOptionsHash(options);

		if(this._addedAttachmentCardOptions[attachmentCardOptionsHash]){
			return;
		}

		var gmailAttachmentCardView = new GmailAttachmentCardView(options);

		if(!this._gmailAttachmentAreaView){
			this._gmailAttachmentAreaView = this._getAttachmentArea();
		}

		if(!this._gmailAttachmentAreaView){
			this._gmailAttachmentAreaView = this._createAttachmentArea();
		}

		this._gmailAttachmentAreaView.addGmailAttachmentCardView(gmailAttachmentCardView);

		this._addedAttachmentCardOptions[attachmentCardOptionsHash] = true;
	},

	addButtonToDownloadAllArea: function(options){
		var gmailAttachmentAreaView = this._getAttachmentArea();

		if(!gmailAttachmentAreaView){
			return;
		}

		var optionsHash = this._getDownloadAllAreaButtonOptionsHash(options);
		if(this._addedDownloadAllAreaButtonOptions[optionsHash]){
			return;
		}

		gmailAttachmentAreaView.addButtonToDownloadAllArea(options);

		this._addedDownloadAllAreaButtonOptions[optionsHash] = true;
	},

	_setupMessageStateStream: function(){
		var self = this;

		makeMutationObserverStream(this._element, {
			attributes: true, attributeFilter: ['class'], attributeOldValue: true
		}).takeUntil(this._stopper).onValue(function(mutation) {
			var currentClassList = mutation.target.classList;

			if(mutation.oldValue.indexOf('h7') > -1){ //we were open
				if(!currentClassList.contains('h7')){
					self._eventStream.push({
						eventName: 'collapsed',
						view: self
					});
				}
			}
			else {
				self._checkMessageOpenState(currentClassList);
			}
		});
	},

	_processInitialState: function(){
		var self = this;

		setTimeout(
			function(){
				if (self._element) {
					self._eventStream.push({
						type: 'internal',
						eventName: 'messageCreated',
						view: self
					});
					self._checkMessageOpenState(self._element.classList);
				}
			},
			1
		);
	},

	_checkMessageOpenState: function(classList){
		if(!classList.contains('h7')){
			return;
		}

		this._eventStream.push({
			eventName: 'expanded',
			view: this
		});

		if(this._messageLoaded){
			return;
		}
		this._messageLoaded = true;

		this._eventStream.push({
			type: 'internal',
			eventName: 'messageLoaded',
			view: this
		});

		this._setupReplyStream();
	},

	_setupReplyStream: function(){
		var replyContainer = this._element.querySelector('.ip');

		if(!replyContainer){
			return;
		}

		var self = this;
		var currentReplyElementRemovalStream = null;

		makeMutationObserverStream(replyContainer, {
			attributes: true, attributeFilter: ['class']
		}).takeUntil(this._stopper).startWith(null).mapEnd('END').onValue(function(mutation) {
			if (mutation !== 'END' && replyContainer.classList.contains('adB')) {
				if (!currentReplyElementRemovalStream) {
					currentReplyElementRemovalStream = new Bacon.Bus();
					self._eventStream.push({
						type: 'internal',
						eventName: 'replyElement',
						change: {
							el: replyContainer, removalStream: currentReplyElementRemovalStream
						}
					});
				}
			} else {
				if (currentReplyElementRemovalStream) {
					currentReplyElementRemovalStream.push(null);
					currentReplyElementRemovalStream.end();
					currentReplyElementRemovalStream = null;
				}
			}
		});
	},

	_monitorEmailAddressHovering: function(){
		var self = this;
		this._eventStream.plug(
			Bacon.fromEventTarget(this._element, 'mouseover')
				 .map('.target')
				 .filter(function(element){
				 	return element && element.getAttribute('email');
				 })
				 .map(function(element){
				 	var addressInformation = _extractContactInformation(element);
				 	var contactType = null;

					if(!self._element.classList.contains('h7')){
						contactType = 'sender';
					}
					else{
						if(self._element.querySelector('h3.iw').contains(element)){
							contactType = 'sender';
						}
						else{
							contactType = 'recipient';
						}
					}

				 	return {
				 		eventName: 'contactHover',
				 		contact: addressInformation,
				 		contactType: contactType,
				 		messageViewDriver: self
				 	};
				 })

		);
	},

	_getAttachmentCardOptionsHash: function(options){
		return options.fileName + options.previewUrl + options.downloadUrl;
	},

	_getDownloadAllAreaButtonOptionsHash: function(options){
		return options.iconClass + options.tooltip;
	},

	_getAttachmentArea: function(){
		if(this._element.querySelector('.hq')){
			return new GmailAttachmentAreaView(this._element.querySelector('.hq'));
		}

		return null;
	},

	_createAttachmentArea: function(){
		var gmailAttachmentAreaView = new GmailAttachmentAreaView();

		var beforeElement = this._element.querySelector('.hi');
		beforeElement.parentNode.insertBefore(gmailAttachmentAreaView.getElement(), beforeElement);

		return gmailAttachmentAreaView;
	}

});

function _extractContactInformation(span){
	return {
		name: span.getAttribute('name'),
		emailAddress: span.getAttribute('email')
	};
}

module.exports = GmailMessageView;
