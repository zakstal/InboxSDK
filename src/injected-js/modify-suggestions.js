var _ = require('lodash');
var htmlToText = require('../common/html-to-text');
var gmailResponseProcessor = require('../platform-implementation-js/dom-driver/gmail/gmail-response-processor');

module.exports = function modifySuggestions(responseText, modifications) {
  let parsed = gmailResponseProcessor.deserialize(responseText);
  const query = parsed[0][1];
  for (let modification of modifications) {
    if (_.has(modification, 'name')) {
      modification.nameHTML = _.escape(modification.name);
    } else {
      modification.name = htmlToText(modification.nameHTML);
    }
    if (_.has(modification, 'description')) {
      modification.descriptionHTML = _.escape(modification.description);
    } else if (_.has(modification, 'descriptionHTML')) {
      modification.description = htmlToText(modification.descriptionHTML);
    }
    if (modification.routeName || modification.externalURL) {
      const data = {
        routeName: modification.routeName,
        routeParams: modification.routeParams,
        externalURL: modification.externalURL
      };
      modification.nameHTML +=
        ' <span style="display:none" data-inboxsdk-suggestion="' +
        _.escape(JSON.stringify(data)) + '"></span>';
    }
    let newItem = [
      "aso.sug", modification.searchTerm || query, modification.nameHTML, null, [], 34, null,
      "asor inboxsdk__custom_suggestion "+modification.owner, 0];
    if (_.has(modification, 'descriptionHTML')) {
      newItem[3] = [
        'aso.eme',
        modification.description,
        modification.name,
        modification.descriptionHTML,
        modification.nameHTML
      ];
    }
    if (modification.iconURL) {
      newItem[6] = ['aso.thn', modification.iconURL];
      newItem[7] += " inboxsdk__no_bg";
    } else {
      newItem[7] += " asor_i4";
    }
    parsed[0][3].push(newItem);
  }
  return gmailResponseProcessor.suggestionSerialize(parsed);
};
