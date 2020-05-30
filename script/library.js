
window.addEventListener("load", function()
{
    sendHtmlJsonRequest("administration.php", { "type" : "sections" }, buildSections);
});

function buildSections(sections)
{
    let outerDiv = $("#tableEntries");
    sections.forEach(function(section)
    {
        logInfo(section);
        section.created = new Date(section.created * 1000);
        section.updated = new Date(section.updated * 1000);
        section.last_scanned = new Date(section.last_scanned * 1000);
        let div = tableItemHolder();
        let list = buildNode("ul");
        for (let [key, value] of Object.entries(section))
        {
            list.appendChild(buildNode("li", {}, `${key}: ${value}`));
        }

        list.appendChild(getRefreshNode(section['key']));

        div.appendChild(list);
        outerDiv.appendChild(div);
    });
}

function getRefreshNode(key)
{
    let li = buildNode("li", {});
    let button = buildNode('input',
        {'type' : 'button', 'value' : 'refresh', 'section' : key, 'id' : 'section' + key },
        'Refresh', {'click' : refreshNode});
    li.appendChild(button);
    return li;
}

function refreshNode()
{
    let key = this.getAttribute('section')
    let successFunc = function()
    {
        btn = $('#section' + key);
        Animation.fireNow({"backgroundColor" : new Color(63, 100, 69)}, btn, 500);
        Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, btn, 2000, 500, true);
    };

    let failureFunc = function()
    {
        btn = $('#section' + key);
        Animation.fireNow({"backgroundColor" : new Color(100, 66, 69)}, btn, 500);
        Animation.queueDelayed({"backgroundColor" : new Color(63, 66, 69)}, btn, 2000, 500, true);
    };

    sendHtmlJsonRequest("administration.php", { "type" : "refresh", "section" : key}, successFunc, failureFunc);
}

function tableIdentifier()
{
    return 'library';
}

function tableUpdateFunc()
{
    return () => sendHtmlJsonRequest("administration.php", { "type" : "sections" }, buildSections);
}
