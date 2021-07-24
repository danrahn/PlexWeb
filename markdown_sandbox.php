<?php
require_once "includes/common.php";
requireSSL();
session_start();
?>

<!-- Page to allow easy testing of markdown -->

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <link rel="icon" type="image/svg+xml" href="mdfav.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <meta name="Description" content="A place to test the Markdown parser used for danrahn.com" />
    <title>Markdown Sandbox</title>
    <?php build_css(); ?>
</head>
<body>

<div id="plexFrame">
    <h2 id="welcome">Test Markdown</h2>
    <div id="container">
        <div id="queryContainer">
            <label for="query" style="display:none">Markdown Textbox</label>
            <textarea id="query" rows=20></textarea>
            <br>
            <input type="button" value="Test" id="markdownSubmit" />
            <input type="button" value="Run Test Suite" id="markdownTestSuite" />
            <div id="info" style="text-align: center; margin: auto">
                <div class="formInput" id="options">
                    <label for="liveupdate">Live updates: 
                        <input type="checkbox" name="liveupdate" id="liveupdate" checked="checked">
                    </label>
                    <label for="testcache">Test Cache: 
                        <input type="checkbox" name="testcache" id="testcache">
                    </label>
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