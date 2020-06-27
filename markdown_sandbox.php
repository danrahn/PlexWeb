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
    <title>Markdown Sandbox</title>
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
<?php build_js(); ?>
<?php if (UserLevel::is_admin()) { ?>
<script><?php echo file_get_contents("script/markdownSamples.js"); ?></script>
<?php } ?>
</html>