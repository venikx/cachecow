/**
 * @typedef {Object} CloudFrontFunctionRequest
 * @property {string} uri
 * @property {Object.<string, string|string[]>} [querystring]
 * @property {Object} headers
 */

/**
 * @typedef {Object} CloudFrontFunctionEvent
 * @property {CloudFrontFunctionRequest} request
 */

/**
 * @param {CloudFrontFunctionEvent} event
 * @returns {CloudFrontFunctionRequest}
 */
function handler(event) {
  var request = event.request;
  var originalImagePath = request.uri;

  if (!request.querystring) {
    request.uri = originalImagePath + "/original";
    return request;
  }

  /** @type {Record<"width" | "height", string>} */
  var operations = {};

  for (var operation in request.querystring) {
    switch (operation.toLowerCase()) {
      case "width": {
        if (request.querystring[operation]["value"]) {
          var width = parseInt(request.querystring[operation]["value"]);
          if (!isNaN(width) && width > 0) {
            operations["width"] = width.toString();
          }
        }
        break;
      }
      case "height": {
        if (request.querystring[operation]["value"]) {
          var height = parseInt(request.querystring[operation]["value"]);
          if (!isNaN(height) && height > 0) {
            operations["height"] = height.toString();
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (Object.keys(operations).length > 0) {
    var operationsList = [];
    if (operations.width) operationsList.push("width=" + operations.width);
    if (operations.height) operationsList.push("height=" + operations.height);

    request.uri = originalImagePath + "/" + operationsList.join(",");
  } else {
    request.uri = originalImagePath + "/original";
  }

  request["querystring"] = {};

  return request;
}

// NOTE(venikx): only export when running in node
if (typeof module !== "undefined" && module.exports) {
  module.exports = { handler };
}
