<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(true, "new_request.php");
requireSSL();
?>


<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>New Plex Request</title>
    <?php get_css("style", "nav", "overlay", "new_request"); ?>
</head>
<body>
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="suggest" class="formContainer">
            <div class="formTitle">New Request</div>
            <form id="suggestForm" action="javascript:void(0);">
                <hr />
                <div class="formInput"><label for="type">Suggestion Type: </label><select name="type" id="type">
                    <option value="none"></option>
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                    <?php if ($_SESSION['level'] >= 100) {?> <option value="audiobook">Audiobook</option> <?php } ?>
                    <!-- <option value="music">Music</option> -->
                </select></div>
                <div class="formInput hiddenInputStart" id="nameHolder"><label for="name">Suggestion:</label><input type="text" name="name" id="name" maxlength=128></div>
                <div id="existingMatchHolder">
                    <div id="existingMatchContainer"></div>
                </div>
                <div id="matchHolder">
                    <div id="matchContainer"></div>
                    <div id="externalContainer" class="hidden">
                        <div class='formInput' id="external_holder"><hr /><label for='external_id' id='externallabel'>--OR-- IMDb ID:</label><input type=text style="float: left; margin-left: 10px" id='external_id' placeholder='tt1234567'></div>
                        <div id="externalResult"></div>
                    </div>
                </div>
                <div id="suggestions">
                    <div id="outsideSuggestions">
                        <h4>Matches</h4>
                    </div>
                    <div id="existingSuggestions">
                        <h4>Existing Items</h4>
                    </div>
                </div>
                <div class="formInput" id="submitHolder"><input type="button" value="Submit" id="go"></input></div>
            </form>
            <hr />
            <a href="user_settings.php">Change notification settings</a>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
</body>
<?php build_js("new_request", "consolelog", "animate", "common", "nav", "overlay", "queryStatus"); ?>
</html>