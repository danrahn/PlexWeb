<?php
require_once "includes/common.php";
session_start();
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
    <?php build_css("nav", "style", "overlay", "markdownEditor", "tooltip", "markdown"); ?>
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

    .mdToolbar {
        margin-left: 10%;
    }

    table {
        width: auto;
        background-color: rgba(0,0,0,.3);
        color: #C1C1C1;
        margin: auto;
        margin-top: 5px;
    }
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
            <input type="button" value="Run Test Suite" id="markdownTestSuite" />
            <div id="info" style="text-align: center; margin: auto">
                <div class="formInput" style="color: #c1c1c1; text-align: center; width: 150px; margin: auto">
                    <label for="liveupdate">Live updates: </label>
                    <input type="checkbox" name="liveupdate" id="liveupdate" checked="checked">
                </div>
                <div class="formInput" style="color: #c1c1c1; text-align: center; width: 150px; margin: auto">
                    <label for="testcache">Test Cache: </label>
                    <input type="checkbox" name="testcache" id="testcache">
                </div>
            </form>
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
<script><?php echo file_get_contents("script/markdownHelp.js"); ?></script>
<script><?php echo file_get_contents("script/markdownTest.js"); ?></script>
<script><?php echo file_get_contents("script/markdownEditor.js"); ?></script>
<script><?php echo file_get_contents("script/iconMap.js"); ?></script>
<script><?php echo file_get_contents("script/overlay.js"); ?></script>
<script><?php echo file_get_contents("script/animate.js"); ?></script>
<script><?php echo file_get_contents("script/tooltip.js"); ?></script>
<?php if (UserLevel::is_admin()) { ?>
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
MarkdownEditor.addFormatHandler($('#query'));
$('#query').parentNode.insertBefore(MarkdownEditor.getToolbar($('#query')),  $('#query'));

$('#markdownTestSuite').addEventListener('click', function()
{
    let testCache = $('#testcache').checked;
    let testResults = MarkdownTestSuite.runSuite(testCache);
    let totalTests = testResults.passed + testResults.failed;
    let passRate = ((testResults.passed / totalTests) * 100).toFixed(2);
    let auxText = (totalTests == testResults.passed ? '. Yay!' : '') + '\n\nSee the console (F12) for more details';
    alert(`Test Results${testCache ? ' (with cache)' : ''}: Passed ${testResults.passed} of ${totalTests} tests (${passRate}%)${auxText}`);
 });

MarkdownHelp.getHelp(function(response)
{
    $('#query').value = response.data;
    parseMarkdown();
}, true /*raw*/);

</script>
</html>