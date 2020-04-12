document.querySelector("textarea").addEventListener("keyup", function(e) {
    if (e.keyCode == 13 && e.ctrlKey)
    {
        let q = document.querySelector("textarea");
        if (q.value.toLowerCase().startsWith("all "))
        {
            q.value = "SELECT * FROM `" + q.value.substring(4) + "`";
        }

        sendQuery();
    }
    else if (e.key == "End" && e.code.toLowerCase() == "numpad1" /*numpad1*/)
    {
        document.querySelector("textarea").value =
        "SELECT\n\t" +
            "`TABLE_NAME` AS `Table`,\n\t" +
            "`COLUMN_NAME` AS `Column`,\n\t" +
            "`COLUMN_TYPE` AS `Type`,\n\t" +
            "`CHARACTER_MAXIMUM_LENGTH` AS `Max_Length`,\n\t" +
            "`COLUMN_DEFAULT` AS `Default`,\n\t" +
            "`EXTRA` AS `Other`,\n\t" +
            "`COLUMN_KEY` AS `Keys`\n" +
        "FROM information_schema.columns\n" +
        "WHERE `TABLE_SCHEMA` = 'plexweb'\n" +
        "ORDER BY `TABLE_NAME`, `ORDINAL_POSITION`";
    }
    else if (e.key == "ArrowDown" && e.code == "Numpad2")
    {
        document.querySelector("textarea").value = "SELECT `TABLE_NAME` AS `Table`, `TABLE_ROWS` as `Rows` FROM information_schema.tables WHERE `TABLE_SCHEMA` = 'plexweb'";
    }
    else if (e.key == "PageDown" && e.code == "Numpad3")
    {
        q = document.querySelector("textarea");
        q.value = "SELECT `COLUMN_NAME` AS `Column`, `COLUMN_TYPE` AS `Type` FROM information_schema.columns WHERE `table_schema` = 'plexweb' AND `TABLE_NAME` = '" + q.value + "'";
    }
});

document.getElementById("querySubmit").addEventListener("click", function() { sendQuery(); });

function test()
{
    let data = [
        {Content: "Hello", Id: 4},
        {Content: "World", Id: 6}
    ]
    let http = new XMLHttpRequest();
    http.open("POST", "query.php", true);
    http.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    http.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200)
        {
            logInfo(this.responseText);
        }
    };

    http.send(JSON.stringify(data));
}

function sendQuery()
{
    test();
    let http = new XMLHttpRequest();
    http.open("POST", "query.php", true);
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    http.onreadystatechange = function() {
        if (this.readyState != 4 || this.status != 200)
        {
            return;
        }

        try {
            let response = JSON.parse(this.responseText);
            logVerbose(response, "Query response");
            if (response.Error)
            {
                logError(response.Error);
                return;
            }

            let table = document.createElement("table");

            if (response.length > 0)
            {
                let row = document.createElement("tr");
                for (let i = 0; i < response[0].length; ++i)
                {
                    let header = document.createElement("th");
                    header.innerHTML = response[0][i];
                    row.appendChild(header);
                }

                table.appendChild(row);
            }

            for (let i = 1; i < response.length; ++i)
            {
                let row = document.createElement("tr");
                for (let j = 0; j < response[i].length; ++j)
                {
                    let data = document.createElement("td");
                    data.innerHTML = response[i][j];
                    row.appendChild(data);
                }

                table.appendChild(row);

            }

            let tableHolder = document.getElementById("queryResult");
            tableHolder.innerHTML = "";

            tableHolder.appendChild(table);
        } catch (ex) {
            logError(ex);
            logError(this.responseText);
        }
    }

    http.send(`&q=${encodeURIComponent(document.getElementById("query").value.replace(/\s+/g, " "))}`);
}