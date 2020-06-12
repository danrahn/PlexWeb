<?php
require_once "includes/common.php";
session_start();
verify_loggedin(true, "markdown.php");
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
            <div id="info" style="text-align: center; margin: auto"><div class="formInput" style="color: #c1c1c1; text-align: center; width: 150px; margin: auto"><label for="liveupdate">Live updates: </label><input type="checkbox" name="liveupdate" id="liveupdate" checked="checked"></div></form>
        </div>
    </div>
    <div id="mdHolder">
        <div class='md'>
        </div>
    </div>
</div>
</body>
<script><?php echo file_get_contents("script/consolelog.js"); ?></script>
<script><?php echo file_get_contents("script/common.js"); ?></script>
<script><?php echo file_get_contents("script/markdown.js"); ?></script>
<script><?php echo file_get_contents("script/markdownTest.js"); ?></script>
<script><?php echo file_get_contents("script/markdownEditor.js"); ?></script>
<?php if (isset($_SESSION["level"]) && $_SESSION['level'] >= 100) { ?>
<script><?php echo file_get_contents("script/markdownSamples.js"); ?></script>
<?php } ?>
<script>

let md = new Markdown();

function forceParseMarkdown() { parseMarkdownCore(true); }
function parseMarkdown() { parseMarkdownCore(false); }
function parseMarkdownCore(force)
{
    if (!force && !document.querySelector('#liveupdate').checked)
    {
        return;
    }

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

function parseShortcuts(e)
{
    if (e.keyCode == KEY.ENTER && e.ctrlKey)
    {
        forceParseMarkdown();
        return;
    }

    return;
}

$('#markdownSubmit').addEventListener('click', forceParseMarkdown);
$('#query').addEventListener('change', parseMarkdown);
$('#query').addEventListener('keyup', parseMarkdown);

$('#query').addEventListener('keydown', parseShortcuts);
MarkdownEditor.addTabHandler($('#query'));

markdownHelp(function(response)
{
    $('#query').value = response.data;
    parseMarkdown();
}, true /*raw*/);

</script>
</html>