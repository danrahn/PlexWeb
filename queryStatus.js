(function()
{
    let baseTitle = "";
    let hasChanged = false;
    function queryStatus()
    {
        let http = new XMLHttpRequest();
        http.open("POST", "get_status.php", true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        http.onreadystatechange = function()
        {
            if (this.readyState != 4 || this.status != 200)
            {
                return;
            }

            try
            {
                let response = JSON.parse(this.responseText);
                logVerbose(response);
                if (response.play == 0 && response.pause == 0)
                {
                    // Only reset the title if we've previously changed it to avoid constant title updates
                    if (hasChanged)
                    {
                        hasChanged = false;
                        document.querySelector('title').innerHTML = baseTitle;
                    }
                    return;
                }

                hasChanged = true;
                let prepend = "";

                if (response.play > 0)
                {
                    prepend = `${response.play}&#9205; - `;
                }

                if (response.pause > 0)
                {
                    prepend += `${response.pause}  &#10073;&#10073; - `;
                }

                document.querySelector('title').innerHTML = prepend + baseTitle;
            }
            catch (ex)
            {
                logError(ex);
                logError(this.responseText);
            }
        };

        http.send("&type=5");
    }

    function startQuery()
    {
        baseTitle = window.document.title;

        queryStatus();
        setInterval(function() { queryStatus(); }, 20000);
    }

    window.addEventListener("load", startQuery);
})();