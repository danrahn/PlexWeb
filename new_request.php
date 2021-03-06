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
    <meta charset="utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>New Plex Request</title>
    <?php build_css(); ?>
</head>
<body>
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="suggest" class="formContainer">
            <div class="formTitle">New Request</div>
            <form id="suggestForm" action="javascript:void(0);">
                <hr />
                <div class="formInput">
                    <ul id="typeContainer">
                        <li class="typeOption left" id="movie">Movie</li>
                        <li class="typeOption" id="tv">TV Show</li>
                        <li class="typeOption right" id="audiobook">Audiobook</li>
                    </ul>
                </div>
                <div class="formInput hiddenInputStart" id="nameHolder">
                    <input type="text" name="name" id="name" maxlength=128>
                </div>
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
            </form>
            <hr />
            <a href="user_settings.php">Change notification settings</a>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
</body>
<?php build_js(); ?>
</html>