/// <summary>
/// Helper class to retrieve the help markdown text
/// </summary>

/* exported MarkdownHelp */

let MarkdownHelp = new function()
{
    let _helpMarkdown = new Markdown();
    let _mdHtmlWrap = () => `<div class="md">${_helpMarkdown._cachedParse}</div>`;

    /// <summary>
    /// Passes the markdown help text to the given callback
    /// </summary>
    /// <param name="callback">Function to call once we have the markdown text</param>
    /// <param name="raw">
    /// If true, passes the raw markdown text to the callback.
    /// If false, passes the converted HTML to the callback.
    /// </param>
    this.getHelp = function(callback, raw=false)
    {
        if (_helpMarkdown._cachedParse.length != 0)
        {
            callback({ data : raw ? _helpMarkdown.text : _mdHtmlWrap() });
            return;
        }

        let successFunc = function(response, request)
        {
            _helpMarkdown.parse(response.data);
            callback({ data : request.raw ? _helpMarkdown.text : _mdHtmlWrap() });
        };

        // On failure, return the error, but don't cache anything
        let errorFunc = function(response, request)
        {
            let error = "Failed to get help document: " + response.Error;
            callback({ data : request.raw ? error : `<div class="md">${error}</div>` });
        };

        sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.MarkdownText }, successFunc, errorFunc, { raw : raw });

    };
}();
