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

        table, th, td {
            border-collapse: collapse;
            padding: 5px 10px 5px 10px;
            font-size: 10pt;
        }

        th, td {
            border-left: 2px solid #808080;
            border-right: 2px solid #808080;
            width: auto;
            border-bottom: 1px solid #606060;
        }

        table {
            width: auto;
            background-color: rgba(0,0,0,.3);
            color: #C1C1C1;
            margin: auto;
            margin-top: 50px;
        }

        th {
            background-color: rgba(0,100,0,.3);
        }

        tr:hover {
            background-color: rgba(0,0,0,0.2);
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
function parseMarkdown()
{
    const text = $('#query').value;
    logVerbose(`Parsing "${text}"`);
    let md = new Markdown(text);
    let html = md.parse();
    $('.md')[0].innerHTML = html;
}
$('#markdownSubmit').addEventListener('click', parseMarkdown);
$('#query').addEventListener('change', parseMarkdown);
$('#query').addEventListener('keyup', parseMarkdown);

// http://www.howtocreate.co.uk/tutorials/jsexamples/syntax/prepareInline.html
var initialValue = 'Hello, this is my Markdown Parser. It\'s a bit slow (relatively, the text here never takes more than a few milliseconds to parse), but I think it\'s pretty neat! So far, you can have **Bold**, *Italic*, ++Underline++, ~~Strikethrough~~ (and ++~~***All four***~~++), `inline code blocks`, [Links](index.php), [_`Combinations` __*of* ~~them~~ ++all++___](index.php),\n# Headers\n## Of\n### Various\n#### Sizes\n\n* * *\nHorizontal Rules using 3+ `*`, `-`, or `\\`\n---\n___\n\n> Block quotes\n>> That\n>>> __Can__\n> *Be*\n>> ++**Nested**++,\n\n```\nAnd\n  Code\n    Blocks\n```\n\nIt should also escape <a href=\"index.php\">HTML entities<\/a>.\n\nThere\'s still a lot of work ahead though. I still need to implement the following:\n\n* Better list support\n  * Current, unordered lists are supported, [and](index.php) _can_ **have** `inline` ++~~formatting~~++, but combinations with block elements doesn\'t really work\n    * Headers, blockquotes, code blocks\n  * Ordered lists aren\'t supported at all\n* Tables\n* Images\n* Blocks within block quotes (currently only limited support)\n* Can any of the bold\/italic + strikethrough\/underline code be shared?\n* Syntax highlighting for code blocks (```` ```cpp````)\n\nI\'m creating more headaches in the future, but I\'ll probably go through the items from easiest to hardest, setting myself up to realize that the entire system is wrong due to some intricacies of the harder to process syntax (nested lists come to mind).\n\nThe code right now is also pretty awful.\n\n```\nCan I demonstrate an inline block within an inline block? Yes! Not allowing extra whitespace actually helps here, since I can just\nadd a space after \"```\" to prevent it from being interpreted as the end of a code block, avoiding the need for parsing an arbitrary number of backticks:\n\n```cpp\nint main()\n{\n    const char* sz = \"It works!\";\n    return 0;\n}\n``` \n\n```';
// initialValue = '';
$('#query').value = initialValue;
parseMarkdown();
</script>
</html>