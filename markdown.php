<?php
require_once "includes/common.php";
?>

<!-- Page to allow easy testing of markdown -->

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Markdown Test</title>
<style>
    <?php get_css("nav", "style", "markdown"); ?>
    <style>
        #queryContainer {
            text-align: center;
        }

        #queryContainer > textarea {
            float: none;
            width: 80%;
            font-family: monospace;
            -moz-tab-size : 4;
            -o-tab-size : 4;
            tab-size : 4;
        }

        #queryContainer > input {
            float: none;
            clear: both;
            width: 100px;
            height: 30px;
        }

        #mdHolder {
            background: rgba(0, 0, 0, 0.2);
            padding: 20px;
            margin-left: 20px;
            margin-right: 20px;
        }
    </style>
</style>
</head>
<body>

<div id="plexFrame">
    <h2 id="welcome">Test Markdown</h2>
    <div id="container">
        <div id="queryContainer">
            <textarea id="query" rows=20></textarea>
            <br>
            <input type="button" value="Test" id="markdownSubmit" />
        </div>
    </div>
    <div id="mdHolder">
        <div class='md'>
        </div>
    </div>
</div>
</body>
<script src="script/consolelog.js"></script>
<script src="script/common.js"></script>
<script src="script/markdown.js"></script>
<script>

let md = new Markdown();

function forceParseMarkdown() { parseMarkdown(true); }
function parseMarkdown(force=false)
{
    const text = $('#query').value;
    logTmi(`Parsing "${text}"`);
    let html;
    if (force)
    {
        html = new Markdown().parse(text);
    }
    else
    {
        html = md.parse(text);
    }

    if (!md.sameText)
    {
        $('.md')[0].innerHTML = html;
    }
}
$('#markdownSubmit').addEventListener('click', forceParseMarkdown);
$('#query').addEventListener('change', parseMarkdown);
$('#query').addEventListener('keyup', parseMarkdown);

markdownHelp();
$('#query').value = _helpMarkdown.text;
parseMarkdown();
</script>
</html>